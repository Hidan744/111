import json

import pytest

from bot.backtest import Trade
from bot.config import load_config
from bot.journal import TradeJournal, summarize
from bot.kucoin_client import KucoinClient
from bot.portfolio import AutoTrader, PaperExecutor, run_portfolio_backtest
from bot.risk import RiskParams
from bot.strategy import StrategyParams, TrendSignals
from bot.universe import UniverseParams, select_universe
from tests.helpers import synthetic_candles
from tests.test_bot import RecordingSession


def info(base, quote="USDT", enabled=True):
    return {"symbol": f"{base}-{quote}", "baseCurrency": base, "quoteCurrency": quote, "enableTrading": enabled,
            "baseIncrement": "0.0001", "quoteIncrement": "0.01", "baseMinSize": "0.0001", "minFunds": "0.1"}


def tick(price, vol=10_000_000, spread=0.001):
    return {"last": price, "buy": price * (1 - spread / 2), "sell": price * (1 + spread / 2), "vol_value": vol}


# ---------- отбор пар ----------

def test_universe_filters_and_sorts_by_volume():
    symbols = {s["symbol"]: s for s in [
        info("BTC"), info("ETH"), info("USDC"), info("BTC3L"), info("SOL"), info("DOGE"),
        info("XRP", enabled=False), info("ETH", quote="BTC"), info("JUP"), info("SHIB")]}
    tickers = {
        "BTC-USDT": tick(100, vol=9e9), "ETH-USDT": tick(10, vol=5e9), "USDC-USDT": tick(1, vol=8e9),
        "BTC3L-USDT": tick(1, vol=7e9), "SOL-USDT": tick(5, vol=1e6),            # мало оборота
        "DOGE-USDT": tick(1, vol=3e9, spread=0.02),                                # большой спред
        "XRP-USDT": tick(1, vol=4e9), "ETH-BTC": tick(0.1, vol=6e9), "JUP-USDT": tick(1, vol=2e9),
        "SHIB-USDT": tick(1, vol=2.5e9),
    }
    up = UniverseParams(min_volume=2e6, max_pairs=10, max_spread=0.003, exclude={"SHIB-USDT"})
    assert select_universe(tickers, symbols, up) == ["BTC-USDT", "ETH-USDT", "JUP-USDT"]
    assert select_universe(tickers, symbols, UniverseParams(max_pairs=1)) == ["BTC-USDT"]


def test_all_tickers_parsed():
    s = RecordingSession({"code": "200000", "data": {"ticker": [
        {"symbol": "BTC-USDT", "last": "100", "buy": "99.9", "sell": "100.1", "volValue": "123"},
        {"symbol": "NEW-USDT", "last": None, "buy": "", "sell": None, "volValue": "0"}]}})
    t = KucoinClient(session=s).get_all_tickers()
    assert t["BTC-USDT"] == {"last": 100.0, "buy": 99.9, "sell": 100.1, "vol_value": 123.0}
    assert t["NEW-USDT"]["last"] == 0.0


# ---------- портфельный бэктест ----------

def _data(n=3, length=2500):
    return {f"C{k}-USDT": synthetic_candles(length, seed=k + 20) for k in range(n)}


def test_portfolio_backtest_accounting_and_position_limit():
    data = _data(4)
    res = run_portfolio_backtest(data, StrategyParams(), RiskParams(), max_positions=2)
    assert len(res.trades) > 0
    assert res.end_equity == pytest.approx(1000 + sum(t.pnl for t in res.trades))
    assert {t.symbol for t in res.trades} <= set(data)
    events = sorted([(t.entry_ts, 1) for t in res.trades] + [(t.exit_ts, -1) for t in res.trades],
                    key=lambda e: (e[0], e[1]))
    open_now = peak = 0
    for _, d in events:
        open_now += d
        peak = max(peak, open_now)
    assert peak <= 2


def test_portfolio_backtest_single_pair_trades_like_single_backtest():
    data = _data(1)
    res = run_portfolio_backtest(data, StrategyParams(), RiskParams(), max_positions=1)
    assert all(isinstance(t, Trade) for t in res.trades)
    assert res.trades


