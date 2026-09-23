"""Режим auto: бот сам выбирает пары со всей биржи и ведёт портфель позиций.

Раз в свечу (по умолчанию 4 часа) бот:
  1. обновляет список ликвидных пар (bot/universe.py);
  2. считает сигналы стратегии по каждой паре;
  3. закрывает позиции по сигналу выхода и подтягивает трейлинг-стопы;
  4. открывает новые позиции по самым сильным сигналам, пока не занято MAX_POSITIONS мест.
Между свечами каждые POLL_SECONDS проверяет стоп/тейк всех позиций по ценам
всех пар (один запрос к бирже).

Учёт капитала общий для бумажного и реального режима:
  капитал = стартовый капитал + закрытый PnL + нереализованный PnL открытых позиций.
"""
import json
import logging
import math
import time
from dataclasses import replace
from pathlib import Path

from .backtest import Result, Trade
from .brokers import round_down
from .journal import TradeJournal
from .kucoin_client import INTERVAL_SECONDS
from .models import Fill, Position
from .risk import RiskGuard, position_funds
from .strategy import make_signals, strength, update_trailing
from .universe import select_universe

log = logging.getLogger(__name__)

CANDLE_DELAY = 30  # сек после закрытия свечи, чтобы биржа успела её отдать


# ---------- исполнение ----------

class PaperExecutor:
    """Имитация: покупка по лучшей цене продавца (ask), продажа по цене покупателя (bid),
    плюс проскальзывание и комиссия. Реальный спред учитывается автоматически."""

    def __init__(self, fee_rate=0.001, slippage=0.0005):
        self.fee_rate, self.slippage = fee_rate, slippage

    def available_quote(self):
        return math.inf

    def buy(self, symbol, funds, ticker):
        price = (ticker.get("sell") or ticker["last"]) * (1 + self.slippage)
        return Fill(funds / price, price, funds, funds * self.fee_rate)

    def sell(self, symbol, qty, ticker):
        price = (ticker.get("buy") or ticker["last"]) * (1 - self.slippage)
        return Fill(qty, price, qty * price, qty * price * self.fee_rate)


class LiveExecutor:
    """Реальные рыночные ордера на KuCoin с учётом шага цены/объёма каждой пары."""

    def __init__(self, client, quote="USDT"):
        self.client, self.quote = client, quote
        self.symbols = {}

    def refresh(self, symbols):
        self.symbols = symbols

    def available_quote(self):
        return self.client.get_available(self.quote)

    def _info(self, symbol):
        if symbol not in self.symbols:
            self.symbols[symbol] = self.client.get_symbol_info(symbol)
        return self.symbols[symbol]

    def _wait_fill(self, order_id, base_ccy, timeout=30):
        deadline = time.time() + timeout
        while True:
            o = self.client.get_order(order_id)
            if not o.get("isActive") or time.time() > deadline:
                break
            time.sleep(1)
        size, funds = float(o["dealSize"]), float(o["dealFunds"])
        price = funds / size if size else 0.0
        qty, fee = size, float(o.get("fee") or 0)
        if o.get("feeCurrency") == base_ccy:
            qty -= fee
            fee *= price
        return Fill(qty, price, funds, fee)

    def buy(self, symbol, funds, ticker):
        info = self._info(symbol)
        funds_str = round_down(funds, info["quoteIncrement"])
        min_funds = float(info.get("minFunds") or info["quoteMinSize"])
        if float(funds_str) < min_funds:
            raise ValueError(f"{symbol}: сумма {funds_str} меньше минимальной {min_funds}")
        oid = self.client.market_order(symbol, "buy", funds=funds_str)
        return self._wait_fill(oid, info["baseCurrency"])

    def sell(self, symbol, qty, ticker):
        info = self._info(symbol)
        qty = min(qty, self.client.get_available(info["baseCurrency"]))
        size_str = round_down(qty, info["baseIncrement"])
        if float(size_str) < float(info["baseMinSize"]):
            raise ValueError(f"{symbol}: объём {size_str} меньше минимального {info['baseMinSize']}")
        oid = self.client.market_order(symbol, "sell", size=size_str)
        return self._wait_fill(oid, info["baseCurrency"])


# ---------- торговый цикл ----------

