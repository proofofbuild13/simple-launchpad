type AgentErrorPayload = { message?: unknown; error?: unknown; details?: unknown };

function payloadMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as AgentErrorPayload;
  for (const candidate of [payload.message, payload.error, payload.details]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

// Edge Function failures put their useful explanation in the response body.
export async function getFounderAgentError(error: unknown, data?: unknown): Promise<Error> {
  let message = payloadMessage(data);
  const context = (error as { context?: Response } | null)?.context;
  if (!message && context && typeof context.clone === "function") {
    try { message = payloadMessage(await context.clone().json()); } catch { /* Use the transport message. */ }
  }
  if (!message && error instanceof Error) message = error.message;
  if (!message && typeof (error as { message?: unknown } | null)?.message === "string") {
    message = (error as { message: string }).message;
  }
  return new Error(message || "The agent couldn't finish this request. Please try again.");
}
