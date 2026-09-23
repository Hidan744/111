import base64
import hashlib
import hmac
import json

import pytest

from bot import indicators as ind
from bot.backtest import load_csv, run_backtest, save_csv
from bot.brokers import LiveBroker, PaperBroker, round_down
from bot.config import load_config
from bot.kucoin_client import KucoinClient, sign
from bot.models import Candle, Position
from bot.risk import RiskGuard, RiskParams, position_funds
from bot.runner import Trader
from bot.backtest import compare
from bot.strategy import STRATEGIES, StrategyParams, TrendSignals, make_signals, update_trailing
from tests.helpers import FakeClient, synthetic_candles


# ---------- индикаторы ----------

def test_ema_of_constant_is_constant():
    out = ind.ema([5.0] * 20, 10)
    assert out[:9] == [None] * 9
    assert all(v == pytest.approx(5.0) for v in out[9:])


def test_rsi_extremes():
    assert ind.rsi(list(range(1, 30)), 14)[-1] == 100.0
    assert ind.rsi(list(range(30, 1, -1)), 14)[-1] == 0.0


def test_atr_constant_range():
    n = 30
    out = ind.atr([11.0] * n, [9.0] * n, [10.0] * n, 14)
    assert out[-1] == pytest.approx(2.0)


def test_indicators_have_no_lookahead():
    candles = synthetic_candles(600)
    for name in STRATEGIES:
        full = make_signals(candles, StrategyParams(name=name))
        part = make_signals(candles[:400], StrategyParams(name=name))
        for attr in ("trend", "rsi", "atr", "fast", "slow", "lower", "mid", "upper"):
            if hasattr(full, attr):
                assert getattr(full, attr)[:400] == getattr(part, attr), (name, attr)
        assert [full.entry(i) for i in range(400)] == [part.entry(i) for i in range(400)]


# ---------- риск ----------

def test_position_sizing_limits_risk():
    rp = RiskParams(risk_per_trade=0.01, max_position_pct=1.0)
    funds = position_funds(1000, 1000, entry=100, stop=95, rp=rp)
    # потеря при стопе = funds/entry*(entry-stop) = 1% капитала
    assert funds / 100 * 5 == pytest.approx(10)


def test_position_sizing_caps():
    rp = RiskParams(risk_per_trade=0.5, max_position_pct=0.3)
    assert position_funds(1000, 1000, 100, 99, rp) == pytest.approx(300)
    assert position_funds(1000, 50, 100, 99, rp) == pytest.approx(50)
    assert position_funds(1000, 1000, 100, 101, rp) == 0


def test_risk_guard_daily_and_drawdown():
    g = RiskGuard(RiskParams(max_daily_loss=0.03, max_drawdown=0.15))
    day = 1_700_000_000
    g.update(1000, day)
    assert g.can_open(990)[0]
    g.update(960, day + 60)
    assert not g.can_open(960)[0]
    g.update(960, day + 86400)  # новый день — лимит сбрасывается
    assert g.can_open(960)[0]
    g.update(840, day + 86400 + 60)
    assert g.halted and not g.can_open(2000)[0]


def test_trailing_stop_only_moves_up():
    pos = Position(100, 1, 95, 120, 100, 0, 100)
    p = StrategyParams(trail_atr=2)
    update_trailing(pos, 110, 1.0, p)
    assert pos.stop == 108
    update_trailing(pos, 105, 1.0, p)
    assert pos.stop == 108


# ---------- бэктест ----------

def test_backtest_runs_and_accounts_consistently():
    candles = synthetic_candles(3000)
    res = run_backtest(candles, StrategyParams(), RiskParams(), balance=1000)
    assert len(res.trades) > 0
    assert res.end_equity == pytest.approx(1000 + sum(t.pnl for t in res.trades))
    assert 0 <= res.max_drawdown < 1
    assert "Сделок" in res.summary()


def test_backtest_fees_reduce_result():
    candles = synthetic_candles(3000, seed=7)
    free = run_backtest(candles, StrategyParams(), RiskParams(), fee_rate=0, slippage=0)
    paid = run_backtest(candles, StrategyParams(), RiskParams(), fee_rate=0.002, slippage=0.001)
    assert paid.end_equity < free.end_equity


def test_csv_roundtrip(tmp_path):
    candles = synthetic_candles(10)
    path = tmp_path / "c.csv"
    save_csv(candles, path)
    assert load_csv(path) == candles


# ---------- API-клиент ----------

