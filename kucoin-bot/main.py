"""KuCoin spot-бот.

  python main.py download --days 365          # скачать историю в data/
  python main.py backtest --days 365          # проверить стратегию на истории
  python main.py backtest --csv data/x.csv    # бэктест по сохранённому файлу
  python main.py compare --days 730           # сравнить все стратегии на одной истории
  python main.py --symbol ETH-USDT --timeframe 4hour compare --days 730
  python main.py scan --days 730              # все стратегии x пары x таймфреймы одной таблицей
  python main.py --set TAKE_ATR=0 --set TRAIL_ATR=3 scan   # любые параметры из .env на один запуск
  python main.py paper                        # бумажная торговля на живых котировках
  python main.py live --confirm               # реальная торговля (нужен LIVE_TRADING=yes)
"""
import argparse
import logging
import os
import sys
import time
from pathlib import Path

from bot.backtest import compare, load_csv, run_backtest, save_csv, scan
from bot.brokers import LiveBroker, PaperBroker
from bot.config import load_config
from bot.kucoin_client import INTERVAL_SECONDS, KucoinClient
from bot.strategy import STRATEGIES
from bot.runner import Trader


def setup_logging(log_file=None):
    handlers = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, handlers=handlers,
                        format="%(asctime)s %(levelname)s %(message)s")


def fetch_history(cfg, client, days, symbol=None, timeframe=None):
    """История с кэшем в data/: повторные запуски в течение 12 часов не качают заново."""
    symbol, timeframe = symbol or cfg.symbol, timeframe or cfg.timeframe
    path = Path("data") / f"{symbol}_{timeframe}_{days}d.csv"
    if path.exists() and time.time() - path.stat().st_mtime < 12 * 3600:
        return load_csv(path)
    end = int(time.time())
    candles = client.get_candles(symbol, timeframe, start=end - days * 86400, end=end)
    path.parent.mkdir(exist_ok=True)
    save_csv(candles, path)
    return candles


