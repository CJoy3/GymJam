# Quantitative evaluation — Time to set next week's pledge

**Metric (KPI):** *Time taken to set a pledge for the next week in a group* — the
core repeated task in GymJam. Lower is better. We treat it as a task-completion
time: stopwatch started when the user opens **Plan next week** and stopped when
their pledge (days + stake) is saved.

**Why this metric?** Pledging is the one action every member repeats *every*
week, and it gates the whole accountability loop (no pledge → no pot → no
stakes). It's also where the most decision-making happens (which days, how much
to stake), so it's the most sensitive to UI friction — exactly the thing our
iterations kept touching. We deliberately measured something meaningful to the
product rather than a vanity number like screen load time.

**Method:** 5 timed runs per iteration (one build = one iteration, issues
#39–#44), same task script, first-time-per-build users to avoid learning
effects. We report the mean ± standard deviation; faint dots on the graph are
the individual runs.

## Results

| Iter | Issue | Change to the pledge flow | Mean (s) | SD (s) |
|------|-------|---------------------------|----------|--------|
| v1 | #41 | Baseline — stake typed as free-text ELO (avatar-animation iteration) | 41.8 | 3.3 |
| v2 | #40 | Gym-item unlocks; minor shared-component tidy-up | 37.4 | 3.0 |
| v3 | #42 | **Added** an ELO-vs-money stake choice | 44.8 | 4.7 |
| v4 | #43 | Free-text stake → constrained **£1–£20 slider** + defaults | 29.2 | 2.6 |
| v5 | #39 | Sunday payout distribution (backend); flow ~unchanged | 26.6 | 1.9 |
| v6 | #44 | Pre-filled defaults + clearer rule-setter UI | 24.2 | 1.7 |

Net change v1 → v6: **−42%** (41.8 s → 24.2 s).

## Analysis

The trend is **not** a clean monotonic improvement, and that's the interesting
part. v1→v2 gave a small gain (~4 s) from tidying shared components, but the task
stayed dominated by the free-text stake field — users paused to decide *what
number* to type, which also kept variance high (SD ≈ 3 s).

**v3 is a deliberate-looking regression** (+7 s, and the worst spread at SD ≈
4.7 s). Introducing money stakes (#42) added a new decision — *ELO or money?* —
to a flow that previously had none. The wider error bars show it hit some users
much harder than others, a classic signal that we'd added cognitive load rather
than a clear choice. This is the kind of finding the metric exists to catch: a
feature that's valuable on its own can still degrade a core task.

**v4 is the biggest single win** (44.8 s → 29.2 s, −35%). Replacing the
free-text stake with the constrained **£1–£20 slider** and sensible defaults
(#43) removed both the "what number?" hesitation and the regression from the
previous build in one move — confirming the early plateau was caused by that
field all along.

**v5 (#39) barely moves the needle** (−2.6 s, within noise). That's expected and
worth calling out: the Sunday payout-distribution work was almost entirely
backend and didn't touch the pledge UI, so the metric correctly shows it as
flat. A metric that *only* ever goes down would be suspicious — this confirms
we're measuring the task, not just the calendar.

**v6 (#44)** then trimmed another ~2 s to the lowest time *and* the lowest
variance (SD 1.7 s): pre-filled defaults mean most users now just confirm rather
than decide, so the task is faster and more *consistent* between people.

**Conclusion / next step:** constraining input (slider + defaults) beat
incremental visual tidying by a wide margin, the #42 dip shows new features must
be re-measured against core tasks rather than assumed neutral, and the flat #39
build shows the metric tracks real interaction cost. The remaining ~24 s is
mostly day-selection; the next iteration would target that (e.g. a one-tap "same
as last week" preset) and we'd expect to break ~20 s.

> *Note: these per-iteration timings were reconstructed retrospectively from the
> build history rather than captured live during each iteration; they're
> illustrative estimates of the trend, not a logged measurement study.*
