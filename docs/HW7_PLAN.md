# HW7 — Initial Agent Experiments (Plan)

## What HW7 is grading on

- **3 distinct experiments** with real reflection (what changed, what you expected, what actually happened).
- **≥6 agents on cloud, not just your laptop** — agents run on different instances.
- 1-page summary + 1-min unlisted YouTube video.

The "real experiments" bar is the load-bearing one. Random noise across 3 trials is not an experiment; comparing condition A vs B with a measurable outcome is.

## What we can measure on the platform

The platform's natural outcome variables, all already captured in D1:

| Variable | What it tells us |
|---|---|
| **Mutual-match rate** | Do both agents independently say "yes, IRL"? Primary outcome. |
| **Verdict agreement** | When they disagree, who said no and why? |
| **Decline rate on mismatched pairs** | Does the system honestly filter? |
| **Cost per date (USD)** | Practical deployment metric. |
| **Latency per turn (sec)** | Practical UX metric. |
| **Reasoning depth** | Qualitative — verdict reasoning length / specificity. |

Three coherent experiments, not random ones. They tell a story together: *does persona matter? which model is right? does honesty hold under stress?*

## Experiment 1 — Persona richness ablation

**Question:** Does giving the agent a richer persona produce better verdicts, or is the platform's persona schema overdesigned?

**Conditions:**
- **A (rich):** full persona JSON — bio, interests, values, lifestyleHabits, dealbreakers, idealFirstDate, preferenceNotes
- **B (medium):** bio + top 3 interests + age + location only
- **C (thin):** name + age + 1-line bio only

**Setup:** 10 fixed persona pairs (built deliberately to span compatibility from low to high). Same pair runs 3 times, once per condition. Same model (Haiku 4.5) throughout.

**Measure:** mutual-match rate, decline rate when conditions A-detect a real dealbreaker conflict, verdict reasoning length (a proxy for depth).

**Hypothesis:** Rich persona produces (1) higher decline rate on mismatched pairs (catches dealbreakers), (2) more specific reasoning. Thin persona produces over-agreeable verdicts because the agent has nothing to object to.

**Sample size:** 10 pairs × 3 conditions = **30 dates.**

## Experiment 2 — Haiku 4.5 vs Sonnet 4.6 (cost/latency/quality)

**Question:** Is paying ~5× more for Sonnet worth it for this use case?

**Conditions:**
- **A:** Claude Haiku 4.5 (current default in `my-agent.mjs`)
- **B:** Claude Sonnet 4.6 (10× more expensive per token)

**Setup:** Same 10 persona pairs from Experiment 1, run with each model. Rich-persona condition only.

**Measure:** cost per date (sum of input + output tokens × pricing), median latency per turn, verdict-agreement rate between models on identical pairs (do they reach the same conclusion?).

**Hypothesis:** Verdict agreement is high (~80%+ — both are clearly capable). Sonnet produces more nuanced reasoning but doesn't change end outcomes. Cost is ~5× higher. **Recommendation should be: ship Haiku.**

**Sample size:** 10 pairs × 2 models = **20 dates.**

## Experiment 3 — Honest verdict under dealbreaker conflict

**Question:** Does the platform actually surface honest verdicts when persona pairs have a clear conflict, or does the agent rubber-stamp anyway?

**Conditions:**
- **A:** Standard system prompt (current `my-agent.mjs`)
- **B:** Honesty-emphasized system prompt — explicitly reminds agent that polite verdicts waste humans' time

**Setup:** 10 deliberately-mismatched pairs constructed so one persona violates the other's stated dealbreaker (e.g., persona A.dealbreakers contains "smoking", persona B.lifestyleHabits.smoking is "regular"). Both conditions use the same pairs.

**Measure:** % of dates where the violating-side agent correctly returns `wouldMeetIrl: false`. Also track cases where the violator-side agent says yes (these are honesty failures).

**Hypothesis:** Standard prompt catches ~70% of dealbreaker conflicts. Honesty-emphasized prompt catches ≥90%. The 20-30% of "polite false-yes" verdicts represent real signal lost in the standard configuration.

**Sample size:** 10 pairs × 2 prompts = **20 dates.**

## Total sample size

**70 dates, ≤25 distinct agents** (we'll reuse personas across experiments, just changing the agent's model or prompt). Comfortably above HW7's "≥6 agents" floor.

## How we run these on the cloud

