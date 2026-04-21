// FAILURE CONTROL LAYER - Central failure logging
// All failures across the system MUST use this format

const VALID_STAGES = [
  'WEBHOOK_VALIDATION',
  'IDEMPOTENCY_CHECK',
  'PAYLOAD_EXTRACTION',
  'NORMALIZATION',
  'BUSINESS_RULES',
  'DATABASE_WRITE',
  'EVENT_EMISSION',
  'UNKNOWN'
];

/**
 * Log a failure with standardized format
 * @param {string} stage - One of VALID_STAGES
 * @param {string} reason - Short reason code
 * @param {object} context - Must include callId and toolCallId if available
 */
export function logFailure(stage, reason, context = {}) {
  if (!VALID_STAGES.includes(stage)) {
    stage = 'UNKNOWN';
  }

  const failureObject = {
    error: true,
    stage,
    reason,
    callId: context.callId || 'unknown',
    toolCallId: context.toolCallId || 'unknown',
    timestamp: new Date().toISOString(),
    data: context.data || null
  };

  console.log(`[FAILURE][${stage}]`, JSON.stringify(failureObject));
  return failureObject;
}

/**
 * Create a standardized failure response for webhook
 */
export function createFailureResponse(stage, reason, context = {}) {
  return {
    status: 'failed',
    stage,
    reason,
    callId: context.callId || 'unknown',
    toolCallId: context.toolCallId || 'unknown',
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a standardized BOOKING_FAILED event payload
 */
export function createBookingFailedEvent(stage, reason, context = {}) {
  return {
    error: true,
    stage,
    reason,
    callId: context.callId || 'unknown',
    toolCallId: context.toolCallId || 'unknown',
    timestamp: new Date().toISOString(),
    data: context.data || null
  };
}

export default { logFailure, createFailureResponse, createBookingFailedEvent };
