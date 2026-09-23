"""Бэктест на исторических свечах с учётом комиссий и проскальзывания.

Сигнал считается по закрытой свече i, вход — по открытию свечи i+1
(так же, как это происходит в реальной торговле). Если внутри одной свечи
задеты и стоп, и тейк, считаем, что сработал стоп (консервативно)."""
import csv
import math
import time
from dataclasses import dataclass, field, replace

from .models import Candle, Position
from .risk import RiskGuard, RiskParams, position_funds
from .strategy import StrategyParams, make_signals, update_trailing


@dataclass
class Trade:
    entry_ts: int
    exit_ts: int
    entry: float
    exit: float
    qty: float
    pnl: float
    reason: str


@dataclass
class Result:
    start_equity: float
    end_equity: float
    buy_hold_return: float
    trades: list = field(default_factory=list)
    equity_curve: list = field(default_factory=list)

    @property
    def total_return(self):
        return self.end_equity / self.start_equity - 1

    @property
    def max_drawdown(self):
        peak, dd = 0.0, 0.0
        for e in self.equity_curve:
            peak = max(peak, e)
            dd = max(dd, 1 - e / peak if peak else 0)
        return dd

    @property
    def win_rate(self):
        return sum(t.pnl > 0 for t in self.trades) / len(self.trades) if self.trades else 0.0

    @property
    def profit_factor(self):
        gains = sum(t.pnl for t in self.trades if t.pnl > 0)
        losses = -sum(t.pnl for t in self.trades if t.pnl < 0)
        return gains / losses if losses else math.inf if gains else 0.0

    def summary(self):
        return "\n".join([
            f"Сделок:              {len(self.trades)}",
            f"Доля прибыльных:     {self.win_rate:.1%}",
            f"Profit factor:       {self.profit_factor:.2f}",
            f"Доходность бота:     {self.total_return:+.2%}",
            f"Купить и держать:    {self.buy_hold_return:+.2%}",
            f"Макс. просадка:      {self.max_drawdown:.2%}",
            f"Капитал:             {self.start_equity:.2f} -> {self.end_equity:.2f}",
        ])


def run_backtest(candles, sp: StrategyParams, rp: RiskParams, balance=1000.0, fee_rate=0.001, slippage=0.0005,
                 start=0):
    """start — индекс свечи, с которой разрешена торговля. Свечи до него служат
    только для прогрева индикаторов (нужно, чтобы честно тестировать отдельные отрезки)."""
    sig = make_signals(candles, sp)
    guard = RiskGuard(rp)
    cash, pos, pending_entry = balance, None, None
    res = Result(balance, balance, candles[-1].close / candles[start].open - 1 if candles else 0.0)

    def close(i, price, reason):
        nonlocal cash, pos
        fill_price = price * (1 - slippage)
        proceeds = pos.qty * fill_price * (1 - fee_rate)
        cash += proceeds
        res.trades.append(Trade(pos.opened_ts, candles[i].ts, pos.entry_price, fill_price,
                                pos.qty, proceeds - pos.cost, reason))
        pos = None

    for i in range(start, len(candles)):
        c = candles[i]
        # 1. исполняем вход, решённый на предыдущей свече, по цене открытия
        if pending_entry is not None and pos is None:
            fill_price = c.open * (1 + slippage)
            stop, take = sig.levels(pending_entry, fill_price)
            equity = cash
            funds = position_funds(equity, cash / (1 + fee_rate), fill_price, stop, rp)
            if funds > 0:
                qty = funds / fill_price
                cost = funds * (1 + fee_rate)
                cash -= cost
                pos = Position(fill_price, qty, stop, take, fill_price, c.ts, cost)
        pending_entry = None

        # 2. стоп / тейк внутри свечи
        if pos is not None:
            if c.low <= pos.stop:
                close(i, min(pos.stop, c.open), "stop")
            elif c.high >= pos.take:
                close(i, max(pos.take, c.open), "take")

        # 3. сигналы по закрытию свечи
        if pos is not None:
            if sig.exit(i):
                close(i, c.close, "signal")
            else:
                update_trailing(pos, c.high, sig.atr[i], sp)

        equity = cash + (pos.qty * c.close if pos else 0.0)
        guard.update(equity, c.ts)
        res.equity_curve.append(equity)

        if guard.halted and pos is not None:
            close(i, c.close, "halt")
        if pos is None and sig.entry(i) and guard.can_open(equity)[0]:
            pending_entry = i

    if pos is not None:
        close(len(candles) - 1, candles[-1].close, "end")
    res.end_equity = cash
    if res.equity_curve:
        res.equity_curve[-1] = cash
    return res