class FakeResp:
    def __init__(self, payload):
        self.payload, self.status_code, self.text = payload, 200, json.dumps(payload)

    def json(self):
        return self.payload


class RecordingSession:
    def __init__(self, payload):
        self.payload, self.calls = payload, []

    def request(self, method, url, data=None, headers=None, timeout=None):
        self.calls.append((method, url, data, headers))
        return FakeResp(self.payload)


def test_signed_request_headers():
    s = RecordingSession({"code": "200000", "data": {"orderId": "abc"}})
    c = KucoinClient("key", "secret", "pass", session=s)
    assert c.market_order("BTC-USDT", "buy", funds="10") == "abc"
    method, url, body, h = s.calls[0]
    expected = sign("secret", h["KC-API-TIMESTAMP"] + "POST" + "/api/v1/orders" + body)
    assert h["KC-API-SIGN"] == expected
    assert h["KC-API-PASSPHRASE"] == base64.b64encode(
        hmac.new(b"secret", b"pass", hashlib.sha256).digest()).decode()
    assert h["KC-API-KEY-VERSION"] == "2"
    assert json.loads(body)["type"] == "market"


def test_api_error_raises():
    s = RecordingSession({"code": "400100", "msg": "bad"})
    with pytest.raises(Exception, match="400100"):
        KucoinClient(session=s).get_price("BTC-USDT")


def test_candles_parsed_and_sorted():
    rows = [["200", "2", "3", "4", "1", "5", "6"], ["100", "1", "2", "3", "0.5", "5", "6"]]
    s = RecordingSession({"code": "200000", "data": rows})
    cs = KucoinClient(session=s).get_candles("BTC-USDT", "1min", start=0, end=1000, closed_only=False)
    assert [c.ts for c in cs] == [100, 200]
    assert cs[1] == Candle(200, 2.0, 4.0, 1.0, 3.0, 5.0)


# ---------- брокеры ----------

def test_round_down():
    assert round_down(0.123456789, "0.0001") == "0.1234"
    assert round_down(10.999, "0.01") == "10.99"


def test_paper_broker_roundtrip_loses_fees():
    b = PaperBroker(FakeClient(price=100), "BTC-USDT", 1000, fee_rate=0.001, slippage=0)
    fill = b.market_buy(500)
    assert b.base == pytest.approx(5)
    b.market_sell(fill.qty)
    assert b.base == pytest.approx(0)
    assert b.quote == pytest.approx(1000 - 0.5 - 0.5)


def test_live_broker_rounds_and_respects_minimums():
    client = FakeClient(price=100)
    b = LiveBroker(client, "BTC-USDT", max_capital=50)
    assert b.cash() == 50
    fill = b.market_buy(12.3456)
    assert client.orders[0] == ("buy", "12.34", None)
    assert fill.qty == pytest.approx(0.1234)
    client.available["BTC"] = 0.1234
    b.market_sell(1.0)  # продаём не больше, чем реально есть
    assert client.orders[1] == ("sell", None, "0.1234")
    with pytest.raises(ValueError):
        b.market_buy(0.01)


# ---------- торговый цикл ----------

def test_trader_opens_and_closes_with_persisted_state(tmp_path, monkeypatch):
    cfg = load_config(tmp_path / "missing.env")
    cfg.strategy = StrategyParams(trend_ema=0)
    candles = synthetic_candles(400)
    client = FakeClient(candles, price=candles[-1].close)
    broker = PaperBroker(client, "BTC-USDT", 1000, 0.001, 0)
    state = tmp_path / "state.json"
    trader = Trader(cfg, client, broker, state)

    monkeypatch.setattr(TrendSignals, "entry", lambda self, i: True)
    monkeypatch.setattr(TrendSignals, "exit", lambda self, i: False)
    trader.step()
    assert trader.position is not None
    assert broker.base > 0

    # перезапуск бота восстанавливает позицию и баланс
    broker2 = PaperBroker(client, "BTC-USDT", 1000, 0.001, 0)
    trader2 = Trader(cfg, client, broker2, state)
    assert trader2.position == trader.position
    assert broker2.base == pytest.approx(broker.base)

    # цена ниже стопа — позиция закрывается
    client.price = trader2.position.stop * 0.99
    trader2.step()
    assert trader2.position is None
    assert trader2.realized_pnl < 0


# ---------- новые стратегии ----------

def test_sma_and_bollinger():
    assert ind.sma([1, 2, 3, 4], 2) == [None, 1.5, 2.5, 3.5]
    lower, mid, upper = ind.bollinger([10.0] * 25, 20, 2)
    assert lower[-1] == mid[-1] == upper[-1] == pytest.approx(10.0)