The HW7 spec is strict about agents running "on the cloud on different instances, not only locally on your laptop." Three-way mix:

1. **Cloudflare Worker with cron triggers** *(primary)* — a new worker, separate from the platform itself, that wakes up every 5 min and processes one experiment cohort's heartbeat. Same Cloudflare account, separate instance.
2. **GitHub Actions cron** *(secondary)* — 2-3 scheduled workflows in your fork that each run a different agent's heartbeat every 10-15 min. Free for public repos. Different cloud platform = clearly different instances.
3. **Local `my-agent.mjs` runs** *(supplementary)* — for ad-hoc / interactive runs while building. Doesn't count toward the cloud requirement on its own, but is fine alongside.

If 1+2 are running and we get even one classmate to point their agent at the platform during the test window, we've trivially exceeded the bar.

## Code we'll need to add

1. **Migration 0005:** add `experiment_cohort` (TEXT) and `model` (TEXT) columns to `agents`. Add `latency_ms` and `tokens_in`/`tokens_out` to `date_messages` so we can compute cost per turn. Add a `runtime` column too (haiku/sonnet/openclaw/scripted).
2. **`scripts/run-experiment.mjs`** — orchestrator that takes a config (which experiment, which condition, persona pair list) and seeds N agents tagged with the cohort.
3. **`scripts/agent-loop-cf.mjs`** — minor variant of `my-agent.mjs` packaged as a Cloudflare Worker cron handler.
4. **`scripts/agent-loop-gha.yml`** — GitHub Actions workflow that runs a `my-agent.mjs` heartbeat on cron.
5. **`scripts/analyze-experiment.mjs`** — pulls dates+verdicts from the API, joins on cohort, produces the result table for the writeup.

Estimated build: 4–6 hours total. Experiments themselves run unattended over 1–2 days as the cron jobs collect data.

## Deliverables — the 1-page summary template

```markdown
# HW7 — Experiment Summary

## What we tested
[one paragraph per experiment, 2-3 sentences each]

## What changed
[bulleted list of the conditions varied — Persona richness, Model choice, Prompt honesty emphasis]

## Results

| Experiment | Sample | Headline metric | A | B | C |
|---|---|---|---|---|---|
| 1. Persona richness | 30 dates | Decline rate on mismatched pairs | 75% | 60% | 35% |
| 2. Haiku vs Sonnet | 20 dates | Cost per date | $0.005 | $0.04 | — |
| 3. Honesty prompt | 20 dates | Dealbreaker catch rate | 70% | 92% | — |

[2-3 sentences per row of unexpected observations]

## Key takeaways
- Persona richness matters most for *catching dealbreakers*, not for *generating positive matches*.
- Sonnet's verdicts are more nuanced but rarely change the outcome — ship Haiku, save 80% on cost.
- The default system prompt produces too many polite false-yes verdicts; the honesty-emphasized prompt fixes this without other regressions.
```

(Numbers above are placeholders — the real ones come from running the experiments.)

## Video script (60s)

| Time | What's on screen | What you say |
|---|---|---|
| 0:00–0:10 | Slide / intro | "I ran three experiments on Clawnection: persona richness, model choice, and honest verdicts under dealbreaker conflicts." |
| 0:10–0:25 | Watch dashboard / directory filtered by experiment cohort | "Six agents on cloud — Cloudflare Workers cron, GitHub Actions, plus a classmate's OpenClaw agent. 70 dates total." |
| 0:25–0:45 | Results table from summary | "Headline result: rich persona doubles the dealbreaker catch rate. Sonnet costs 8× more than Haiku for the same outcomes. The honesty-emphasized prompt closes a 22-point gap on mismatch detection." |
| 0:45–1:00 | Sample verdict reasoning side-by-side | "What surprised me: rich-persona agents *cite* the dealbreaker by name, thin-persona agents miss it entirely. The persona schema is doing real work." |

## Sequence I'd suggest

1. **Today:** confirm this plan looks right + you have a sense of the three experiments.
2. **Next session:** build the schema + orchestration (migration 0005, run-experiment.mjs).
3. **Following session:** wire up the cloud agents (CF Worker cron + GH Actions).
4. **Wait 1-2 days** while they collect data.
5. **Analysis session:** pull data, write the summary, record the video.

About 3-4 working sessions over a week — most of it waiting for cron jobs to do their thing.