def compare(candles, sp: StrategyParams, rp: RiskParams, balance=1000.0, fee_rate=0.001, slippage=0.0005,
            parts=2):
    """Прогоняет все стратегии на одной истории: весь период и каждую из parts частей
    отдельно. Стратегия, которая выигрывает только на одном отрезке, скорее всего
    просто подогнана под него. Возвращает текст таблицы."""
    from .strategy import STRATEGIES

    rp = replace(rp, max_drawdown=1.0)  # аварийная остановка обрезала бы историю — для анализа выключена
    warmup = sp.min_candles()
    usable = len(candles) - warmup
    periods = [("Весь период", warmup, len(candles))]
    if parts > 1 and usable >= parts * 50:
        size = usable // parts
        for k in range(parts):
            a = warmup + k * size
            b = len(candles) if k == parts - 1 else a + size
            periods.append((f"Часть {k + 1}/{parts}", a, b))

    fmt = lambda ts: time.strftime("%Y-%m-%d", time.gmtime(ts))
    lines = []
    for title, a, b in periods:
        seg = candles[a - warmup:b]
        lines.append(f"\n{title}: {fmt(candles[a].ts)} — {fmt(candles[b - 1].ts)}")
        lines.append(f"{'стратегия':<12}{'сделок':>8}{'win%':>8}{'PF':>7}{'доход':>10}{'просадка':>10}")
        bh = None
        for name in STRATEGIES:
            r = run_backtest(seg, replace(sp, name=name), rp, balance, fee_rate, slippage, start=warmup)
            bh = r.buy_hold_return
            pf = "inf" if r.profit_factor == math.inf else f"{r.profit_factor:.2f}"
            lines.append(f"{name:<12}{len(r.trades):>8}{r.win_rate:>8.0%}{pf:>7}"
                         f"{r.total_return:>+10.1%}{r.max_drawdown:>10.1%}")
        lines.append(f"{'купить+ждать':<12}{'':>8}{'':>8}{'':>7}{bh:>+10.1%}")
    return "\n".join(lines)


def scan(datasets, sp: StrategyParams, rp: RiskParams, balance=1000.0, fee_rate=0.001, slippage=0.0005):
    """Сводная таблица по нескольким наборам данных: datasets — список (подпись, свечи).
    Для каждой стратегии: доход за первую и вторую половину истории, за весь период,
    profit factor и просадка за весь период. Аварийная остановка выключена."""
    from .strategy import STRATEGIES

    rp = replace(rp, max_drawdown=1.0)
    warmup = sp.min_candles()
    head = (f"{'данные':<16}{'стратегия':<10}{'сделок':>7}{'PF':>6}"
            f"{'1-я пол.':>10}{'2-я пол.':>10}{'всего':>9}{'просадка':>10}")
    lines = [head]
    for label, candles in datasets:
        if len(candles) < warmup + 100:
            lines.append(f"{label:<16}мало данных ({len(candles)} свечей)")
            continue
        mid = warmup + (len(candles) - warmup) // 2
        for name in STRATEGIES:
            s = replace(sp, name=name)
            full = run_backtest(candles, s, rp, balance, fee_rate, slippage, start=warmup)
            a = run_backtest(candles[:mid], s, rp, balance, fee_rate, slippage, start=warmup)
            b = run_backtest(candles[mid - warmup:], s, rp, balance, fee_rate, slippage, start=warmup)
            pf = "inf" if full.profit_factor == math.inf else f"{full.profit_factor:.2f}"
            lines.append(f"{label:<16}{name:<10}{len(full.trades):>7}{pf:>6}{a.total_return:>+10.1%}"
                         f"{b.total_return:>+10.1%}{full.total_return:>+9.1%}{full.max_drawdown:>10.1%}")
        lines.append(f"{label:<16}{'держать':<10}{'':>7}{'':>6}{a.buy_hold_return:>+10.1%}"
                     f"{b.buy_hold_return:>+10.1%}{full.buy_hold_return:>+9.1%}")
    return "\n".join(lines)


def save_csv(candles, path):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ts", "open", "high", "low", "close", "volume"])
        for c in candles:
            w.writerow([c.ts, c.open, c.high, c.low, c.close, c.volume])


def load_csv(path):
    with open(path, newline="") as f:
        return [Candle(int(r["ts"]), float(r["open"]), float(r["high"]), float(r["low"]),
                       float(r["close"]), float(r["volume"])) for r in csv.DictReader(f)]
