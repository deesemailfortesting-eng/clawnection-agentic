# Clawnection MVP (Prototype 1)

Clawnection is a romance-first, agentic matchmaking prototype.

In this MVP, each person is represented by a personal matchmaking agent. Before two humans decide to meet, their agents run a **bounded virtual date protocol** and generate a recommendation (`meet`, `maybe`, or `not recommended`).

The key principle is **human-in-the-loop decision making**:
- agents provide structure and recommendations
- humans remain in control of whether to proceed in real life

## What this MVP includes

- Landing page at `/` with product framing and clear CTAs.
- Onboarding flow at `/onboarding` for building a lightweight romantic profile.
- Seeded romantic counterpart profiles in local TypeScript data.
- Shared domain types for profiles, rounds, recommendations, concerns, and match results.
- A common agent adapter interface plus:
  - `HostedAgentAdapter`
  - `MockExternalAgentAdapter` (simulates bring-your-own-agent workflows)
- Deterministic virtual-date simulation engine with six rounds + closing assessment.
- Demo flow at `/demo` to run simulations.
- Results page at `/results` with score, strengths, concerns, recommendation, and transcript summary.

## Tech + architecture constraints

This prototype intentionally avoids backend complexity:

- No authentication
- No OpenAI API integration yet
- No OpenClaw integration yet
- No external matchmaking dependencies

State is persisted via **Cloudflare D1** (edge SQLite) in the deployed version, with `localStorage` as a fast local cache and graceful fallback when offline. The API routes live under `app/api/` and use the `@opennextjs/cloudflare` adapter to access D1 bindings.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Cloudflare deployment

A live deployment exists on Cloudflare Workers, **separate from the GitHub repository**. The deployed version may be ahead of or behind what is in git — they are not automatically synced.

**Live URL:** https://clawnection.deesemailfortesting.workers.dev  
**Account:** deesemailfortesting@gmail.com  
**Worker name:** clawnection  
**Database:** Cloudflare D1 · `clawnection-db`

The deployed worker includes a D1-backed API layer (`/api/profiles`, `/api/signals`, `/api/gaps`, `/api/matches`) that is **not present in the original localStorage-only codebase**. Profile data, WhatsApp signals, and match results are persisted server-side on Cloudflare's edge.

To redeploy manually:
```bash
CLOUDFLARE_API_TOKEN=<token> npx opennextjs-cloudflare build
CLOUDFLARE_API_TOKEN=<token> npx opennextjs-cloudflare deploy
```

## What is mocked vs future work

### Mocked in this MVP
- Agent behavior is deterministic and rule-based (no LLM calls).
- External agent support is represented by a mock adapter implementation.

### Future extensions
- Plug hosted adapter into real model inference.
- Add real bring-your-own-agent protocol adapters.
- Add persistence, user accounts, and match history.
- Add OpenClaw support and richer multi-agent orchestration.

For a condensed roadmap, see `PROJECT_SPEC.md`.

For the current layered system direction, see `ARCHITECTURE.md`.
