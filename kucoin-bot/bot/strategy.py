"""Стратегии для спота (только long). Все стратегии используют общий фильтр
тренда (цена выше EMA TREND_EMA; 0 — фильтр выключен) и стопы по ATR:
стоп-лосс = вход - STOP_ATR * ATR, тейк-профит = вход + TAKE_ATR * ATR.

trend     — пересечение EMA: быстрая пересекает медленную снизу вверх и RSI < RSI_MAX.
            Выход при обратном пересечении.
meanrev   — возврат к среднему: покупка, когда цена закрылась ниже нижней полосы
            Боллинджера и RSI < RSI_MIN. Выход при возврате к средней линии.
breakout  — пробой канала Дончиана: закрытие выше максимума за DONCHIAN_ENTRY свечей.
            Выход при закрытии ниже минимума за DONCHIAN_EXIT свечей.

Один и тот же код используется в бэктесте, бумажной и реальной торговле,
поэтому результаты бэктеста соответствуют поведению бота.
"""
import math
from dataclasses import dataclass

from . import indicators as ind


@dataclass
class StrategyParams:
    name: str = "trend"
    fast_ema: int = 12
    slow_ema: int = 26
    trend_ema: int = 200
    rsi_period: int = 14
    rsi_max: float = 70.0
    rsi_min: float = 30.0
    bb_period: int = 20
    bb_std: float = 2.0
    donchian_entry: int = 20
    donchian_exit: int = 10
    atr_period: int = 14
    stop_atr: float = 2.0
    take_atr: float = 4.0
    trail_atr: float = 0.0

    def min_candles(self):
        return max(self.slow_ema, self.trend_ema, self.rsi_period + 1, self.atr_period + 1,
                   self.bb_period, self.donchian_entry + 1, self.donchian_exit + 1) + 2


class Signals:
    """Общая часть: цены, фильтр тренда, RSI, ATR, уровни стопа/тейка."""

    def __init__(self, candles, p: StrategyParams):
        self.p = p
        closes = [c.close for c in candles]
        self.close = closes
        self.high = [c.high for c in candles]
        self.low = [c.low for c in candles]
        self.trend = ind.ema(closes, p.trend_ema) if p.trend_ema > 0 else [0.0] * len(closes)
        self.rsi = ind.rsi(closes, p.rsi_period)
        self.atr = ind.atr(self.high, self.low, closes, p.atr_period)

    def _ready(self, i, *series):
        if i < 1:
            return False
        base = (self.trend[i], self.rsi[i], self.atr[i])
        return all(v is not None for v in base) and all(s[i] is not None and s[i - 1] is not None for s in series)

    def uptrend(self, i):
        return self.close[i] > self.trend[i]

    def entry(self, i):
        raise NotImplementedError

    def exit(self, i):
        raise NotImplementedError

    def describe(self, i):
        return f"RSI {self.rsi[i] or 0:.1f} | ATR {self.atr[i] or 0:.6f}"

    def levels(self, i, entry_price):
        """Стоп-лосс и тейк-профит для входа по цене entry_price на основе ATR свечи i."""
        a = self.atr[i]
        take = entry_price + self.p.take_atr * a if self.p.take_atr > 0 else math.inf  # 0 = без тейка
        return entry_price - self.p.stop_atr * a, take


class TrendSignals(Signals):
    def __init__(self, candles, p):
        super().__init__(candles, p)
        self.fast = ind.ema(self.close, p.fast_ema)
        self.slow = ind.ema(self.close, p.slow_ema)

    def entry(self, i):
        if not self._ready(i, self.fast, self.slow):
            return False
        crossed_up = self.fast[i - 1] <= self.slow[i - 1] and self.fast[i] > self.slow[i]
        return crossed_up and self.uptrend(i) and self.rsi[i] < self.p.rsi_max

    def exit(self, i):
        if not self._ready(i, self.fast, self.slow):
            return False
        return self.fast[i - 1] >= self.slow[i - 1] and self.fast[i] < self.slow[i]

    def describe(self, i):
        return f"EMA {self.fast[i] or 0:.6f}/{self.slow[i] or 0:.6f} | " + super().describe(i)


class MeanRevSignals(Signals):
    def __init__(self, candles, p):
        super().__init__(candles, p)
        self.lower, self.mid, self.upper = ind.bollinger(self.close, p.bb_period, p.bb_std)

    def entry(self, i):
        if not self._ready(i, self.lower):
            return False
        return self.close[i] < self.lower[i] and self.rsi[i] < self.p.rsi_min and self.uptrend(i)

    def exit(self, i):
        return self.mid[i] is not None and self.close[i] >= self.mid[i]

    def describe(self, i):
        return f"BB {self.lower[i] or 0:.6f}..{self.upper[i] or 0:.6f} | " + super().describe(i)


class BreakoutSignals(Signals):
    def __init__(self, candles, p):
        super().__init__(candles, p)
        self.upper = ind.highest_prev(self.high, p.donchian_entry)
        self.lower = ind.lowest_prev(self.low, p.donchian_exit)

    def entry(self, i):
        if not self._ready(i, self.upper):
            return False
        return self.close[i] > self.upper[i] and self.uptrend(i)

    def exit(self, i):
        return self.lower[i] is not None and self.close[i] < self.lower[i]

    def describe(self, i):
        return f"канал {self.lower[i] or 0:.6f}..{self.upper[i] or 0:.6f} | " + super().describe(i)


STRATEGIES = {"trend": TrendSignals, "meanrev": MeanRevSignals, "breakout": BreakoutSignals}


def make_signals(candles, p: StrategyParams):
    try:
        cls = STRATEGIES[p.name]
    except KeyError:
        raise ValueError(f"неизвестная стратегия {p.name!r}, доступны: {', '.join(STRATEGIES)}")
    return cls(candles, p)


def update_trailing(pos, high, atr_value, p: StrategyParams):
    """Подтягивает стоп за ценой. Стоп только растёт, никогда не опускается."""
    pos.highest = max(pos.highest, high)
    if p.trail_atr > 0 and atr_value:
        pos.stop = max(pos.stop, pos.highest - p.trail_atr * atr_value)
