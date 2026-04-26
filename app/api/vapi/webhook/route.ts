import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { VoicePersona } from "@/lib/types/persona";

export const runtime = "edge";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function extractPersona(message: Record<string, unknown>): Record<string, string> | null {
  const fromAnalysis =
    (message.analysis as Record<string, unknown> | undefined)
      ?.structuredOutputs as Record<string, unknown> | undefined;
  const fromArtifact =
    (message.artifact as Record<string, unknown> | undefined)
      ?.structuredOutputs as Record<string, unknown> | undefined;
  const outputs = fromAnalysis ?? fromArtifact;
  if (!outputs) return null;
  const persona = outputs.clawnection_persona as Record<string, string> | undefined;
  return persona ?? null;
}

export async function POST(req: NextRequest) {
  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).DB;
  const secret = (env as unknown as CloudflareEnv).VAPI_WEBHOOK_SECRET;

  const incoming = req.headers.get("x-vapi-secret") ?? "";
  if (!secret || !timingSafeEqual(incoming, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? body) as Record<string, unknown>;

  if (message.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const call = (message.call as Record<string, unknown> | undefined) ?? {};
  const callId = (call.id ?? message.callId ?? "") as string;

  const profileId = (
    (message.assistantOverrides as Record<string, unknown> | undefined)
      ?.variableValues as Record<string, unknown> | undefined
  )?.profileId as string | undefined;

  if (!profileId) {
    console.warn("[vapi-webhook] end-of-call-report missing profileId", { callId });
    return NextResponse.json({ ok: true, skipped: "no profileId" });
  }

  const artifact = (message.artifact as Record<string, unknown> | undefined) ?? {};
  const transcript = (artifact.transcript ?? message.transcript ?? null) as string | null;
  const recordingUrl = (artifact.recordingUrl ?? message.recordingUrl ?? null) as string | null;
  const durationSeconds = (message.durationSeconds ?? call.durationSeconds ?? null) as number | null;
  const endedReason = (message.endedReason ?? call.endedReason ?? null) as string | null;

  const persona = extractPersona(message);
  const analysisSkipped = persona === null ? 1 : 0;

  const portrait = persona?.portrait ?? "";
  const structuredSignals = persona?.structured_signals ?? "";
  const voiceSamples = persona?.voice_samples ?? "";

  try {
    await db
      .prepare(
        `INSERT INTO voice_personas (
          profile_id, vapi_call_id, portrait, structured_signals, voice_samples,
          transcript, recording_url, call_duration_seconds, ended_reason, analysis_skipped,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
        ON CONFLICT(vapi_call_id) DO UPDATE SET
          portrait           = excluded.portrait,
          structured_signals = excluded.structured_signals,
          voice_samples      = excluded.voice_samples,
          transcript         = excluded.transcript,
          recording_url      = excluded.recording_url,
          call_duration_seconds = excluded.call_duration_seconds,
          ended_reason       = excluded.ended_reason,
          analysis_skipped   = excluded.analysis_skipped,
          updated_at         = datetime('now')`,
      )
      .bind(
        profileId,
        callId || null,
        portrait,
        structuredSignals,
        voiceSamples,
        transcript,
        recordingUrl,
        durationSeconds,
        endedReason,
        analysisSkipped,
      )
      .run();

    console.log("[vapi-webhook] upserted voice_persona", { profileId, callId, analysisSkipped });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vapi-webhook] D1 upsert failed", { callId, profileId, err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Satisfy TypeScript — VoicePersona is the canonical shape for callers reading this data.
export type { VoicePersona };
