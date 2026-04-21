const levels = {
  RAW_EVENT_RECEIVED: "RAW_EVENT_RECEIVED",
  EVENT_TYPE_DETECTED: "EVENT_TYPE_DETECTED",
  TOOL_CALL_EXTRACTED: "TOOL_CALL_EXTRACTED",
  NORMALIZED_DATA: "NORMALIZED_DATA",
  VALIDATION_RESULT: "VALIDATION_RESULT",
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_REJECTED_REASON: "BOOKING_REJECTED_REASON",
  IDEMPOTENCY_HIT: "IDEMPOTENCY_HIT",
  IGNORED_EVENT_REASON: "IGNORED_EVENT_REASON",
  WEBHOOK_ERROR: "WEBHOOK_ERROR"
};

function base(level, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${level}]`, JSON.stringify({ timestamp, ...data }));
}

function rawEvent(payload) {
  base(levels.RAW_EVENT_RECEIVED, { payload });
}

function eventTypeDetected({ eventType, callId, toolCallId, toolName }) {
  base(levels.EVENT_TYPE_DETECTED, { eventType, callId, toolCallId, toolName });
}

function toolCallExtracted({ callId, toolCallId, toolName, args }) {
  base(levels.TOOL_CALL_EXTRACTED, { callId, toolCallId, toolName, args });
}

function normalizedData({ callId, toolCallId, original, normalized }) {
  base(levels.NORMALIZED_DATA, { callId, toolCallId, original, normalized });
}

function validationResult({ callId, toolCallId, ok, reason, data }) {
  base(levels.VALIDATION_RESULT, { callId, toolCallId, ok, reason, data });
}

function bookingCreated({ callId, toolCallId, bookingId, booking }) {
  base(levels.BOOKING_CREATED, { callId, toolCallId, bookingId, booking });
}

function bookingRejected({ callId, toolCallId, reason, data }) {
  base(levels.BOOKING_REJECTED_REASON, { callId, toolCallId, reason, data });
}

function idempotencyHit({ callId, toolCallId, existingBookingId }) {
  base(levels.IDEMPOTENCY_HIT, { callId, toolCallId, existingBookingId });
}

function ignoredEvent({ eventType, reason }) {
  base(levels.IGNORED_EVENT_REASON, { eventType, reason });
}

function webhookError({ callId, toolCallId, error }) {
  base(levels.WEBHOOK_ERROR, {
    callId,
    toolCallId,
    error: error?.message || String(error)
  });
}

export {
  levels,
  base,
  rawEvent,
  eventTypeDetected,
  toolCallExtracted,
  normalizedData,
  validationResult,
  bookingCreated,
  bookingRejected,
  idempotencyHit,
  ignoredEvent,
  webhookError
};