# ---------- журнал ----------

def test_journal_and_summary(tmp_path):
    j = TradeJournal(tmp_path / "t.csv")
    j.append("BTC-USDT", 0, 100, 110, 1, 100, 109, "signal")
    j.append("ETH-USDT", 0, 10, 9, 10, 100, 89, "stop")
    rows = j.read()
    assert [r["symbol"] for r in rows] == ["BTC-USDT", "ETH-USDT"]
    text = summarize(rows, 1000, equity=990)
    assert "Закрытых сделок:     2" in text and "50.0%" in text and "BTC-USDT" in text


# ---------- торговый цикл auto ----------

class MultiClient:
    def __init__(self, data, step=3600):
        self.data = data
        self.prices = {s: c[-1].close for s, c in data.items()}
        self.candle_calls = []

    def get_all_tickers(self):
        return {s: tick(p) for s, p in self.prices.items()}

    def get_all_symbols(self):
        return {s: info(s.split("-")[0]) for s in self.data}

    def get_candles(self, symbol, interval, start=None, end=None, closed_only=True):
        self.candle_calls.append(symbol)
        return self.data[symbol]


def make_trader(tmp_path, data, max_positions=2):
    cfg = load_config(tmp_path / "none.env")
    cfg.timeframe = "1hour"
    cfg.max_positions = max_positions
    cfg.universe = UniverseParams(min_volume=0)
    client = MultiClient(data)
    t = AutoTrader(cfg, client, PaperExecutor(0.001, 0), 1000, tmp_path / "s.json", tmp_path / "j.csv")
    return t, client


def test_auto_trader_opens_limited_positions_and_closes_on_stop(tmp_path, monkeypatch):
    monkeypatch.setattr("bot.portfolio.time.sleep", lambda s: None)
    data = _data(3, length=400)
    now = max(c[-1].ts for c in data.values()) + 3600 + 60
    trader, client = make_trader(tmp_path, data)
    monkeypatch.setattr(TrendSignals, "entry", lambda self, i: True)
    monkeypatch.setattr(TrendSignals, "exit", lambda self, i: False)

    trader.step(now)
    assert len(trader.positions) == 2  # сигналы по всем трём, но мест только два
    first = set(trader.positions)

    # повторный шаг в той же свече не пересчитывает сигналы
    calls = len(client.candle_calls)
    trader.step(now + 10)
    assert len(client.candle_calls) == calls

    # перезапуск восстанавливает портфель
    t2, _ = make_trader(tmp_path, data)
    t2.client = client
    assert set(t2.positions) == first

    # цена одной монеты ниже стопа — позиция закрыта и записана в журнал
    victim = sorted(first)[0]
    client.prices[victim] = t2.positions[victim].stop * 0.9
    t2.step(now + 20)
    assert victim not in t2.positions
    rows = TradeJournal(tmp_path / "j.csv").read()
    assert rows[-1]["symbol"] == victim and rows[-1]["reason"] == "stop"
    assert float(rows[-1]["pnl"]) < 0
    state = json.loads((tmp_path / "s.json").read_text())
    assert state["realized_pnl"] == pytest.approx(float(rows[-1]["pnl"]))


def test_auto_trader_skips_stale_pairs(tmp_path, monkeypatch):
    monkeypatch.setattr("bot.portfolio.time.sleep", lambda s: None)
    data = _data(2, length=400)
    now = max(c[-1].ts for c in data.values()) + 3600 + 60
    stale = sorted(data)[0]
    data[stale] = data[stale][:-10]  # по паре давно нет свечей
    trader, _ = make_trader(tmp_path, data)
    monkeypatch.setattr(TrendSignals, "entry", lambda self, i: True)
    trader.step(now)
    assert stale not in trader.positions and len(trader.positions) == 1


def test_paper_executor_pays_spread():
    ex = PaperExecutor(fee_rate=0, slippage=0)
    t = tick(100, spread=0.01)
    buy = ex.buy("X-USDT", 100, t)
    sell = ex.sell("X-USDT", buy.qty, t)
    assert sell.funds < 100
