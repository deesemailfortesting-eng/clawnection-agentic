"use client";

import { useRef, useState } from "react";
import { RomanticProfile } from "@/lib/types/matching";
import { SelfAwarenessGap, WhatsAppSignals } from "@/lib/types/behavioral";
import { parseWhatsAppExport } from "@/lib/whatsapp/parser";
import { extractSignals, mergeSignals } from "@/lib/whatsapp/signals";
import { enrichProfileFromSignals } from "@/lib/whatsapp/enrichProfile";

type FileResult = {
  fileName: string;
  signals: WhatsAppSignals;
};

type UploadState =
  | { status: "idle" }
  | { status: "loading"; processed: number; total: number }
  | { status: "error"; message: string }
  | {
      status: "preview";
      fileResults: FileResult[];
      mergedSignals: WhatsAppSignals;
      updatedProfile: RomanticProfile;
      gap: SelfAwarenessGap;
      changedFields: Array<"communicationStyle" | "sleepSchedule">;
    };

type WhatsAppUploadProps = {
  currentProfile: RomanticProfile;
  onApply: (updatedProfile: RomanticProfile, signals: WhatsAppSignals, gap: SelfAwarenessGap) => void;
  onSkip: () => void;
};

async function readFileAsText(file: File): Promise<string> {
  if (file.name.endsWith(".zip")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(file);
    const txtFile = Object.values(zip.files).find((f) => !f.dir && f.name.endsWith(".txt"));
    if (!txtFile) throw new Error(`No .txt found inside ${file.name}`);
    return txtFile.async("string");
  }
  return file.text();
}