def test_donchian_excludes_current_candle():
    assert ind.highest_prev([1, 5, 3, 9], 2) == [None, None, 5, 5]
    assert ind.lowest_prev([4, 2, 3, 1], 2) == [None, None, 2, 2]


def _candles_from_closes(closes):
    return [Candle(i * 3600, c, c * 1.001, c * 0.999, c, 1) for i, c in enumerate(closes)]


def test_meanrev_buys_dip_and_exits_at_mean():
    closes = [100 + (i % 2) * 0.5 for i in range(40)] + [96, 94] + [100] * 3
    sig = make_signals(_candles_from_closes(closes), StrategyParams(name="meanrev", trend_ema=0))
    dip = 41
    assert sig.entry(dip)
    assert not sig.exit(dip)
    assert sig.exit(dip + 3)


def test_breakout_enters_on_new_high_and_exits_on_new_low():
    closes = [100 + (i % 3) for i in range(30)] + [110] + [95]
    sig = make_signals(_candles_from_closes(closes), StrategyParams(name="breakout", trend_ema=0))
    assert sig.entry(30) and not sig.entry(29)
    assert sig.exit(31)


def test_unknown_strategy():
    with pytest.raises(ValueError):
        make_signals(synthetic_candles(10), StrategyParams(name="magic"))


@pytest.mark.parametrize("name", list(STRATEGIES))
def test_every_strategy_backtests_consistently(name):
    res = run_backtest(synthetic_candles(3000, seed=5), StrategyParams(name=name), RiskParams())
    assert len(res.trades) > 0
    assert res.end_equity == pytest.approx(1000 + sum(t.pnl for t in res.trades))


def test_backtest_start_index_skips_trading_before_it():
    candles = synthetic_candles(3000)
    res = run_backtest(candles, StrategyParams(), RiskParams(), start=2000)
    assert all(t.entry_ts >= candles[2000].ts for t in res.trades)
    assert len(res.equity_curve) == 1000


def test_compare_lists_all_strategies_and_parts():
    out = compare(synthetic_candles(2000), StrategyParams(), RiskParams(), parts=2)
    assert out.count("купить+ждать") == 3
    for name in STRATEGIES:
        assert out.count(name) == 3


# ---------- анализ ----------

def test_take_profit_can_be_disabled():
    import math
    sig = make_signals(synthetic_candles(300), StrategyParams(take_atr=0))
    stop, take = sig.levels(299, 100.0)
    assert take == math.inf and stop < 100


def test_trader_state_survives_disabled_take(tmp_path):
    import math
    cfg = load_config(tmp_path / "missing.env")
    client = FakeClient(synthetic_candles(10), price=100)
    t = Trader(cfg, client, PaperBroker(client, "BTC-USDT", 1000), tmp_path / "s.json")
    t.position = Position(100, 1, 95, math.inf, 100, 0, 100)
    t.save()
    t2 = Trader(cfg, client, PaperBroker(client, "BTC-USDT", 1000), tmp_path / "s.json")
    assert t2.position.take == math.inf


def test_compare_ignores_drawdown_halt():
    """Аварийная остановка не должна обрезать историю при сравнении стратегий."""
    candles = synthetic_candles(3000, seed=11)
    tight = RiskParams(max_drawdown=0.001)
    assert compare(candles, StrategyParams(), tight) == compare(candles, StrategyParams(), RiskParams(max_drawdown=0.9))


def test_scan_table():
    from bot.backtest import scan
    out = scan([("A 1hour", synthetic_candles(1500)), ("B 1day", synthetic_candles(50))],
               StrategyParams(), RiskParams())
    for name in STRATEGIES:
        assert out.count(name) == 1
    assert "держать" in out and "мало данных" in out


def test_timeframe_change_resets_candle_marker(tmp_path):
    cfg = load_config(tmp_path / "missing.env")
    client = FakeClient(synthetic_candles(10), price=100)
    cfg.timeframe = "1hour"
    t = Trader(cfg, client, PaperBroker(client, "BTC-USDT", 1000), tmp_path / "s.json")
    t.last_candle_ts = 123
    t.save()
    assert Trader(cfg, client, PaperBroker(client, "BTC-USDT", 1000), tmp_path / "s.json").last_candle_ts == 123
    cfg.timeframe = "4hour"
    assert Trader(cfg, client, PaperBroker(client, "BTC-USDT", 1000), tmp_path / "s.json").last_candle_ts == 0
