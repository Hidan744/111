"""Журнал закрытых сделок (CSV) и статистика по нему."""
import csv
import math
import time
from pathlib import Path

FIELDS = ["closed_at", "symbol", "opened_at", "entry", "exit", "qty", "cost", "proceeds", "pnl", "pnl_pct", "reason"]


class TradeJournal:
    def __init__(self, path):
        self.path = Path(path)

    def append(self, symbol, opened_ts, entry, exit_price, qty, cost, proceeds, reason, closed_ts=None):
        new = not self.path.exists()
        fmt = lambda ts: time.strftime("%Y-%m-%d %H:%M", time.gmtime(ts))
        pnl = proceeds - cost
        with self.path.open("a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new:
                w.writerow(FIELDS)
            w.writerow([fmt(closed_ts or time.time()), symbol, fmt(opened_ts), f"{entry:.10g}", f"{exit_price:.10g}",
                        f"{qty:.10g}", f"{cost:.6f}", f"{proceeds:.6f}", f"{pnl:.6f}",
                        f"{pnl / cost if cost else 0:.6f}", reason])

    def read(self):
        if not self.path.exists():
            return []
        with self.path.open(newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))


def summarize(rows, start_balance, equity=None):
    pnls = [float(r["pnl"]) for r in rows]
    wins = [p for p in pnls if p > 0]
    losses = [-p for p in pnls if p < 0]
    total = sum(pnls)
    pf = sum(wins) / sum(losses) if losses else (math.inf if wins else 0.0)
    lines = [
        f"Закрытых сделок:     {len(rows)}",
        f"Доля прибыльных:     {len(wins) / len(rows):.1%}" if rows else "Доля прибыльных:     —",
        f"Profit factor:       {'inf' if pf == math.inf else f'{pf:.2f}'}",
        f"Средняя прибыль:     {sum(wins) / len(wins):+.2f}" if wins else "Средняя прибыль:     —",
        f"Средний убыток:      {-sum(losses) / len(losses):+.2f}" if losses else "Средний убыток:      —",
        f"Итог по закрытым:    {total:+.2f} ({total / start_balance:+.2%} от {start_balance:.0f})",
    ]
    if equity is not None:
        lines.append(f"Капитал сейчас:      {equity:.2f} ({equity / start_balance - 1:+.2%}), с учётом открытых")
    return "\n".join(lines + pairs_report(rows))


def pairs_report(rows):
    lines = []
    by_sym = {}
    for r in rows:
        s = by_sym.setdefault(r["symbol"], [0, 0.0])
        s[0] += 1
        s[1] += float(r["pnl"])
    if by_sym:
        ranked = sorted(by_sym.items(), key=lambda kv: kv[1][1], reverse=True)
        lines.append("\nЛучшие пары:")
        lines += [f"  {s:<14} сделок {n:>3}  {p:+.2f}" for s, (n, p) in ranked[:5]]
        if len(ranked) > 5:
            lines.append("Худшие пары:")
            lines += [f"  {s:<14} сделок {n:>3}  {p:+.2f}" for s, (n, p) in ranked[-5:][::-1]]
    return lines
