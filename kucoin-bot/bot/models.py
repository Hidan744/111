from dataclasses import dataclass, asdict


@dataclass
class Candle:
    ts: int  # время открытия свечи, unix-секунды
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Position:
    entry_price: float
    qty: float
    stop: float
    take: float
    highest: float
    opened_ts: int
    cost: float  # сколько котируемой валюты потрачено, включая комиссию

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        return cls(**d)


@dataclass
class Fill:
    qty: float     # количество базовой валюты
    price: float   # средняя цена
    funds: float   # оборот в котируемой валюте (без комиссии)
    fee: float     # комиссия в котируемой валюте
