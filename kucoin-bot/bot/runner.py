"""Торговый цикл для бумажной и реальной торговли."""
import json
import logging
import time
from pathlib import Path

from .kucoin_client import INTERVAL_SECONDS
from .models import Position
from .risk import RiskGuard, position_funds
from .strategy import make_signals, update_trailing

log = logging.getLogger(__name__)


class Trader:
    def __init__(self, cfg, client, broker, state_path):
        self.cfg = cfg
        self.client = client
        self.broker = broker
        self.state_path = Path(state_path)
        state = self._load()
        self.position = Position.from_dict(state["position"]) if state.get("position") else None
        self.last_candle_ts = state.get("last_candle_ts", 0)
        self.guard = RiskGuard(cfg.risk, state.get("guard"))
        self.realized_pnl = state.get("realized_pnl", 0.0)
        if hasattr(broker, "quote") and state.get("broker"):
            broker.quote, broker.base = state["broker"]["quote"], state["broker"]["base"]

    # ---------- состояние ----------

    def _load(self):
        if self.state_path.exists():
            return json.loads(self.state_path.read_text())
        return {}

    def save(self):
        data = {
            "position": self.position.to_dict() if self.position else None,
            "last_candle_ts": self.last_candle_ts,
            "guard": self.guard.to_dict(),
            "realized_pnl": self.realized_pnl,
            "broker": self.broker.to_dict(),
        }
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2))
        tmp.replace(self.state_path)

    # ---------- логика ----------

    def equity(self, price):
        return self.broker.cash() + (self.position.qty * price if self.position else 0.0)

    def open_position(self, sig, i):
        price = self.broker.get_price()
        stop, take = sig.levels(i, price)
        equity = self.equity(price)
        ok, reason = self.guard.can_open(equity)
        if not ok:
            log.warning("Вход пропущен: %s", reason)
            return
        funds = position_funds(equity, self.broker.cash() / (1 + self.cfg.fee_rate), price, stop, self.cfg.risk)
        if funds <= 0:
            log.warning("Вход пропущен: нулевой размер позиции")
            return
        fill = self.broker.market_buy(funds)
        # уровни пересчитываем от фактической цены исполнения
        stop, take = sig.levels(i, fill.price)
        self.position = Position(fill.price, fill.qty, stop, take, fill.price, int(time.time()), fill.funds + fill.fee)
        log.info("ПОКУПКА %.8f по %.6f | стоп %.6f | тейк %.6f", fill.qty, fill.price, stop, take)
        self.save()

    def close_position(self, reason):
        pos = self.position
        fill = self.broker.market_sell(pos.qty)
        pnl = fill.funds - fill.fee - pos.cost
        self.realized_pnl += pnl
        log.info("ПРОДАЖА %.8f по %.6f (%s) | PnL %+.4f | итого %+.4f",
                 fill.qty, fill.price, reason, pnl, self.realized_pnl)
        self.position = None
        self.save()

    def step(self):
        cfg = self.cfg
        price = self.broker.get_price()
        self.guard.update(self.equity(price))

        if self.guard.halted:
            if self.position:
                log.error("Аварийная остановка по просадке — закрываю позицию")
                self.close_position("halt")
            self.save()
            return False

        # стоп / тейк проверяем на каждой итерации по текущей цене
        if self.position:
            if price <= self.position.stop:
                self.close_position("stop")
            elif price >= self.position.take:
                self.close_position("take")

        # сигналы — только по новой закрытой свече
        step = INTERVAL_SECONDS[cfg.timeframe]
        need = cfg.strategy.min_candles() + 50
        candles = self.client.get_candles(cfg.symbol, cfg.timeframe, start=int(time.time()) - step * (need + 2))
        if len(candles) < cfg.strategy.min_candles():
            log.warning("Мало истории: %d свечей", len(candles))
            return True
        last = candles[-1]
        if last.ts > self.last_candle_ts:
            self.last_candle_ts = last.ts
            sig = make_signals(candles, cfg.strategy)
            i = len(candles) - 1
            log.info("Свеча %s закрыта: %.6f | %s",
                     time.strftime("%Y-%m-%d %H:%M", time.gmtime(last.ts)), last.close, sig.describe(i))
            if self.position:
                if sig.exit(i):
                    self.close_position("signal")
                else:
                    update_trailing(self.position, last.high, sig.atr[i], cfg.strategy)
            elif sig.entry(i):
                self.open_position(sig, i)
            self.save()
        return True

    def run(self):
        sp = self.cfg.strategy
        log.info("Старт: %s %s, стратегия %s, стоп %s ATR, тейк %s, трейлинг %s, позиция: %s",
                 self.cfg.symbol, self.cfg.timeframe, sp.name, sp.stop_atr,
                 f"{sp.take_atr} ATR" if sp.take_atr > 0 else "выкл",
                 f"{sp.trail_atr} ATR" if sp.trail_atr > 0 else "выкл",
                 "есть" if self.position else "нет")
        errors = 0
        while True:
            try:
                if not self.step():
                    log.error("Бот остановлен риск-менеджментом. Проверьте ситуацию вручную.")
                    return
                errors = 0
            except KeyboardInterrupt:
                raise
            except Exception:
                errors += 1
                log.exception("Ошибка итерации (%d подряд)", errors)
                if errors >= 10:
                    log.error("Слишком много ошибок подряд — остановка")
                    return
                time.sleep(min(300, 5 * 2 ** errors))
                continue
            time.sleep(self.cfg.poll_seconds)
