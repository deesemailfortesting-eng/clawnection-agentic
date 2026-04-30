# HW3 work — handoff note

Built while you were in class. Branch `main` is up to date on your fork.

## What shipped

The "Bring your own agent" choice in the profile form now actually works.

**End-to-end UX flow:**
1. User completes the profile form at `/review-profile`.
2. Picks **"Bring your own agent"** (default; "Hosted WTF Radar agent" is now disabled with a "Coming soon" badge).
3. Submits the form → routed to `/connect-agent?profileId=<id>`.
4. `/connect-agent` automatically registers their profile as an agent and shows them, in one screen:
   - **Card 1 — API key** (shown once, copy button, "save this now" warning)
   - **Card 2 — Environment variables** (`CLAWNECTION_BASE_URL` + `CLAWNECTION_API_KEY` pre-filled, copy button)
   - **Card 3 — Skill files** (download links for `SKILL.md` and `HEARTBEAT.md`)
   - **Card 4 — Test connection** (one-click button that calls `/api/agent/me` from the browser using their new key, shows ✓ or ✗)
5. Footer card explains next steps (schedule heartbeat, watch live, link to `docs/JOIN.md`).

If a user reloads the page or navigates back, `localStorage` remembers they're already registered and tells them their key was shown once — preventing accidental duplicate agents.

## Verified locally

- TypeScript clean
- `/review-profile`, `/connect-agent`, `/SKILL.md`, `/HEARTBEAT.md` all return 200
- Programmatic end-to-end: created a profile via API → registered an agent against the profile ID → API key authenticated against `/api/agent/me` ✓
- Smoke test still passes (no regressions)

## Files changed

| File | What |
|---|---|
| `app/review-profile/page.tsx` | Default agent type → external-mock; Hosted disabled with "Coming soon"; submit routes external picks to `/connect-agent` |
| `app/connect-agent/page.tsx` | New PhoneShell wrapper |
| `app/connect-agent/ConnectAgentClient.tsx` | New: client component, registers + reveals key + sets up |
| `public/SKILL.md` | New (copy of root SKILL.md, so it's served at `/SKILL.md`) |
| `public/HEARTBEAT.md` | Same |

Commit: `28daeb2`

## Not deployed

You didn't drop your Cloudflare token into `.env.local` so I skipped the deploy. To push this live when you're back, in a fresh terminal:

```bash
cd /Users/deemetri/Documents/clawnection/clawnection
export CLOUDFLARE_API_TOKEN=cfat_…   # paste from your password manager
export CLOUDFLARE_ACCOUNT_ID=68eafe09f411cf50240f29791353a3e2

node node_modules/@opennextjs/cloudflare/dist/cli/index.js build
OPEN_NEXT_DEPLOY=true ./node_modules/.bin/wrangler deploy --config wrangler.jsonc
```

Takes about 90 seconds total.

## To try it locally right now

Dev server should still be running. If not:
```bash
cd /Users/deemetri/Documents/clawnection/clawnection
npm run dev
```

Then in your browser:
1. http://localhost:3000 → sign up / get started
2. Fill out the profile form (any test data works)
3. At the bottom, "Bring your own agent" should be selected
4. Submit → you'll land on `/connect-agent` and see your API key

## What this gets you toward HW3

**Done:**
- ✓ Onboarding flow that lets agents register without hand-holding (HW3 product-surface improvement #1: "Better onboarding")
- ✓ Foundation for ≥6 agents — anyone with the deploy URL can register a new one in 60 seconds

**Still needed for HW3 submission:**
- Get ≥4 distinct classmates to actually register their agents (this is the real bar)
- Make a 60–120 second screen recording showing multiple agents interacting
- Pick at least one more product-surface improvement from the list (rate limiting, agent directory, observability dashboard, etc.) — though the `/watch` page already arguably covers "Observability" + "Better UI"

**Recommendation when you're back:** record a quick walkthrough video of the new connect-agent flow (you completing the form, getting an API key, downloading the skill files, test button going green). Then share the deploy URL + `docs/JOIN.md` link with classmates and ask 4+ to register their agents over the next few days.
