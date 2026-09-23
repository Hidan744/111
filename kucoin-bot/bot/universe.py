"""Автоматический отбор торгуемых пар со всей биржи.

Берутся пары к QUOTE (USDT), по которым разрешена торговля, с дневным оборотом
не меньше MIN_VOLUME_USDT и спредом не больше MAX_SPREAD. Стейблкоины и
плечевые токены (BTC3L, ETH3S и т.п.) исключаются. Из оставшихся — MAX_PAIRS
самых ликвидных. Неликвидные монеты отсеиваются потому, что на них бэктест
рисует прибыль, которую в реальности съедают спред и проскальзывание."""
import re
from dataclasses import dataclass, field

STABLES = {
    "USDT", "USDC", "TUSD", "DAI", "FDUSD", "USDD", "PYUSD", "USDE", "USDP", "BUSD", "UST", "USTC",
    "EUR", "EURT", "EURC", "GBP", "AEUR", "USD1", "RLUSD", "USDS", "USDJ", "XUSD", "SUSD", "LUSD",
    "PAXG", "XAUT",  # привязаны к золоту — не трендовые активы
}
LEVERAGED = re.compile(r"\d+[LS]$")


@dataclass
class UniverseParams:
    quote: str = "USDT"
    min_volume: float = 2_000_000.0
    max_pairs: int = 40
    max_spread: float = 0.003
    exclude: set = field(default_factory=set)


def select_universe(tickers, symbols, up: UniverseParams):
    """tickers: {пара: {last, buy, sell, vol_value}}, symbols: {пара: параметры пары с биржи}.
    Возвращает список пар, отсортированный по обороту (самые ликвидные первыми)."""
    picked = []
    for sym, t in tickers.items():
        info = symbols.get(sym)
        if not info or not info.get("enableTrading", True):
            continue
        base, quote = info.get("baseCurrency"), info.get("quoteCurrency")
        if quote != up.quote or base in STABLES or LEVERAGED.search(base or "") or sym in up.exclude:
            continue
        if not t.get("last") or t.get("vol_value", 0) < up.min_volume:
            continue
        bid, ask = t.get("buy"), t.get("sell")
        if not bid or not ask or (ask - bid) / ask > up.max_spread:
            continue
        picked.append((t["vol_value"], sym))
    picked.sort(reverse=True)
    return [s for _, s in picked[:up.max_pairs]]
