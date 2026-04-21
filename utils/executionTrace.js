// EXECUTION TRACE SYSTEM - Stage-based request tracing
// DO NOT modify business logic - only observability

const STAGES = [
  'WEBHOOK_RECEIVED',
  'REQUEST_VALIDATION',
  'IDEMPOTENCY_CHECK',
  'PAYLOAD_EXTRACTION',
  'NORMALIZATION',
  'BUSINESS_RULES',
  'DATABASE_WRITE',
  'EVENT_EMISSION',
  'RESPONSE_SENT'
];

/**
 * Create a new trace context for a request
 */
export function createTraceContext(callId, toolCallId) {
  return {
    callId: callId || 'unknown',
    toolCallId: toolCallId || 'unknown',
    currentStage: null,
    startedAt: new Date().toISOString(),
    stages: []
  };
}

/**
 * Enter a stage - logs start of stage execution
 */
export function enterStage(traceContext, stageName, metadata = {}) {
  if (!STAGES.includes(stageName)) {
    console.warn(`[TRACE][WARNING] Unknown stage: ${stageName}`);
  }

  traceContext.currentStage = stageName;
  
  const stageEntry = {
    stage: stageName,
    status: 'pending',
    enteredAt: new Date().toISOString(),
    exitedAt: null,
    duration: null,
    metadata
  };
  
  traceContext.stages.push(stageEntry);
  
  console.log(`[TRACE][${stageName}] callId=${traceContext.callId} toolCallId=${traceContext.toolCallId} ENTER`, 
    JSON.stringify(metadata));
  
  return stageEntry;
}

/**
 * Exit a stage - marks completion with status
 */
export function exitStage(traceContext, stageName, status, metadata = {}) {
  const stageEntry = traceContext.stages.find(s => s.stage === stageName && s.status === 'pending');
  
  if (!stageEntry) {
    console.warn(`[TRACE][WARNING] No pending stage found for: ${stageName}`);
    return null;
  }
  
  stageEntry.status = status;
  stageEntry.exitedAt = new Date().toISOString();
  stageEntry.duration = new Date(stageEntry.exitedAt) - new Date(stageEntry.enteredAt);
  
  if (metadata && Object.keys(metadata).length > 0) {
    stageEntry.metadata = { ...stageEntry.metadata, ...metadata };
  }
  
  console.log(`[TRACE][${stageName}] callId=${traceContext.callId} toolCallId=${traceContext.toolCallId} ${status.toUpperCase()} duration=${stageEntry.duration}ms`,
    JSON.stringify(metadata));
  
  return stageEntry;
}

/**
 * Mark stage as failed with error details
 */
export function failStage(traceContext, stageName, reason, errorData = {}) {
  return exitStage(traceContext, stageName, 'failed', { 
    reason, 
    error: errorData,
    failedAt: new Date().toISOString()
  });
}

/**
 * Mark stage as succeeded
 */
export function succeedStage(traceContext, stageName, metadata = {}) {
  return exitStage(traceContext, stageName, 'success', metadata);
}

/**
 * Print final trace summary - called at end of every request
 */
export function printTraceSummary(traceContext, finalStatus) {
  const completedAt = new Date().toISOString();
  const totalDuration = new Date(completedAt) - new Date(traceContext.startedAt);
  
  const summary = {
    callId: traceContext.callId,
    toolCallId: traceContext.toolCallId,
    finalStatus,
    startedAt: traceContext.startedAt,
    completedAt,
    totalDuration: `${totalDuration}ms`,
    stageCount: traceContext.stages.length,
    stages: traceContext.stages.map(s => ({
      stage: s.stage,
      status: s.status,
      duration: s.duration ? `${s.duration}ms` : 'N/A',
      metadata: s.metadata
    }))
  };
  
  console.log(`[TRACE_SUMMARY] callId=${traceContext.callId} status=${finalStatus} totalDuration=${totalDuration}ms`,
    JSON.stringify(summary));
  
  return summary;
}

/**
 * Attach trace to failure object
 */
export function attachTraceToFailure(failureObject, traceContext) {
  return {
    ...failureObject,
    trace: {
      callId: traceContext.callId,
      toolCallId: traceContext.toolCallId,
      startedAt: traceContext.startedAt,
      stages: traceContext.stages.map(s => ({
        stage: s.stage,
        status: s.status,
        duration: s.duration,
        metadata: s.metadata
      }))
    }
  };
}

/**
 * Get current trace state for debugging
 */
export function getTraceState(traceContext) {
  return {
    currentStage: traceContext.currentStage,
    stagesCompleted: traceContext.stages.filter(s => s.status !== 'pending').length,
    stagesPending: traceContext.stages.filter(s => s.status === 'pending').length,
    totalStages: traceContext.stages.length
  };
}

export default {
  createTraceContext,
  enterStage,
  exitStage,
  failStage,
  succeedStage,
  printTraceSummary,
  attachTraceToFailure,
  getTraceState,
  STAGES
};
