"""Бэктест на исторических свечах с учётом комиссий и проскальзывания.

Сигнал считается по закрытой свече i, вход — по открытию свечи i+1
(так же, как это происходит в реальной торговле). Если внутри одной свечи
задеты и стоп, и тейк, считаем, что сработал стоп (консервативно)."""
import csv
import math
from dataclasses import dataclass, field

from .models import Candle, Position
from .risk import RiskGuard, RiskParams, position_funds
from .strategy import Signals, StrategyParams, update_trailing


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


def run_backtest(candles, sp: StrategyParams, rp: RiskParams, balance=1000.0, fee_rate=0.001, slippage=0.0005):
    sig = Signals(candles, sp)
    guard = RiskGuard(rp)
    cash, pos, pending_entry = balance, None, None
    res = Result(balance, balance, candles[-1].close / candles[0].open - 1 if candles else 0.0)

    def close(i, price, reason):
        nonlocal cash, pos
        fill_price = price * (1 - slippage)
        proceeds = pos.qty * fill_price * (1 - fee_rate)
        cash += proceeds
        res.trades.append(Trade(pos.opened_ts, candles[i].ts, pos.entry_price, fill_price,
                                pos.qty, proceeds - pos.cost, reason))
        pos = None

    for i, c in enumerate(candles):
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