function formatLatency(ms: number): string {
  if (ms === 0) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `~${min} min`;
  return `~${Math.round(min / 60)}h`;
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

const fieldClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

export function WhatsAppUpload({ currentProfile, onApply, onSkip }: WhatsAppUploadProps) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [userName, setUserName] = useState("");
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUpload = hasAcceptedConsent && state.status !== "loading";

  async function processFiles(files: File[]) {
    const trimmedName = userName.trim();
    if (!trimmedName) {
      setState({ status: "error", message: "Enter your name as it appears in the chat before uploading." });
      return;
    }

    if (!hasAcceptedConsent) {
      setState({
        status: "error",
        message:
          "Review and accept the WhatsApp consent terms before uploading your export.",
      });
      return;
    }

    setState({ status: "loading", processed: 0, total: files.length });

    const fileResults: FileResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setState({ status: "loading", processed: i, total: files.length });
      try {
        const text = await readFileAsText(file);
        const parseResult = parseWhatsAppExport(text);
        const { messages } = parseResult;
        if (messages.length === 0) {
          errors.push(`${file.name}: no messages found`);
          continue;
        }
        const signals = extractSignals(messages, trimmedName, {
          extractionMetadata: {
            fileCount: 1,
            parseErrors: parseResult.parseErrors,
            detectedFormats: [parseResult.detectedFormat],
          },
          conversationId: file.name,
        });
        if (signals.userMessageCount === 0) {
          errors.push(`${file.name}: no messages from "${trimmedName}" — check the name matches exactly`);
          continue;
        }
        fileResults.push({ fileName: file.name, signals });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : "read error"}`);
      }
    }

    if (fileResults.length === 0) {
      setState({ status: "error", message: errors.join("\n") || "No usable data found in the uploaded files." });
      return;
    }

    const mergedSignals = mergeSignals(fileResults.map((r) => r.signals));
    const { updatedProfile, selfAwarenessGap, changedFields } = enrichProfileFromSignals(
      currentProfile,
      mergedSignals,
    );

    setState({ status: "preview", fileResults, mergedSignals, updatedProfile, gap: selfAwarenessGap, changedFields });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!canUpload) {
      setState({
        status: "error",
        message: "Review and accept the WhatsApp consent terms before uploading your export.",
      });
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  }

  if (state.status === "preview") {
    const { fileResults, mergedSignals: s, changedFields } = state;
    const totalUserMsgs = fileResults.reduce((sum, r) => sum + r.signals.userMessageCount, 0);

    return (
      <div className="space-y-4">
        {/* Per-file breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Files processed</p>
          {fileResults.map(({ fileName, signals: fs }) => {
            const pct = totalUserMsgs > 0 ? Math.round((fs.userMessageCount / totalUserMsgs) * 100) : 0;
            return (
              <div key={fileName} className="flex items-center gap-3 text-sm">
                <span className="truncate max-w-[200px] text-zinc-700">{fileName}</span>
                <span className="text-zinc-400">{fs.userMessageCount.toLocaleString()} msgs</span>
                <div className="flex-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                  <div className="h-full rounded-full bg-rose-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-zinc-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Combined signal preview */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-emerald-600 font-semibold text-sm">Combined analysis</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              {s.userMessageCount.toLocaleString()} messages · {fileResults.length} chat{fileResults.length > 1 ? "s" : ""}
            </span>
            {s.isLowConfidence && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                low confidence
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-zinc-500">Response speed</span><span className="ml-2 font-medium text-zinc-800">{formatLatency(s.avgResponseLatencyMs)}</span></div>
            <div><span className="text-zinc-500">Starts conversations</span><span className="ml-2 font-medium text-zinc-800">{formatPct(s.initiationRatio)}</span></div>
            <div><span className="text-zinc-500">Detailed messages</span><span className="ml-2 font-medium text-zinc-800">{formatPct(s.longMessageRatio)}</span></div>
            <div><span className="text-zinc-500">Emoji density</span><span className="ml-2 font-medium text-zinc-800">{s.emojiDensity.toFixed(1)}/msg</span></div>
            <div><span className="text-zinc-500">Active hours</span><span className="ml-2 font-medium text-zinc-800">{s.activeHoursProfile}</span></div>
            <div><span className="text-zinc-500">Derived style</span><span className="ml-2 font-medium text-zinc-800">{s.derivedCommunicationStyle}</span></div>
            <div><span className="text-zinc-500">Signal confidence</span><span className="ml-2 font-medium text-zinc-800">{s.signalFamilyMetadata.communicationStyle.confidence}</span></div>
            <div><span className="text-zinc-500">Source coverage</span><span className="ml-2 font-medium text-zinc-800">{s.extractionMetadata.fileCount} file{ s.extractionMetadata.fileCount > 1 ? "s" : "" } · {s.extractionMetadata.detectedFormats.join(", ")}</span></div>
            <div><span className="text-zinc-500">Eligible conversations</span><span className="ml-2 font-medium text-zinc-800">{s.coverageSummary.eligibleConversationCount}/{s.coverageSummary.conversationCount}</span></div>
            <div><span className="text-zinc-500">Coverage quality</span><span className="ml-2 font-medium text-zinc-800">{s.coverageSummary.coverageQuality}</span></div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-zinc-700">
            <p className="font-medium text-zinc-900">Safe summary candidates</p>
            <div className="mt-2 space-y-2">
              {s.shareableSummary.map((summary) => (
                <div key={summary.label} className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-zinc-500">{summary.label}</span>
                    <span className="ml-2 font-medium text-zinc-800">{summary.value}</span>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    {summary.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {s.conversationProfiles.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
              <p className="font-medium text-zinc-900">Conversation coverage</p>
              <div className="mt-2 space-y-2">
                {s.conversationProfiles.map((profile) => (
                  <div key={profile.conversationId} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-2 last:border-b-0 last:pb-0">
                    <div>
                      <p className="font-medium text-zinc-800">{profile.conversationId}</p>
                      <p className="text-zinc-500">
                        {profile.coverage.messageCount} messages · {profile.coverage.activeDays} active day{profile.coverage.activeDays === 1 ? "" : "s"} · {profile.inferredRelationshipType}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {profile.coverage.confidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!s.isLowConfidence && changedFields.length > 0 ? (
            <div className="rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm text-zinc-700">
              <span className="font-medium">Will update: </span>
              {changedFields.map((f, i) => {
                const before = f === "communicationStyle"
                  ? currentProfile.communicationStyle
                  : currentProfile.lifestyleHabits.sleepSchedule;
                const after = f === "communicationStyle"
                  ? s.derivedCommunicationStyle
                  : s.activeHoursProfile;
                return (
                  <span key={f}>
                    {i > 0 ? ", " : ""}
                    {f === "communicationStyle" ? "Communication style" : "Sleep schedule"} ({before} → <strong>{after}</strong>)
                  </span>
                );
              })}
            </div>
          ) : changedFields.length === 0 ? (
            <p className="text-sm text-zinc-500">Your stated attributes already match the behavioral data — no field updates needed.</p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onApply(state.updatedProfile, state.mergedSignals, state.gap)}
            className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Apply to profile
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 transition hover:border-zinc-400"
          >
            Re-upload
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 transition hover:border-zinc-400"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 space-y-3">
        <div>
          <p className="font-medium text-zinc-900">WhatsApp consent</p>
          <p className="mt-1 text-zinc-600">
            Uploading a WhatsApp export lets Clawnection extract behavioral signals from your messages, such as response rhythm,
            message depth, emoji use, and active hours.
          </p>
        </div>

        <ul className="space-y-1 text-zinc-600">
          <li>Used internally: your uploaded chats are analyzed to derive behavioral signals and compare them to your stated profile.</li>
          <li>Surfaced to you: only summary metrics and profile updates are shown in this flow, not raw transcript excerpts.</li>
          <li>Storage in this MVP: data is processed in your browser and saved locally on this device via browser storage.</li>
          <li>Revocation in this MVP: you can clear your browser storage later to remove saved profile and signal data from this prototype.</li>
        </ul>

        <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={hasAcceptedConsent}
            onChange={(e) => setHasAcceptedConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-rose-500 focus:ring-rose-300"
          />
          <span>
            I consent to analyzing this WhatsApp export for behavioral matchmaking signals in this prototype.
          </span>
        </label>
      </div>

      <div>
        <label className="text-sm text-zinc-700">
          Your name in the chats
          <input
            className={fieldClass}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="e.g. Maya, or +1 617-555-0100"
          />
        </label>
        <p className="mt-1 text-xs text-zinc-400">
          Must match exactly how you appear as a sender in the export. Open one .txt to check if unsure.
        </p>
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          canUpload
            ? "cursor-pointer border-zinc-300 bg-zinc-50 hover:border-rose-300 hover:bg-rose-50"
            : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => {
          if (!canUpload) {
            setState({
              status: "error",
              message: "Review and accept the WhatsApp consent terms before uploading your export.",
            });
            return;
          }
          fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.zip"
          multiple
          className="hidden"
          disabled={!hasAcceptedConsent}
          onChange={handleFileChange}
        />
        {state.status === "loading" ? (
          <p className="text-sm text-zinc-500">
            Analysing file {state.processed + 1} of {state.total}…
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-700">Drop your WhatsApp exports here</p>
            <p className="mt-1 text-xs text-zinc-400">
              {hasAcceptedConsent
                ? "Select multiple files at once · .txt or .zip · signals are merged weighted by message count"
                : "Accept the consent terms above to enable upload"}
            </p>
          </>
        )}
      </div>

      {state.status === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 whitespace-pre-line">
          {state.message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}
