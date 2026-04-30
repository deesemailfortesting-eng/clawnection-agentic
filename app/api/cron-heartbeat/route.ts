import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ----- Types -----

type WorkerSelf = { fetch: (req: Request) => Promise<Response> };

type TickSummary = {
  agentId: string;
  personaName: string;
  invitesProcessed: number;
  messagesSent: number;
  verdictsSubmitted: number;
  errors: string[];
};

type Persona = {
  id: string;
  name: string;
  age: number;
  location?: string;
  bio?: string;
  interests?: string[];
  values?: string[];
  communicationStyle?: string;
  dealbreakers?: string[];
  idealFirstDate?: string;
  preferenceAgeRange?: { min: number; max: number };
  preferenceNotes?: string;
  relationshipIntent?: string;
  lookingFor?: string;
  lifestyleHabits?: Record<string, string>;
};

type InboxResponse = {
  agent: { id: string; displayName: string };
  pendingInvites: Array<{
    date: { id: string };
    fromAgent: { id: string; displayName: string };
    fromPersona: Persona;
  }>;
  activeDates: Array<{
    date: { id: string; turnCount: number; maxTurns: number };
    counterpartAgent: { id: string };
    counterpartPersona: Persona;
    counterpartTurnsAhead: number;
  }>;
  awaitingMyVerdict: Array<{
    date: { id: string };
    counterpartAgent: { id: string };
    counterpartPersona: Persona;
  }>;
};

// ----- Config -----

const MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_AGENTS_PER_TICK = 3;
const MAX_AGENTS_PER_TICK = 10;

// ----- E1 (persona-richness ablation) -----
//
// Subject agents tagged with framework `exp-e1-rich`, `exp-e1-medium`, or
// `exp-e1-thin` get a deliberately-varied amount of THEIR OWN persona context
// in the prompt that drives their decisions. The platform persona stored in
// D1 is the same in all cases (we share local-dee across all three subjects);
// what differs is how much we hand to Claude when composing turns and
// verdicts. This isolates "agent's access to its own persona" as the
// independent variable.
type PersonaRichness = "rich" | "medium" | "thin";

function richnessForFramework(fw: string | null | undefined): PersonaRichness {
  if (!fw) return "rich";
  if (fw === "exp-e1-medium") return "medium";
  if (fw === "exp-e1-thin") return "thin";
  return "rich";
}

function personaContextFor(persona: Persona, richness: PersonaRichness): string {
  if (richness === "rich") return JSON.stringify(persona, null, 2);
  if (richness === "medium") {
    return JSON.stringify(
      {
        name: persona.name,
        age: persona.age,
        location: persona.location,
        bio: persona.bio,
        topInterests: (persona.interests ?? []).slice(0, 3),
      },
      null,
      2,
    );
  }
  // thin
  return JSON.stringify(
    {
      name: persona.name,
      age: persona.age,
      bio: persona.bio,
    },
    null,
    2,
  );
}

// ----- Auth helpers -----

function expectedSecret(env: unknown): string | null {
  return (env as { CRON_HEARTBEAT_SECRET?: string }).CRON_HEARTBEAT_SECRET ?? null;
}

function checkSecret(req: NextRequest, secret: string | null): boolean {
  if (!secret) return false;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided && provided === secret) return true;
  const header = req.headers.get("x-cron-secret");
  if (header && header === secret) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

// ----- Self-fetch wrapping the platform's public API -----

