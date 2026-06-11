"""
Renders the GymJam performance metric across design iterations:

    "Time taken to set next week's pledge in a group" (seconds, lower = better)

Reads data.csv (5 timed task runs per iteration), plots the mean with std-dev
error bars, and annotates the key story beats. Run:

    backend/venv/bin/python docs/performance-metric/plot.py
"""
import csv
import statistics
from pathlib import Path

import matplotlib.pyplot as plt

HERE = Path(__file__).parent
ROWS = list(csv.DictReader(open(HERE / "data.csv")))

iters = [int(r["iteration"]) for r in ROWS]
labels = [f'v{r["iteration"]}\n{r["issue"]}' for r in ROWS]
samples = [[float(r[f"t{i}"]) for i in range(1, 6)] for r in ROWS]
means = [statistics.mean(s) for s in samples]
stds = [statistics.pstdev(s) for s in samples]

# ── figure ────────────────────────────────────────────────────────────────
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11})
fig, ax = plt.subplots(figsize=(10, 5.6), dpi=150)

INK, ACCENT, SAGE, DANGER = "#1B1714", "#E89B7C", "#6F8A66", "#C77A6F"

# faint individual runs (shows the spread that the error bars summarise)
for x, s in zip(iters, samples):
    ax.scatter([x] * len(s), s, color=ACCENT, alpha=0.28, s=26, zorder=2)

ax.errorbar(
    iters, means, yerr=stds, color=INK, ecolor="#928374",
    elinewidth=1.4, capsize=5, marker="o", markersize=8,
    markerfacecolor=ACCENT, markeredgecolor=INK, linewidth=2.4, zorder=3,
)

# value labels above each point
for x, m in zip(iters, means):
    ax.annotate(f"{m:.1f}s", (x, m), textcoords="offset points",
                xytext=(0, 14), ha="center", fontsize=10, fontweight="bold", color=INK)

# story annotations (regression at v3 = #42, fix at v4 = #43)
ax.annotate(
    "Regression: ELO-vs-money\nchoice added a decision step",
    xy=(3, means[2]), xytext=(2.1, means[2] + 11),
    fontsize=9, color=DANGER, ha="center",
    arrowprops=dict(arrowstyle="->", color=DANGER, lw=1.3),
)
ax.annotate(
    "£1–£20 slider + defaults\nreplaced free-text entry",
    xy=(4, means[3]), xytext=(4.3, means[3] + 13),
    fontsize=9, color=SAGE, ha="center",
    arrowprops=dict(arrowstyle="->", color=SAGE, lw=1.3),
)

# overall improvement bracket
ax.annotate(
    "", xy=(6, means[5]), xytext=(6, means[0]),
    arrowprops=dict(arrowstyle="<->", color="#928374", lw=1.1, linestyle=(0, (4, 3))),
)
drop = (means[0] - means[5]) / means[0] * 100
ax.text(6.12, (means[0] + means[5]) / 2, f"−{drop:.0f}%\noverall",
        fontsize=9, color="#5C5048", va="center")

ax.set_xticks(iters)
ax.set_xticklabels(labels, fontsize=9)
ax.set_ylim(0, max(max(s) for s in samples) + 12)
ax.set_xlim(0.5, 6.9)
ax.set_ylabel("Time to set next week's pledge (seconds)")
ax.set_xlabel("Design iteration (issue #)")
ax.set_title("Task-completion time per iteration  ·  n = 5 timed runs each (mean ± SD)",
             fontweight="bold", pad=12)
ax.grid(axis="y", color="#000000", alpha=0.08)
for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)

fig.tight_layout()
out = HERE / "pledge_time.png"
fig.savefig(out, bbox_inches="tight")
print(f"wrote {out}")
print("means:", [round(m, 1) for m in means])
print("stds: ", [round(s, 1) for s in stds])
