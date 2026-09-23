"""Минимальный клиент KuCoin Spot REST API (без сторонних SDK)."""
import base64
import hashlib
import hmac
import json
import time
import uuid

import requests

from .models import Candle

BASE_URL = "https://api.kucoin.com"

INTERVAL_SECONDS = {
    "1min": 60, "3min": 180, "5min": 300, "15min": 900, "30min": 1800,
    "1hour": 3600, "2hour": 7200, "4hour": 14400, "6hour": 21600,
    "8hour": 28800, "12hour": 43200, "1day": 86400, "1week": 604800,
}


class KucoinError(Exception):
    pass


def sign(secret, message):
    return base64.b64encode(hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()).decode()


class KucoinClient:
    def __init__(self, api_key="", api_secret="", api_passphrase="", base_url=BASE_URL, session=None, timeout=10):
        self.api_key = api_key
        self.api_secret = api_secret
        self.api_passphrase = api_passphrase
        self.base_url = base_url
        self.session = session or requests.Session()
        self.timeout = timeout

    # ---------- транспорт ----------

    def _request(self, method, path, params=None, body=None, signed=False):
        query = ""
        if params:
            query = "?" + "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        endpoint = path + query
        body_str = json.dumps(body, separators=(",", ":")) if body else ""
        headers = {"Content-Type": "application/json"}
        if signed:
            if not (self.api_key and self.api_secret and self.api_passphrase):
                raise KucoinError("не заданы API-ключи KuCoin")
            ts = str(int(time.time() * 1000))
            headers.update({
                "KC-API-KEY": self.api_key,
                "KC-API-SIGN": sign(self.api_secret, ts + method + endpoint + body_str),
                "KC-API-TIMESTAMP": ts,
                "KC-API-PASSPHRASE": sign(self.api_secret, self.api_passphrase),
                "KC-API-KEY-VERSION": "2",
            })
        resp = self.session.request(method, self.base_url + endpoint, data=body_str or None,
                                    headers=headers, timeout=self.timeout)
        try:
            payload = resp.json()
        except ValueError:
            raise KucoinError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        if payload.get("code") != "200000":
            raise KucoinError(f"{payload.get('code')}: {payload.get('msg')}")
        return payload.get("data")

    # ---------- публичные методы ----------

    def get_price(self, symbol):
        data = self._request("GET", "/api/v1/market/orderbook/level1", {"symbol": symbol})
        if not data or data.get("price") is None:
            raise KucoinError(f"нет цены для пары {symbol} — проверьте название пары")
        return float(data["price"])

    def get_symbol_info(self, symbol):
        """Параметры пары или None, если такой пары на бирже нет."""
        return self._request("GET", f"/api/v2/symbols/{symbol}")

    def get_all_tickers(self):
        """Цены и обороты всех пар одним запросом: {пара: {last, buy, sell, vol_value}}."""
        data = self._request("GET", "/api/v1/market/allTickers") or {}
        f = lambda v: float(v) if v not in (None, "") else 0.0
        return {t["symbol"]: {"last": f(t.get("last")), "buy": f(t.get("buy")), "sell": f(t.get("sell")),
                              "vol_value": f(t.get("volValue"))}
                for t in data.get("ticker", [])}

    def get_all_symbols(self):
        """Параметры всех пар: {пара: {baseCurrency, quoteCurrency, enableTrading, baseIncrement, ...}}."""
        return {s["symbol"]: s for s in self._request("GET", "/api/v2/symbols") or []}

    def get_candles(self, symbol, interval, start=None, end=None, closed_only=True):
        """Свечи от старых к новым. Биржа отдаёт до 1500 штук за запрос, поэтому
        длинные периоды загружаются постранично."""
        step = INTERVAL_SECONDS[interval]
        now = int(time.time())
        end = end or now
        start = start or end - step * 1500
        result = {}
        cursor = end
        while cursor > start:
            rows = self._request("GET", "/api/v1/market/candles",
                                 {"type": interval, "symbol": symbol, "startAt": start, "endAt": cursor})
            if not rows:
                break
            for r in rows:
                # [время, open, close, high, low, volume, turnover]
                c = Candle(int(r[0]), float(r[1]), float(r[3]), float(r[4]), float(r[2]), float(r[5]))
                result[c.ts] = c
            oldest = min(int(r[0]) for r in rows)
            if oldest >= cursor or len(rows) < 1500:
                break
            cursor = oldest - 1
            time.sleep(0.3)  # бережём лимиты API
        candles = sorted(result.values(), key=lambda c: c.ts)
        if closed_only:
            candles = [c for c in candles if c.ts + step <= now]
        return candles

    # ---------- приватные методы ----------

    def get_available(self, currency):
        rows = self._request("GET", "/api/v1/accounts", {"currency": currency, "type": "trade"}, signed=True)
        return sum(float(r["available"]) for r in rows or [])

    def market_order(self, symbol, side, funds=None, size=None):
        body = {"clientOid": uuid.uuid4().hex, "side": side, "symbol": symbol, "type": "market"}
        if funds is not None:
            body["funds"] = funds
        if size is not None:
            body["size"] = size
        return self._request("POST", "/api/v1/orders", body=body, signed=True)["orderId"]

    def get_order(self, order_id):
        return self._request("GET", f"/api/v1/orders/{order_id}", signed=True)
