"""Риск-менеджмент: размер позиции, дневной лимит убытка, аварийная остановка."""
import time
from dataclasses import dataclass


@dataclass
class RiskParams:
    risk_per_trade: float = 0.01
    max_position_pct: float = 0.5
    max_daily_loss: float = 0.03
    max_drawdown: float = 0.15


def position_funds(equity, cash, entry, stop, rp: RiskParams):
    """Сколько котируемой валюты вложить, чтобы при срабатывании стопа
    потерять не больше risk_per_trade от капитала."""
    if entry <= 0 or stop >= entry or equity <= 0:
        return 0.0
    risk_amount = equity * rp.risk_per_trade
    qty = risk_amount / (entry - stop)
    return max(0.0, min(qty * entry, equity * rp.max_position_pct, cash))


class RiskGuard:
    def __init__(self, rp: RiskParams, state=None):
        self.rp = rp
        state = state or {}
        self.peak = state.get("peak", 0.0)
        self.day = state.get("day")
        self.day_start = state.get("day_start", 0.0)
        self.halted = state.get("halted", False)

    def to_dict(self):
        return {"peak": self.peak, "day": self.day, "day_start": self.day_start, "halted": self.halted}

    def update(self, equity, now=None):
        now = time.time() if now is None else now
        day = time.strftime("%Y-%m-%d", time.gmtime(now))
        if day != self.day:
            self.day, self.day_start = day, equity
        self.peak = max(self.peak, equity)
        if self.peak > 0 and equity <= self.peak * (1 - self.rp.max_drawdown):
            self.halted = True

    def can_open(self, equity):
        """(можно_ли_открывать, причина_запрета)."""
        if self.halted:
            return False, f"аварийная остановка: просадка от пика >= {self.rp.max_drawdown:.0%}"
        if self.day_start > 0 and equity <= self.day_start * (1 - self.rp.max_daily_loss):
            return False, f"дневной лимит убытка {self.rp.max_daily_loss:.0%} исчерпан"
        return True, ""
