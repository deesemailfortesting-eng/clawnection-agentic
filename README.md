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
- No database
- No Supabase
- No OpenAI API integration yet
- No OpenClaw integration yet
- No external matchmaking dependencies

State is local-only using:
- local files
- TypeScript modules
- `localStorage`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

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