class AutoTrader:
    def __init__(self, cfg, client, executor, capital, state_path, journal_path):
        self.cfg, self.client, self.ex = cfg, client, executor
        self.capital = capital
        self.state_path = Path(state_path)
        self.journal = TradeJournal(journal_path)
        state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {}
        self.positions = {s: Position.from_dict(p) for s, p in state.get("positions", {}).items()}
        self.realized = state.get("realized_pnl", 0.0)
        same_tf = state.get("timeframe", cfg.timeframe) == cfg.timeframe
        self.last_period = state.get("last_period", 0) if same_tf else 0
        self.guard = RiskGuard(cfg.risk, state.get("guard"))
        self.universe = state.get("universe", [])
        self.step_sec = INTERVAL_SECONDS[cfg.timeframe]

    def save(self):
        data = {
            "positions": {s: p.to_dict() for s, p in self.positions.items()},
            "realized_pnl": self.realized,
            "last_period": self.last_period,
            "timeframe": self.cfg.timeframe,
            "guard": self.guard.to_dict(),
            "universe": self.universe,
            "capital": self.capital,
        }
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2))
        tmp.replace(self.state_path)

    # ---------- учёт ----------

    def invested(self):
        return sum(p.cost for p in self.positions.values())

    def equity(self, tickers):
        unreal = 0.0
        for s, p in self.positions.items():
            price = tickers.get(s, {}).get("last") or p.entry_price
            unreal += p.qty * price * (1 - self.cfg.fee_rate) - p.cost
        return self.capital + self.realized + unreal

    def free_cash(self):
        cash = self.capital + self.realized - self.invested()
        return max(0.0, min(cash, self.ex.available_quote()))

    # ---------- сделки ----------

    def open(self, symbol, sig, i, ticker, equity):
        price = ticker.get("sell") or ticker["last"]
        stop, _ = sig.levels(i, price)
        rp = replace(self.cfg.risk, max_position_pct=min(self.cfg.risk.max_position_pct, 1 / self.cfg.max_positions))
        funds = position_funds(equity, self.free_cash() / (1 + self.cfg.fee_rate), price, stop, rp)
        if funds < 1:
            log.info("%s: сигнал есть, но нет свободных средств", symbol)
            return
        fill = self.ex.buy(symbol, funds, ticker)
        stop, take = sig.levels(i, fill.price)
        self.positions[symbol] = Position(fill.price, fill.qty, stop, take, fill.price, int(time.time()),
                                          fill.funds + fill.fee)
        log.info("ПОКУПКА %-12s %.8g по %.8g на %.2f | стоп %.8g", symbol, fill.qty, fill.price,
                 fill.funds + fill.fee, stop)

    def close(self, symbol, ticker, reason):
        pos = self.positions[symbol]
        fill = self.ex.sell(symbol, pos.qty, ticker)
        proceeds = fill.funds - fill.fee
        pnl = proceeds - pos.cost
        self.realized += pnl
        self.journal.append(symbol, pos.opened_ts, pos.entry_price, fill.price, fill.qty, pos.cost, proceeds, reason)
        del self.positions[symbol]
        log.info("ПРОДАЖА %-12s по %.8g (%s) | PnL %+.2f (%+.1f%%) | итого %+.2f",
                 symbol, fill.price, reason, pnl, pnl / pos.cost * 100, self.realized)

    # ---------- цикл ----------

    def step(self, now=None):
        now = time.time() if now is None else now
        tickers = self.client.get_all_tickers()
        equity = self.equity(tickers)
        self.guard.update(equity, now)

        if self.guard.halted:
            log.error("Аварийная остановка по просадке — закрываю все позиции")
            for s in list(self.positions):
                if s in tickers:
                    self.close(s, tickers[s], "halt")
            self.save()
            return False

        for s, pos in list(self.positions.items()):
            t = tickers.get(s)
            if not t or not t["last"]:
                continue
            if t["last"] <= pos.stop:
                self.close(s, t, "stop")
            elif t["last"] >= pos.take:
                self.close(s, t, "take")

        period = int(now // self.step_sec)
        if period > self.last_period and now - period * self.step_sec >= CANDLE_DELAY:
            self.last_period = period
            self.on_candle(tickers, now)
        self.save()
        return True

    def on_candle(self, tickers, now):
        cfg = self.cfg
        symbols = self.client.get_all_symbols()
        if hasattr(self.ex, "refresh"):
            self.ex.refresh(symbols)
        self.universe = select_universe(tickers, symbols, cfg.universe)
        log.info("Новая свеча. Пар в отборе: %d, открыто позиций: %d, капитал %.2f",
                 len(self.universe), len(self.positions), self.equity(tickers))

        need = cfg.strategy.min_candles() + 50
        candidates = []
        for s in list(self.positions) + [u for u in self.universe if u not in self.positions]:
            try:
                candles = self.client.get_candles(s, cfg.timeframe, start=int(now) - self.step_sec * (need + 2))
            except Exception as e:  # одна проблемная пара не должна ронять весь цикл
                log.warning("%s: не удалось получить свечи: %s", s, e)
                continue
            time.sleep(0.1)
            if len(candles) < cfg.strategy.min_candles() or candles[-1].ts < now - 2 * self.step_sec:
                continue  # новая монета без истории или давно нет сделок
            sig = make_signals(candles, cfg.strategy)
            i = len(candles) - 1
            if s in self.positions:
                if sig.exit(i) and s in tickers:
                    self.close(s, tickers[s], "signal")
                else:
                    update_trailing(self.positions[s], candles[-1].high, sig.atr[i], cfg.strategy)
            elif sig.entry(i) and s in tickers:
                candidates.append((strength(sig, i), s, sig, i))

        slots = cfg.max_positions - len(self.positions)
        if not candidates:
            return
        candidates.sort(key=lambda c: c[0], reverse=True)
        log.info("Сигналы на покупку: %s", ", ".join(c[1] for c in candidates))
        equity = self.equity(tickers)
        ok, reason = self.guard.can_open(equity)
        if not ok:
            log.warning("Новые позиции не открываются: %s", reason)
            return
        for _, s, sig, i in candidates[:max(0, slots)]:
            try:
                self.open(s, sig, i, tickers[s], equity)
            except Exception as e:
                log.warning("%s: покупка не удалась: %s", s, e)

    def run(self):
        """Возвращает "halt" (остановлен риск-менеджментом — перезапускать не надо)
        или "errors" (серия сбоев, например нет сети — стоит перезапустить)."""
        sp = self.cfg.strategy
        log.info("Старт auto: %s, стратегия %s, до %d позиций, капитал %.2f, открыто: %s",
                 self.cfg.timeframe, sp.name, self.cfg.max_positions, self.capital,
                 ", ".join(self.positions) or "нет")
        errors = 0
        while True:
            try:
                if not self.step():
                    log.error("Бот остановлен риск-менеджментом. Проверьте ситуацию вручную.")
                    return "halt"
                errors = 0
            except KeyboardInterrupt:
                raise
            except Exception:
                errors += 1
                log.exception("Ошибка итерации (%d подряд)", errors)
                if errors >= 10:
                    log.error("Слишком много ошибок подряд — остановка")
                    return "errors"
                time.sleep(min(300, 5 * 2 ** errors))
                continue
            time.sleep(self.cfg.poll_seconds)


# ---------- портфельный бэктест ----------

def run_portfolio_backtest(data, sp, rp, max_positions=5, balance=1000.0, fee_rate=0.001, slippage=0.0005):
    """Тот же алгоритм, что у AutoTrader, на истории нескольких пар с общим капиталом.
    data: {пара: [свечи]}. Аварийная остановка выключена, чтобы видеть всю историю."""
    rp = replace(rp, max_drawdown=1.0, max_position_pct=min(rp.max_position_pct, 1 / max_positions))
    sigs = {s: make_signals(c, sp) for s, c in data.items() if len(c) > sp.min_candles()}
    idx = {s: {c.ts: i for i, c in enumerate(data[s])} for s in sigs}
    times = sorted({c.ts for s in sigs for c in data[s]})
    warm = sp.min_candles()
    guard = RiskGuard(rp)
    cash, positions, pending, last = balance, {}, [], {}
    trades, curve = [], []

    def equity():
        return cash + sum(p.qty * last.get(s, p.entry_price) for s, p in positions.items())

    def close(s, ts, price, reason):
        nonlocal cash
        p = positions.pop(s)
        fill = price * (1 - slippage)
        proceeds = p.qty * fill * (1 - fee_rate)
        cash += proceeds
        trades.append(Trade(p.opened_ts, ts, p.entry_price, fill, p.qty, proceeds - p.cost, reason, s))

    for t in times:
        for s, i_sig in pending:
            j = idx[s].get(t)
            if j is None or s in positions or len(positions) >= max_positions:
                continue
            c = data[s][j]
            fill = c.open * (1 + slippage)
            stop, take = sigs[s].levels(i_sig, fill)
            funds = position_funds(equity(), cash / (1 + fee_rate), fill, stop, rp)
            if funds < 1:
                continue
            cost = funds * (1 + fee_rate)
            cash -= cost
            positions[s] = Position(fill, funds / fill, stop, take, fill, t, cost)
        pending = []

        for s, p in list(positions.items()):
            j = idx[s].get(t)
            if j is None:
                continue
            c = data[s][j]
            if c.low <= p.stop:
                close(s, t, min(p.stop, c.open), "stop")
            elif c.high >= p.take:
                close(s, t, max(p.take, c.open), "take")
            elif sigs[s].exit(j):
                close(s, t, c.close, "signal")
            else:
                update_trailing(p, c.high, sigs[s].atr[j], sp)

        for s in sigs:
            j = idx[s].get(t)
            if j is not None:
                last[s] = data[s][j].close
        eq = equity()
        guard.update(eq, t)
        curve.append(eq)

        slots = max_positions - len(positions)
        if slots > 0 and guard.can_open(eq)[0]:
            cands = []
            for s in sigs:
                j = idx[s].get(t)
                if j is not None and j >= warm and s not in positions and sigs[s].entry(j):
                    cands.append((strength(sigs[s], j), s, j))
            cands.sort(reverse=True)
            pending = [(s, j) for _, s, j in cands[:slots]]

    for s in list(positions):
        close(s, times[-1], last[s], "end")
    rets = [data[s][-1].close / data[s][warm].open - 1 for s in sigs]
    res = Result(balance, cash, sum(rets) / len(rets) if rets else 0.0, trades, curve)
    if curve:
        res.equity_curve[-1] = cash
    return res
