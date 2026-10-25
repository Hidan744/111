# Сводка серий быстрых карьер: python3 tests/mc-summary.py <папка с json>
import json, sys, glob, os, statistics as st
def pct(a, q):
    a = sorted(a); return a[min(len(a)-1, int(q*len(a)))] if a else None
rows = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.json'))):
    try: d = json.load(open(f))
    except Exception as e: print('bad', f, e); continue
    team, pol, res = d['team'], d['policy'], d['res']
    errs = [r['error'][:120] for r in res if r.get('error')]
    for h in (1, 3, 5):
        alive = [r for r in res if len(r['seasons']) >= h]
        dead = sum(1 for r in res if r['stopped'] and len(r['seasons']) <= h)
        bud = [r['seasons'][h-1]['afterSeason'] for r in alive]
        cpos = [r['seasons'][h-1]['cpos'] for r in alive]
        gap = [r['seasons'][h-1]['car'] - r['seasons'][h-1]['carBest'] for r in alive]
        if not alive: rows.append((team, pol, h, len(res), dead, None)); continue
        rows.append((team, pol, h, len(res), dead, dict(
            budget_mean=round(st.mean(bud), 1), budget_p10=round(pct(bud, .1), 1), budget_p90=round(pct(bud, .9), 1),
            neg_share=round(sum(1 for b in bud if b < 0)/len(bud), 2),
            cpos_mean=round(st.mean(cpos), 2), cpos_best=min(cpos), cpos_worst=max(cpos),
            car_gap=round(st.mean(gap), 1))))
    if errs: print('ERRORS', team, pol, errs[:2])
    # гонка: сходы, места, стратегии (по всем сезонам)
    S = [s for r in res for s in r['seasons']]
    if S:
        dnf = sum(s['dnf'] for s in S)/max(1, sum(s['starts'] for s in S))
        alld = sum(s.get('allDnf', 0) for s in S)/max(1, sum(s.get('allStarts', 1) for s in S))
        pos = [p for s in S for p in s['pos']]
        stops = {}
        for s in S:
            for k, v in s['stops'].items(): stops[k] = stops.get(k, 0)+v
        tot = sum(stops.values())
        print(f"RACE {team:>4} {pol:<6} dnf_mine={dnf:.3f} dnf_all={alld:.3f} finish: wins={sum(1 for p in pos if p==1)/len(pos):.3f} pod={sum(1 for p in pos if p<=3)/len(pos):.3f} pts={sum(1 for p in pos if p<=10)/len(pos):.3f} stops={ {k: round(v/tot, 2) for k, v in sorted(stops.items())} }")
print()
print('team policy horizon runs out(bankrupt/fired) | budget mean [p10..p90] neg | constructors pos mean (best..worst) | car gap to best')
for t, p, h, n, dead, m in rows:
    if m: print(f"{t:>4} {p:<6} {h} {n:>3} out={dead:>3} | {m['budget_mean']:>7} [{m['budget_p10']}..{m['budget_p90']}] neg={m['neg_share']} | {m['cpos_mean']} ({m['cpos_best']}..{m['cpos_worst']}) | {m['car_gap']}")
    else: print(f"{t:>4} {p:<6} {h} {n:>3} out={dead:>3} | all stopped")
