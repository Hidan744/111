import math
import random

from bot.models import Candle


def synthetic_candles(n=3000, seed=1, start=100.0, step=3600):
    """Случайное блуждание со сменой режимов тренда."""
    rnd = random.Random(seed)
    price, out = start, []
    drift = 0.0
    for i in range(n):
        if i % 300 == 0:
            drift = rnd.choice([-0.002, 0.0, 0.003])
        o = price
        c = max(0.01, o * math.exp(drift + rnd.gauss(0, 0.01)))
        h = max(o, c) * (1 + abs(rnd.gauss(0, 0.004)))
        l = min(o, c) * (1 - abs(rnd.gauss(0, 0.004)))
        out.append(Candle(1_600_000_000 + i * step, o, h, l, c, 1.0))
        price = c
    return out


class FakeClient:
    def __init__(self, candles=None, price=100.0):
        self.candles = candles or []
        self.price = price
        self.orders = []
        self.available = {"USDT": 1000.0, "BTC": 0.0}

    def get_price(self, symbol):
        return self.price

    def get_candles(self, symbol, interval, start=None, end=None, closed_only=True):
        return self.candles

    def get_symbol_info(self, symbol):
        return {"baseIncrement": "0.00001", "quoteIncrement": "0.01",
                "baseMinSize": "0.00001", "quoteMinSize": "0.1", "minFunds": "0.1"}

    def get_available(self, ccy):
        return self.available[ccy]

    def market_order(self, symbol, side, funds=None, size=None):
        self.orders.append((side, funds, size))
        return f"o{len(self.orders)}"

    def get_order(self, order_id):
        side, funds, size = self.orders[int(order_id[1:]) - 1]
        if side == "buy":
            f = float(funds)
            return {"isActive": False, "dealSize": str(f / self.price), "dealFunds": funds,
                    "fee": str(f * 0.001), "feeCurrency": "USDT"}
        s = float(size)
        return {"isActive": False, "dealSize": size, "dealFunds": str(s * self.price),
                "fee": str(s * self.price * 0.001), "feeCurrency": "USDT"}