def main():
    ap = argparse.ArgumentParser(description="Торговый бот для KuCoin Spot")
    ap.add_argument("--env", default=".env", help="файл с настройками")
    ap.add_argument("--symbol", help="торговая пара, например ETH-USDT (перекрывает SYMBOL из .env)")
    ap.add_argument("--timeframe", help="таймфрейм, например 4hour (перекрывает TIMEFRAME из .env)")
    ap.add_argument("--strategy", help="trend / meanrev / breakout (перекрывает STRATEGY из .env)")
    ap.add_argument("--set", action="append", default=[], metavar="КЛЮЧ=ЗНАЧЕНИЕ",
                    help="переопределить параметр из .env на один запуск, можно несколько раз")
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("download", help="скачать исторические свечи в CSV")
    d.add_argument("--days", type=int, default=365)
    b = sub.add_parser("backtest", help="проверка стратегии на истории")
    b.add_argument("--days", type=int, default=365)
    b.add_argument("--csv", help="CSV со свечами вместо загрузки с биржи")
    b.add_argument("--trades", action="store_true", help="вывести список сделок")
    cp = sub.add_parser("compare", help="сравнить все стратегии на одной истории")
    cp.add_argument("--days", type=int, default=730)
    cp.add_argument("--csv", help="CSV со свечами вместо загрузки с биржи")
    cp.add_argument("--parts", type=int, default=2, help="на сколько отрезков делить историю")
    sc = sub.add_parser("scan", help="все стратегии на нескольких парах и таймфреймах")
    sc.add_argument("--days", type=int, default=730)
    sc.add_argument("--symbols", default="BTC-USDT,ETH-USDT", help="через запятую")
    sc.add_argument("--timeframes", default="1hour,4hour,1day", help="через запятую")
    sub.add_parser("paper", help="бумажная торговля")
    lv = sub.add_parser("live", help="реальная торговля")
    lv.add_argument("--confirm", action="store_true", help="подтверждаю торговлю реальными деньгами")
    args = ap.parse_args()

    for item in args.set:
        key, _, value = item.partition("=")
        if not value:
            sys.exit(f"--set ожидает КЛЮЧ=ЗНАЧЕНИЕ, получено {item!r}")
        os.environ[key.strip().upper()] = value.strip()
    cfg = load_config(args.env)
    if args.symbol:
        cfg.symbol = args.symbol.upper()
    if args.timeframe:
        cfg.timeframe = args.timeframe
    if args.strategy:
        cfg.strategy.name = args.strategy.lower()
    if cfg.timeframe not in INTERVAL_SECONDS:
        sys.exit(f"Неизвестный TIMEFRAME={cfg.timeframe}. Допустимо: {', '.join(INTERVAL_SECONDS)}")
    if cfg.strategy.name not in STRATEGIES:
        sys.exit(f"Неизвестная STRATEGY={cfg.strategy.name}. Допустимо: {', '.join(STRATEGIES)}")
    client = KucoinClient(cfg.api_key, cfg.api_secret, cfg.api_passphrase)

    if args.cmd == "download":
        candles = fetch_history(cfg, client, args.days)
        print(f"Сохранено {len(candles)} свечей в data/{cfg.symbol}_{cfg.timeframe}_{args.days}d.csv")

    elif args.cmd == "backtest":
        candles = load_csv(args.csv) if args.csv else fetch_history(cfg, client, args.days)
        if len(candles) < cfg.strategy.min_candles():
            sys.exit(f"Мало данных: {len(candles)} свечей, нужно минимум {cfg.strategy.min_candles()}")
        res = run_backtest(candles, cfg.strategy, cfg.risk, cfg.paper_balance, cfg.fee_rate, cfg.slippage)
        fmt = lambda ts: time.strftime("%Y-%m-%d %H:%M", time.gmtime(ts))
        print(f"Стратегия: {cfg.strategy.name}")
        print(f"{cfg.symbol} {cfg.timeframe}: {fmt(candles[0].ts)} — {fmt(candles[-1].ts)}, {len(candles)} свечей")
        print(res.summary())
        if args.trades:
            for t in res.trades:
                print(f"{fmt(t.entry_ts)} -> {fmt(t.exit_ts)}  {t.entry:.6f} -> {t.exit:.6f}  "
                      f"{t.pnl:+.2f}  {t.reason}")

    elif args.cmd == "compare":
        candles = load_csv(args.csv) if args.csv else fetch_history(cfg, client, args.days)
        if len(candles) < cfg.strategy.min_candles() + 50:
            sys.exit(f"Мало данных: {len(candles)} свечей")
        print(f"{cfg.symbol} {cfg.timeframe}, комиссия {cfg.fee_rate:.2%}, проскальзывание {cfg.slippage:.2%}")
        print(compare(candles, cfg.strategy, cfg.risk, cfg.paper_balance, cfg.fee_rate, cfg.slippage, args.parts))

    elif args.cmd == "scan":
        datasets = []
        for symbol in [s.strip().upper() for s in args.symbols.split(",") if s.strip()]:
            for tf in [t.strip() for t in args.timeframes.split(",") if t.strip()]:
                if tf not in INTERVAL_SECONDS:
                    sys.exit(f"Неизвестный таймфрейм {tf}")
                print(f"Загрузка {symbol} {tf}...", flush=True)
                datasets.append((f"{symbol} {tf}", fetch_history(cfg, client, args.days, symbol, tf)))
        sp = cfg.strategy
        print(f"\nкомиссия {cfg.fee_rate:.2%}, стоп {sp.stop_atr} ATR, "
              f"тейк {sp.take_atr if sp.take_atr > 0 else 'выкл'} ATR, "
              f"трейлинг {sp.trail_atr if sp.trail_atr > 0 else 'выкл'} ATR, фильтр EMA {sp.trend_ema}\n")
        print(scan(datasets, cfg.strategy, cfg.risk, cfg.paper_balance, cfg.fee_rate, cfg.slippage))

    elif args.cmd == "paper":
        setup_logging(f"paper_{cfg.symbol}.log")
        broker = PaperBroker(client, cfg.symbol, cfg.paper_balance, cfg.fee_rate, cfg.slippage)
        Trader(cfg, client, broker, f"state_paper_{cfg.symbol}.json").run()

    elif args.cmd == "live":
        if not (args.confirm and cfg.live_trading):
            sys.exit("Реальная торговля выключена. Нужны LIVE_TRADING=yes в .env и флаг --confirm.")
        if not cfg.has_keys:
            sys.exit("Заполните KUCOIN_API_KEY / KUCOIN_API_SECRET / KUCOIN_API_PASSPHRASE в .env")
        setup_logging(f"live_{cfg.symbol}.log")
        broker = LiveBroker(client, cfg.symbol, cfg.max_capital)
        Trader(cfg, client, broker, f"state_live_{cfg.symbol}.json").run()


if __name__ == "__main__":
    main()
