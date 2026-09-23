"""Исполнение ордеров. PaperBroker имитирует сделки на реальных котировках,
LiveBroker отправляет настоящие рыночные ордера на KuCoin."""
import logging
import time
from decimal import Decimal, ROUND_DOWN

from .models import Fill

log = logging.getLogger(__name__)


def round_down(value, increment):
    inc = Decimal(str(increment))
    return str((Decimal(str(value)) / inc).to_integral_value(ROUND_DOWN) * inc)


class PaperBroker:
    def __init__(self, client, symbol, balance, fee_rate=0.001, slippage=0.0005):
        self.client = client
        self.symbol = symbol
        self.fee_rate = fee_rate
        self.slippage = slippage
        self.quote = balance
        self.base = 0.0

    def to_dict(self):
        return {"quote": self.quote, "base": self.base}

    def get_price(self):
        return self.client.get_price(self.symbol)

    def cash(self):
        return self.quote

    def market_buy(self, funds):
        price = self.get_price() * (1 + self.slippage)
        funds = min(funds, self.quote / (1 + self.fee_rate))
        fee = funds * self.fee_rate
        qty = funds / price
        self.quote -= funds + fee
        self.base += qty
        return Fill(qty, price, funds, fee)

    def market_sell(self, qty):
        qty = min(qty, self.base)
        price = self.get_price() * (1 - self.slippage)
        funds = qty * price
        fee = funds * self.fee_rate
        self.base -= qty
        self.quote += funds - fee
        return Fill(qty, price, funds, fee)


class LiveBroker:
    def __init__(self, client, symbol, max_capital):
        self.client = client
        self.symbol = symbol
        self.base_ccy, self.quote_ccy = symbol.split("-")
        self.max_capital = max_capital
        info = client.get_symbol_info(symbol)
        self.base_inc = info["baseIncrement"]
        self.quote_inc = info["quoteIncrement"]
        self.base_min = float(info["baseMinSize"])
        self.quote_min = float(info.get("minFunds") or info["quoteMinSize"])

    def to_dict(self):
        return {}

    def get_price(self):
        return self.client.get_price(self.symbol)

    def cash(self):
        """Свободные средства, но не больше лимита MAX_CAPITAL."""
        return min(self.client.get_available(self.quote_ccy), self.max_capital)

    def _wait_fill(self, order_id, timeout=30):
        deadline = time.time() + timeout
        while True:
            o = self.client.get_order(order_id)
            if not o.get("isActive") or time.time() > deadline:
                break
            time.sleep(1)
        deal_size = float(o["dealSize"])
        funds = float(o["dealFunds"])
        price = funds / deal_size if deal_size else 0.0
        qty, fee = deal_size, float(o.get("fee") or 0)
        if o.get("feeCurrency") == self.base_ccy:  # комиссия удержана в базовой валюте
            qty -= fee
            fee *= price
        return Fill(qty, price, funds, fee)

    def market_buy(self, funds):
        funds_str = round_down(funds, self.quote_inc)
        if float(funds_str) < self.quote_min:
            raise ValueError(f"сумма {funds_str} меньше минимальной {self.quote_min}")
        order_id = self.client.market_order(self.symbol, "buy", funds=funds_str)
        log.info("BUY ордер %s на %s %s", order_id, funds_str, self.quote_ccy)
        return self._wait_fill(order_id)

    def market_sell(self, qty):
        qty = min(qty, self.client.get_available(self.base_ccy))
        size_str = round_down(qty, self.base_inc)
        if float(size_str) < self.base_min:
            raise ValueError(f"объём {size_str} меньше минимального {self.base_min}")
        order_id = self.client.market_order(self.symbol, "sell", size=size_str)
        log.info("SELL ордер %s на %s %s", order_id, size_str, self.base_ccy)
        return self._wait_fill(order_id)
