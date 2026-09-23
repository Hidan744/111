"""Трендовая стратегия для спота (только long):

Вход:  быстрая EMA пересекает медленную снизу вверх,
       цена выше трендовой EMA (торгуем только по восходящему тренду),
       RSI ниже порога (не покупаем перекупленный рынок).
Выход: стоп-лосс = вход - STOP_ATR * ATR, тейк-профит = вход + TAKE_ATR * ATR,
       опциональный трейлинг-стоп, либо обратное пересечение EMA.

Один и тот же код используется в бэктесте, бумажной и реальной торговле,
поэтому результаты бэктеста соответствуют поведению бота.
"""
from dataclasses import dataclass

from . import indicators as ind


@dataclass
class StrategyParams:
    fast_ema: int = 12
    slow_ema: int = 26
    trend_ema: int = 200
    rsi_period: int = 14
    rsi_max: float = 70.0
    atr_period: int = 14
    stop_atr: float = 2.0
    take_atr: float = 4.0
    trail_atr: float = 0.0

    def min_candles(self):
        return max(self.slow_ema, self.trend_ema, self.rsi_period + 1, self.atr_period + 1) + 2


class Signals:
    def __init__(self, candles, p: StrategyParams):
        self.p = p
        closes = [c.close for c in candles]
        self.close = closes
        self.fast = ind.ema(closes, p.fast_ema)
        self.slow = ind.ema(closes, p.slow_ema)
        self.trend = ind.ema(closes, p.trend_ema) if p.trend_ema > 0 else [0.0] * len(closes)
        self.rsi = ind.rsi(closes, p.rsi_period)
        self.atr = ind.atr([c.high for c in candles], [c.low for c in candles], closes, p.atr_period)

    def _ready(self, i):
        if i < 1:
            return False
        vals = (self.fast[i], self.slow[i], self.fast[i - 1], self.slow[i - 1],
                self.trend[i], self.rsi[i], self.atr[i])
        return all(v is not None for v in vals)

    def entry(self, i):
        if not self._ready(i):
            return False
        crossed_up = self.fast[i - 1] <= self.slow[i - 1] and self.fast[i] > self.slow[i]
        return crossed_up and self.close[i] > self.trend[i] and self.rsi[i] < self.p.rsi_max

    def exit(self, i):
        if not self._ready(i):
            return False
        return self.fast[i - 1] >= self.slow[i - 1] and self.fast[i] < self.slow[i]

    def levels(self, i, entry_price):
        """Стоп-лосс и тейк-профит для входа по цене entry_price на основе ATR свечи i."""
        a = self.atr[i]
        return entry_price - self.p.stop_atr * a, entry_price + self.p.take_atr * a


def update_trailing(pos, high, atr_value, p: StrategyParams):
    """Подтягивает стоп за ценой. Стоп только растёт, никогда не опускается."""
    pos.highest = max(pos.highest, high)
    if p.trail_atr > 0 and atr_value:
        pos.stop = max(pos.stop, pos.highest - p.trail_atr * atr_value)
