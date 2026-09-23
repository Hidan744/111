"""Настройки бота из переменных окружения и файла .env."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from .risk import RiskParams
from .strategy import StrategyParams


def load_dotenv(path=".env"):
    """Минимальный загрузчик .env: KEY=VALUE, строки с # игнорируются.
    Уже заданные переменные окружения не перезаписываются."""
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _f(name, default):
    return float(os.environ.get(name, default))


def _i(name, default):
    return int(os.environ.get(name, default))


@dataclass
class Config:
    api_key: str = ""
    api_secret: str = ""
    api_passphrase: str = ""
    symbol: str = "BTC-USDT"
    timeframe: str = "1hour"
    fee_rate: float = 0.001
    slippage: float = 0.0005
    paper_balance: float = 1000.0
    max_capital: float = 100.0
    poll_seconds: int = 20
    live_trading: bool = False
    strategy: StrategyParams = field(default_factory=StrategyParams)
    risk: RiskParams = field(default_factory=RiskParams)

    @property
    def has_keys(self):
        return bool(self.api_key and self.api_secret and self.api_passphrase)


def load_config(env_file=".env"):
    load_dotenv(env_file)
    e = os.environ
    return Config(
        api_key=e.get("KUCOIN_API_KEY", ""),
        api_secret=e.get("KUCOIN_API_SECRET", ""),
        api_passphrase=e.get("KUCOIN_API_PASSPHRASE", ""),
        symbol=e.get("SYMBOL", "BTC-USDT").upper(),
        timeframe=e.get("TIMEFRAME", "1hour"),
        fee_rate=_f("FEE_RATE", 0.001),
        slippage=_f("SLIPPAGE", 0.0005),
        paper_balance=_f("PAPER_BALANCE", 1000),
        max_capital=_f("MAX_CAPITAL", 100),
        poll_seconds=_i("POLL_SECONDS", 20),
        live_trading=e.get("LIVE_TRADING", "no").strip().lower() == "yes",
        strategy=StrategyParams(
            name=e.get("STRATEGY", "trend").strip().lower(),
            fast_ema=_i("FAST_EMA", 12),
            slow_ema=_i("SLOW_EMA", 26),
            trend_ema=_i("TREND_EMA", 200),
            rsi_period=_i("RSI_PERIOD", 14),
            rsi_max=_f("RSI_MAX", 70),
            rsi_min=_f("RSI_MIN", 30),
            bb_period=_i("BB_PERIOD", 20),
            bb_std=_f("BB_STD", 2.0),
            donchian_entry=_i("DONCHIAN_ENTRY", 20),
            donchian_exit=_i("DONCHIAN_EXIT", 10),
            atr_period=_i("ATR_PERIOD", 14),
            stop_atr=_f("STOP_ATR", 2.0),
            take_atr=_f("TAKE_ATR", 4.0),
            trail_atr=_f("TRAIL_ATR", 0),
        ),
        risk=RiskParams(
            risk_per_trade=_f("RISK_PER_TRADE", 0.01),
            max_position_pct=_f("MAX_POSITION_PCT", 0.5),
            max_daily_loss=_f("MAX_DAILY_LOSS", 0.03),
            max_drawdown=_f("MAX_DRAWDOWN", 0.15),
        ),
    )
