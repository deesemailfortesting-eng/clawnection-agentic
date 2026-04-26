@AGENTS.md

# Clawnection — Claude session context

## What this project is
Agentic matchmaking app. Users build a romantic profile (via text form or voice), a personal AI agent represents them, and agents run a structured "virtual date" before recommending whether two humans should meet. Built on Next.js + Cloudflare Workers + D1.

## Live deployment
- **URL:** https://clawnection.deesemailfortesting.workers.dev
- **Cloudflare account:** deesemailfortesting@gmail.com
- **Worker name:** `clawnection`
- **D1 database:** `clawnection-db` (ID: `5bddf833-3d10-43d2-a18c-e443d04e79af`)
- **API token (D1 + Workers scope):** stored in Cloudflare dashboard — do not commit. Set as `CLOUDFLARE_API_TOKEN` env var before running wrangler commands.

## How to redeploy
```bash
# From /tmp/clawnection
CLOUDFLARE_API_TOKEN=<token> \
  node node_modules/@opennextjs/cloudflare/dist/cli/index.js build

CLOUDFLARE_API_TOKEN=<token> \
  OPEN_NEXT_DEPLOY=true \
  ~/.local/bin/wrangler deploy --config wrangler.jsonc
```

`OPEN_NEXT_DEPLOY=true` is required — without it wrangler tries to delegate to `opennextjs-cloudflare deploy`, which crashes on macOS 12.5 (Workers runtime requires macOS 13.5+).

## npm/npx are broken on this machine
The symlinks at `~/.local/bin/npm` and `~/.local/bin/npx` were pointing to a relative path that doesn't exist. They've been patched to use absolute paths. If npm stops working again:
```bash
cat > /Users/mayalevy/.local/bin/npm << 'EOF'
#!/usr/bin/env node
require('/Users/mayalevy/.local/lib/node_modules/npm/lib/cli.js')(process)
EOF
chmod +x /Users/mayalevy/.local/bin/npm

cat > /Users/mayalevy/.local/bin/npx << 'EOF'
#!/usr/bin/env node
require('/Users/mayalevy/.local/lib/node_modules/npm/bin/npx-cli.js')
EOF
chmod +x /Users/mayalevy/.local/bin/npx
```

Use `node ~/.local/lib/node_modules/npm/bin/npm-cli.js` as a fallback if the shim breaks again.

## Environment variables
Stored in `/tmp/clawnection/.env.local` (baked into the build, not deployed as secrets):
```
NEXT_PUBLIC_VAPI_API_KEY=9058d621-d733-4b05-b4b0-c6e2a8ed549b
NEXT_PUBLIC_VAPI_ASSISTANT_ID=d1f8ed5a-69dd-45b4-8d1b-641df6d15051
```
These are `NEXT_PUBLIC_` so they get embedded at build time. If they change, rebuild and redeploy.

## Git remote
The GitHub repo is `sundai-hack-clawnection/clawnection`. The remote is named `sundai` (not `origin`).
```bash
git push sundai main
```
Teammates are actively pushing to this repo. Always `git fetch sundai && git merge sundai/main --no-edit` before pushing.

## Architecture

```
Browser (Next.js)
  ↓ fetch
app/api/**          ← Next.js edge route handlers
  ↓ D1 binding
Cloudflare D1       ← clawnection-db (SQLite)
```

localStorage is used as a fast local cache with fire-and-forget server sync. The sync helpers are in `lib/storage.ts`: `syncProfileToServer`, `syncSignalsToServer`, `syncGapToServer`, `syncResultToServer`.

## Database tables
- `profiles` — romantic profiles (from text or voice onboarding)
- `signal_bundles` — WhatsApp behavioral signals per profile
- `self_awareness_gaps` — internal only, delta between stated vs behavioral profile
- `match_results` — virtual date results with score + verdict
- `negotiation_sessions` / `negotiation_messages` — Layer 3 foundation, empty for now

Migration file: `migrations/0001_initial.sql` (already applied to remote D1).

To query the live DB:
```bash
CLOUDFLARE_API_TOKEN=<token> \
  ~/.local/bin/wrangler d1 execute clawnection-db --remote \
  --command="SELECT id, name, age, location FROM profiles ORDER BY created_at DESC LIMIT 10"
```

## Key files

| Path | What it does |
|---|---|
| `app/voice-onboarding/page.tsx` | Voice onboarding via Vapi AI — saves profile to localStorage + D1 |
| `app/onboarding/page.tsx` | Text-based onboarding form with WhatsApp upload section |
| `app/demo/page.tsx` | Runs virtual date simulation between two profiles |
| `app/api/profiles/route.ts` | POST upsert / GET fetch profile from D1 |
| `app/api/signals/route.ts` | POST / GET WhatsApp signal bundles |
| `app/api/gaps/route.ts` | POST / GET self-awareness gap (internal) |
| `app/api/matches/route.ts` | POST / GET match results |
| `app/api/matches/[id]/route.ts` | GET single match result |
| `lib/storage.ts` | localStorage helpers + server sync functions |
| `lib/whatsapp/parser.ts` | WhatsApp export parser (iOS + Android formats) |
| `lib/whatsapp/signals.ts` | Signal extraction + weighted multi-file merge |
| `lib/whatsapp/enrichProfile.ts` | Updates profile fields from behavioral signals |
| `lib/types/behavioral.ts` | WhatsAppSignals, SelfAwarenessGap types |
| `wrangler.jsonc` | Cloudflare Workers config with D1 binding |
| `env.d.ts` | TypeScript types for Cloudflare env bindings |
| `.env.local` | Vapi credentials (build-time only) |

## Voice onboarding — how it works
1. User fills pre-call form (name, gender, sexual preference)
2. Vapi SDK starts a call with assistant `d1f8ed5a-69dd-45b4-8d1b-641df6d15051`
3. During the call the assistant emits a message containing `PROFILE_DATA: {...}` JSON
4. On call-end, the page parses that JSON → builds a `RomanticProfile` → saves to localStorage and syncs to D1

## WhatsApp upload — how it works
On the text onboarding page (Section 5), users can upload one or more `.txt` or `.zip` WhatsApp exports. Signals are extracted (response latency, emoji density, initiation ratio, etc.) and merged weighted by message count. The derived communication style and sleep schedule can update the profile, and a self-awareness gap score is computed internally.

## What's not done yet
- Layer 3: agent-to-agent negotiation protocol (tables exist, logic not built)
- Real LLM calls in the agent adapter (currently deterministic/rule-based)
- User accounts / authentication
- Matching between two real users (currently one real + one seeded sample)