function buildApi(selfRef: WorkerSelf, baseOrigin: string, apiKey: string) {
  return async function callApi(
    method: string,
    path: string,
    body?: unknown,
  ) {
    const req = new Request(`${baseOrigin}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const res = await selfRef.fetch(req);
    let json: unknown = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) {
      const e =
        ((json as { error?: string; message?: string } | null)?.error ??
          (json as { error?: string; message?: string } | null)?.message) ||
        `HTTP ${res.status}`;
      throw new Error(`${method} ${path} → ${e}`);
    }
    return json as unknown;
  };
}

// ----- Anthropic helper -----

async function claude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 350,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`anthropic HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = json.content?.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("anthropic: empty text response");
  return text;
}

function tryParseJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

// ----- Per-agent heartbeat -----

async function runOneAgentTick(args: {
  apiKey: string;
  selfRef: WorkerSelf;
  baseOrigin: string;
  anthropicKey: string;
}): Promise<TickSummary> {
  const { apiKey, selfRef, baseOrigin, anthropicKey } = args;
  const api = buildApi(selfRef, baseOrigin, apiKey);

  // Resolve self
  const me = (await api("GET", "/api/agent/me")) as {
    agent: { id: string; displayName: string; framework: string | null };
    persona: Persona;
  };
  const richness = richnessForFramework(me.agent.framework);
  const ownPersonaContext = personaContextFor(me.persona, richness);
  const summary: TickSummary = {
    agentId: me.agent.id,
    personaName: me.persona.name,
    invitesProcessed: 0,
    messagesSent: 0,
    verdictsSubmitted: 0,
    errors: [],
  };

  // Sweep inbox
  const inbox = (await api("GET", "/api/agent/inbox")) as InboxResponse;

  // 1) Pending invites — accept/decline via Claude.
  for (const inv of inbox.pendingInvites) {
    try {
      const sys = `You are an AI agent representing ${me.persona.name} on a virtual dating platform. Decide whether to accept or decline a date invite from ${inv.fromPersona.name}.

Bias toward accepting unless there is a clear reason not to:
- Their persona violates one of YOUR dealbreakers
- Their relationshipIntent does not match yours at all
- Their age is far outside your preferred range

Return ONLY JSON, no markdown fences: {"action": "accept" | "decline", "reason": "<1 sentence>"}

YOUR PERSONA:
${ownPersonaContext}

THEIR PERSONA:
${JSON.stringify(inv.fromPersona, null, 2)}`;
      const reply = await claude(anthropicKey, sys, "Respond with the JSON.", 200);
      const parsed = tryParseJson(reply) as
        | { action?: string; reason?: string }
        | null;
      const action =
        parsed?.action === "decline" ? "decline" : "accept"; // bias to accept on parse fail
      await api("POST", `/api/dates/${inv.date.id}/respond`, { action });
      summary.invitesProcessed += 1;
    } catch (err) {
      summary.errors.push(
        `invite ${inv.date.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 2) Active dates where it's my turn — compose next message via Claude.
  for (const d of inbox.activeDates) {
    if (d.counterpartTurnsAhead === 0) continue;
    try {
      const msgs = (await api(
        "GET",
        `/api/dates/${d.date.id}/messages`,
      )) as {
        messages: Array<{ senderAgentId: string; turnNumber: number; content: string }>;
      };
      const transcript = msgs.messages
        .map((m) => {
          const who =
            m.senderAgentId === me.agent.id
              ? me.persona.name
              : d.counterpartPersona.name;
          return `${who} (turn ${m.turnNumber}): ${m.content}`;
        })
        .join("\n\n");

      const sys = `You are an AI agent on a virtual dating platform representing ${me.persona.name}. Compose the next message in an ongoing date with ${d.counterpartPersona.name}.

- Stay in ${me.persona.name}'s voice (${me.persona.communicationStyle ?? "warm"} style).
- Reference specific details from your bio, interests, values, or ideal first date.
- Engage with what ${d.counterpartPersona.name} just said.
- 1–3 sentences. Conversation is short (turn ${d.date.turnCount + 1} of ${d.date.maxTurns}).
- Move toward whether you'd actually want to meet IRL.
- Output the raw message text only — no quotes, no "Name:" prefix.

YOUR PERSONA:
${ownPersonaContext}

THEIR PERSONA:
${JSON.stringify(d.counterpartPersona, null, 2)}`;
      const next = await claude(
        anthropicKey,
        sys,
        `Conversation so far:\n\n${transcript || "(no messages yet)"}\n\nWrite ${me.persona.name}'s next message.`,
        250,
      );
      await api("POST", `/api/dates/${d.date.id}/messages`, { content: next });
      summary.messagesSent += 1;
    } catch (err) {
      summary.errors.push(
        `message ${d.date.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 3) Awaiting my verdict — submit honest verdict via Claude.
  for (const w of inbox.awaitingMyVerdict) {
    try {
      const msgs = (await api(
        "GET",
        `/api/dates/${w.date.id}/messages`,
      )) as {
        messages: Array<{ senderAgentId: string; turnNumber: number; content: string }>;
      };
      const transcript = msgs.messages
        .map((m) => {
          const who =
            m.senderAgentId === me.agent.id
              ? me.persona.name
              : w.counterpartPersona.name;
          return `${who} (turn ${m.turnNumber}): ${m.content}`;
        })
        .join("\n\n");

      const sys = `You are an AI agent representing ${me.persona.name}. You just finished a virtual date with ${w.counterpartPersona.name}. Decide whether they should meet in person.

Be honest. A bad date is a useful signal — humans are wasting time when their agent rubber-stamps. If there are clear dealbreaker conflicts or a value mismatch, say no even if the conversation was pleasant.

Return ONLY JSON, no markdown fences: {"wouldMeetIrl": <true|false>, "rating": <1-10>, "reasoning": "<1-2 sentences>"}

YOUR PERSONA:
${ownPersonaContext}

THEIR PERSONA:
${JSON.stringify(w.counterpartPersona, null, 2)}`;
      const reply = await claude(
        anthropicKey,
        sys,
        `Conversation:\n\n${transcript}\n\nReturn the verdict JSON.`,
        300,
      );
      const parsed = tryParseJson(reply) as
        | { wouldMeetIrl?: boolean; rating?: number; reasoning?: string }
        | null;
      const verdict = {
        wouldMeetIrl: typeof parsed?.wouldMeetIrl === "boolean" ? parsed.wouldMeetIrl : false,
        rating: typeof parsed?.rating === "number" ? parsed.rating : 5,
        reasoning: parsed?.reasoning ?? "Verdict parse failed; defaulted to no.",
      };
      await api("POST", `/api/dates/${w.date.id}/verdict`, verdict);
      summary.verdictsSubmitted += 1;
    } catch (err) {
      summary.errors.push(
        `verdict ${w.date.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return summary;
}

// ----- Route -----

export async function POST(req: NextRequest): Promise<Response> {
  return run(req);
}

export async function GET(req: NextRequest): Promise<Response> {
  return run(req);
}

async function run(req: NextRequest): Promise<Response> {
  const { env } = getCloudflareContext();
  const cfEnv = env as unknown as {
    DB: D1Database;
    WORKER_SELF_REFERENCE?: WorkerSelf;
    ANTHROPIC_API_KEY?: string;
    CRON_HEARTBEAT_SECRET?: string;
  };

  if (!checkSecret(req, expectedSecret(env))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const selfRef = cfEnv.WORKER_SELF_REFERENCE;
  if (!selfRef) {
    return NextResponse.json(
      { error: "worker_self_reference_missing" },
      { status: 500 },
    );
  }
  const anthropicKey = cfEnv.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "anthropic_api_key_not_set" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const baseOrigin = `${url.protocol}//${url.host}`;
  const limitRaw = parseInt(
    url.searchParams.get("limit") ?? `${DEFAULT_AGENTS_PER_TICK}`,
    10,
  );
  const limit = Math.min(Math.max(limitRaw || DEFAULT_AGENTS_PER_TICK, 1), MAX_AGENTS_PER_TICK);

  // Pick test agents that are due. Order: never-ticked first, then oldest tick.
  const { results } = await cfEnv.DB
    .prepare(
      `SELECT agent_id, api_key
       FROM test_agent_credentials
       WHERE is_active = 1
       ORDER BY (CASE WHEN last_tick_at IS NULL THEN 0 ELSE 1 END), last_tick_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ agent_id: string; api_key: string }>();
  const candidates = results ?? [];

  const summaries: TickSummary[] = [];
  for (const c of candidates) {
    try {
      const s = await runOneAgentTick({
        apiKey: c.api_key,
        selfRef,
        baseOrigin,
        anthropicKey,
      });
      summaries.push(s);
    } catch (err) {
      summaries.push({
        agentId: c.agent_id,
        personaName: "?",
        invitesProcessed: 0,
        messagesSent: 0,
        verdictsSubmitted: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
    // Mark ticked even if errored — avoids hot-spinning on a broken agent.
    await cfEnv.DB
      .prepare(
        "UPDATE test_agent_credentials SET last_tick_at = datetime('now') WHERE agent_id = ?",
      )
      .bind(c.agent_id)
      .run();
  }

  const totals = {
    agentsProcessed: summaries.length,
    invitesProcessed: summaries.reduce((a, s) => a + s.invitesProcessed, 0),
    messagesSent: summaries.reduce((a, s) => a + s.messagesSent, 0),
    verdictsSubmitted: summaries.reduce((a, s) => a + s.verdictsSubmitted, 0),
    totalErrors: summaries.reduce((a, s) => a + s.errors.length, 0),
  };

  return NextResponse.json({ ranAt: new Date().toISOString(), totals, summaries });
}
