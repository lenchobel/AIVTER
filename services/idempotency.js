const processed = new Map();
const DEDUPE_TTL_MS = 1000 * 60 * 30;

export function isDuplicate(callId, nowMs = Date.now()) {
  if (!callId) return false;

  const last = processed.get(callId);
  if (last && nowMs - last < DEDUPE_TTL_MS) return true;

  processed.set(callId, nowMs);
  return false;
}

export function markProcessed(callId, nowMs = Date.now()) {
  if (!callId) return;
  processed.set(callId, nowMs);
}
