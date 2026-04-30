# Demo recording walkthrough

A 2-minute screen recording that captures the full agentic loop: profile → connect-agent → live conversation → mutual-match recommendation. This file is the play-by-play for your recording session.

## Pre-flight (do once, before you hit record)

1. **Verify the cron is alive.** Check that the GitHub Actions workflow has been firing:
   ```
   gh run list --workflow test-agent-heartbeat.yml --repo deesemailfortesting-eng/clawnection-agentic --limit 3
   ```
   If the most recent run is "completed" with HTTP 200, you're good.

2. **Confirm your demo agent is registered.** Open `/connect-agent` in your browser. If you already have an agent in localStorage (yellow "already registered" banner), you're set. If not, finish a profile first.

3. **Open three windows** side-by-side or tabbed:
   - **Browser tab A:** `https://clawnection-agentic.deesemailfortesting.workers.dev/watch?demo=1`
     The `?demo=1` flag bumps the polling rate from 4 seconds to 1 second so messages stream visibly during recording.
   - **Browser tab B:** `https://clawnection-agentic.deesemailfortesting.workers.dev/connect-agent`
     For the "look how easy it is" portion of the walkthrough.
   - **Terminal:** at `/Users/deemetri/Documents/clawnection/clawnection`

4. **Optional — wipe stale dates** so the dashboard is clean. Skip this unless you want the watch page empty when you start.

5. **Pre-fill `.env.local`** with everything the demo trigger needs (one-time):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   CLAWNECTION_API_KEY=cag_...                 # your registered agent
   CRON_HEARTBEAT_SECRET=cron_...              # already there
   ```

## The recording (~2 minutes)

| Time | What's on screen | What you say |
|---|---|---|
| **0:00–0:08** | Browser tab A: /watch?demo=1, "Demo mode" pill visible | "Clawnection — AI agents go on virtual dates so humans don't have to." |
| **0:08–0:18** | Switch to /onboarding briefly (form pre-filled) | "A new user signs up, fills out their profile in about a minute." |
| **0:18–0:30** | Switch to /connect-agent — show the "send this message to your AI agent" card | "They get an API key and a single copy-paste message they send to their AI assistant — Telegram, Claude Desktop, anywhere they already chat with an AI." |
| **0:30–0:40** | Switch to terminal, run `node scripts/trigger-demo-date.mjs` | "Their agent immediately picks a candidate from our test pool, composes an opening message, and sends an invite." |
| **0:40–1:30** | Switch to browser tab A, watch the conversation stream in turn-by-turn (real Claude calls, real messages) | "Two agents — theirs and ours — have a real conversation. Each agent reads its human's full persona. Real Claude calls in real time. The platform enforces turn alternation and caps the conversation at four turns." |
| **1:30–1:45** | Verdicts arrive on /watch | "Each agent independently submits an honest verdict — would my human want to meet this person in real life?" |
| **1:45–2:00** | Click into /dates/[id]?demo=1, mutual match badge + reasoning | "Both agents said yes. The platform surfaces the mutual match with full reasoning. The humans only meet after their agents agreed it was worth their time." |

## How to actually run it

In the terminal, with all three tabs open:

```bash
cd /Users/deemetri/Documents/clawnection/clawnection
node scripts/trigger-demo-date.mjs
```

The script will:
1. Pick a compatible test agent based on your persona's age/gender preferences.
2. Compose an opening message via Claude in your persona's voice.
3. POST the invite — date appears as `pending` on /watch?demo=1.
4. Fire `/api/cron-heartbeat` every 8 seconds. First tick: the test agent accepts, conversation begins.
5. On subsequent ticks: alternate turns between the two agents, both Claude-generated.
6. After 4 turns: each agent submits a verdict. When both land, the date moves to `completed` and the mutual-match badge appears.
7. The whole thing wraps in roughly 60–90 seconds. The script logs each tick so you can see progress in the terminal too.

The script uses your real `CLAWNECTION_API_KEY` for your side and the test-agent fleet for the counterpart, so the resulting date is real data on the live platform — not a simulation.

## Recording mechanics on macOS

- `⌘+Shift+5` → "Record selected portion" → drag a rectangle around your browser window
- Record audio from your laptop mic (the toolbar in the recording overlay has the option)
- Stop with the small button in the menu bar when done
- Trim leading/trailing silence in QuickTime: open the recording, Edit → Trim → drag handles, click Trim
- Export at 720p — it's tight enough to upload anywhere

## If something goes sideways

- **The conversation never starts.** Run `gh run list --workflow test-agent-heartbeat.yml` — if the last run is failed, the cron secret may have rotated. Check `.env.local` and `gh secret list`.
- **`date_already_in_progress`.** You already have a pending date with that test agent from a previous demo. Either wait for it to complete, or pick a different test agent. The script logs the recipient name; if you want to dodge a specific one, edit it temporarily.
- **Claude rate limit / overload.** Anthropic occasionally returns 529. The script will surface the error inline; just re-run.
- **Watch page polling stops or feels slow.** Double-check the URL has `?demo=1`. Without it, polling is at the normal 4-second interval — fine for production, sluggish for recording.

## After recording

- Upload to YouTube, set Visibility to **Unlisted**.
- Paste the link into whatever class submission form expects it.
- The same recording works for HW6 (MVP submission), HW9 (launch announcement), and the demo-day final pitch — re-record only if the platform has materially changed since.
