// STRIPE-STYLE FLOW INSPECTION LAYER
// UI-ready request lifecycle visualization for frontend consumption

import { upsertFlow, cleanupOldFlows, listFlows, countFlows, getFlowRowById, deleteAllFlows } from '../db/flows.js';

let FLOW_KEEP_LIMIT = 1000;

// Human-readable stage labels for UI
const STAGE_LABELS = {
  'WEBHOOK_RECEIVED': 'Webhook Received',
  'REQUEST_VALIDATION': 'Request Validation',
  'IDEMPOTENCY_CHECK': 'Idempotency Check',
  'PAYLOAD_EXTRACTION': 'Payload Extraction',
  'NORMALIZATION': 'Data Normalization',
  'BUSINESS_RULES': 'Business Rules',
  'DATABASE_WRITE': 'Database Write',
  'EVENT_EMISSION': 'Event Emission',
  'RESPONSE_SENT': 'Response Sent',
  'UNKNOWN': 'Unknown Stage'
};

// Stage descriptions for UI tooltips
const STAGE_DESCRIPTIONS = {
  'WEBHOOK_RECEIVED': 'VAPI webhook hit the endpoint',
  'REQUEST_VALIDATION': 'Required fields validated',
  'IDEMPOTENCY_CHECK': 'Duplicate request prevention',
  'PAYLOAD_EXTRACTION': 'Arguments extracted from payload',
  'NORMALIZATION': 'Date and time normalized',
  'BUSINESS_RULES': 'Clinic hours, availability checked',
  'DATABASE_WRITE': 'Booking persisted to database',
  'EVENT_EMISSION': 'Events fired for downstream',
  'RESPONSE_SENT': 'Response returned to VAPI',
  'UNKNOWN': 'Unhandled stage'
};

/**
 * Initialize a new flow record for a request
 */
export function initFlowRecord(callId, toolCallId, initialPayload = null) {
  const now = Date.now();
  const id = String(callId || toolCallId || 'unknown');
  const flowRecord = {
    callId: callId || 'unknown',
    toolCallId: toolCallId || 'unknown',
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    startTime: now,
    endTime: null,
    durationMs: null,
    stages: [],
    // UI-ready summary (populated during flow)
    summary: {
      name: null,
      service: null,
      date: null,
      time: null,
      bookingId: null,
      errorReason: null,
      rawPayload: initialPayload
    }
  };

  // Persist immediately (fire-and-forget)
  upsertFlow({
    id,
    createdAt: flowRecord.createdAt,
    updatedAt: flowRecord.createdAt,
    status: flowRecord.status,
    failureStage: null,
    failureReason: null,
    totalDurationMs: null,
    data: flowRecord
  }).then(() => cleanupOldFlows(FLOW_KEEP_LIMIT)).catch(() => {});

  return flowRecord;
}

/**
 * Update summary data (called when payload is extracted)
 */
export function updateFlowSummary(callId, summaryData) {
  const id = String(callId || 'unknown');

  // Read-modify-write via DB row
  getFlowRowById(id).then((row) => {
    if (!row) return;
    const flow = JSON.parse(row.data);
    flow.summary = { ...flow.summary, ...summaryData };
    flow.updatedAt = new Date().toISOString();
    return upsertFlow({
      id,
      createdAt: row.createdAt,
      updatedAt: flow.updatedAt,
      status: flow.status,
      failureStage: flow.summary?.failureStage || null,
      failureReason: flow.summary?.errorReason || null,
      totalDurationMs: flow.durationMs ?? null,
      data: flow
    });
  }).catch(() => {});

  return summaryData;
}

/**
 * Record a stage completion from trace context
 */
export function recordStage(callId, stageData) {
  const id = String(callId || 'unknown');
  
  const stageEntry = {
    stage: stageData.stage,
    status: stageData.status,
    label: STAGE_LABELS[stageData.stage] || stageData.stage,
    description: STAGE_DESCRIPTIONS[stageData.stage] || '',
    timestamp: stageData.enteredAt || new Date().toISOString(),
    exitedAt: stageData.exitedAt || null,
    durationMs: stageData.duration || 0,
    metadata: stageData.metadata || {}
  };
  
  getFlowRowById(id).then((row) => {
    if (!row) return;
    const flow = JSON.parse(row.data);
    const existingIndex = flow.stages.findIndex(s => s.stage === stageData.stage);
    if (existingIndex >= 0) flow.stages[existingIndex] = stageEntry;
    else flow.stages.push(stageEntry);
    const updatedAt = new Date().toISOString();
    flow.updatedAt = updatedAt;
    return upsertFlow({
      id,
      createdAt: row.createdAt,
      updatedAt,
      status: flow.status,
      failureStage: flow.failureStage || null,
      failureReason: flow.failureReason || null,
      totalDurationMs: flow.durationMs ?? null,
      data: flow
    });
  }).then(() => cleanupOldFlows(FLOW_KEEP_LIMIT)).catch(() => {});

  return stageEntry;
}

/**
 * Finalize flow record on request completion
 */
export function finalizeFlowRecord(callId, finalStatus, resultData = {}) {
  const id = String(callId || 'unknown');

  getFlowRowById(id).then((row) => {
    if (!row) return;
    const flow = JSON.parse(row.data);
    const now = Date.now();
    flow.endTime = now;
    flow.durationMs = flow.startTime ? now - flow.startTime : flow.durationMs;
    flow.status = finalStatus;
    flow.summary = {
      ...flow.summary,
      bookingId: resultData.bookingId || flow.summary.bookingId || null,
      errorReason: resultData.errorReason || flow.summary.errorReason || null
    };
    flow.failure = {
      stage: resultData.stage || flow.summary?.stage || null,
      reason: resultData.errorReason || flow.summary?.errorReason || null
    };

    const updatedAt = new Date().toISOString();
    return upsertFlow({
      id,
      createdAt: row.createdAt,
      updatedAt,
      status: finalStatus,
      failureStage: flow.failure?.stage || null,
      failureReason: flow.failure?.reason || null,
      totalDurationMs: flow.durationMs ?? null,
      data: flow
    });
  }).then(() => cleanupOldFlows(FLOW_KEEP_LIMIT)).catch(() => {});

  return { callId: id, status: finalStatus };
}

/**
 * Build UI-ready timeline from stages
 */
function buildTimeline(flow) {
  return flow.stages.map((stage, index) => ({
    step: index + 1,
    stage: stage.stage,
    status: stage.status,
    label: stage.label,
    description: stage.description,
    timestamp: stage.timestamp,
    durationMs: stage.durationMs,
    relativeTimeMs: new Date(stage.timestamp).getTime() - flow.startTime,
    metadata: stage.metadata
  }));
}

/**
 * Transform flow to UI-ready format (transaction card)
 */
function toUIFlowObject(flow) {
  return {
    callId: flow.callId,
    toolCallId: flow.toolCallId,
    status: flow.status,
    createdAt: flow.createdAt,
    durationMs: flow.durationMs,
    summary: {
      ...flow.summary,
      responseTimeMs: flow.summary?.responseTimeMs ?? null,
      finalStatus: flow.summary?.finalStatus ?? flow.status
    },
    timeline: buildTimeline(flow),
    stageCount: flow.stages.length
  };
}

/**
 * Get all flow records with UI-ready formatting (sorted by latest first)
 */
export async function getAllFlows(limit = 50, offset = 0) {
  const lim = Math.min(Number(limit) || 50, 100);
  const off = Math.max(Number(offset) || 0, 0);

  const rows = await listFlows(lim, off);
  const total = await countFlows();

  let successful = 0;
  let failed = 0;
  let durationSum = 0;
  let durationCount = 0;

  // Minimal stats computed from returned page (avoid heavy full-table scan)
  const flows = rows
    .map((r) => {
      try {
        return JSON.parse(r.data);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  flows.forEach((f) => {
    if (f.status === 'success') successful += 1;
    if (f.status === 'failed' || f.status === 'error') failed += 1;
    if (typeof f.durationMs === 'number') {
      durationSum += f.durationMs;
      durationCount += 1;
    }
  });

  const avgDuration = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;
  const successRate = successful + failed > 0 ? Math.round((successful / (successful + failed)) * 100) : 0;

  return {
    total,
    successRate,
    avgDurationMs: avgDuration,
    successful,
    failed,
    count: flows.length,
    offset: off,
    hasMore: total > off + lim,
    flows: flows.map(toUIFlowObject)
  };
}

/**
 * Get latest flows for streaming/polling (lightweight)
 */
export async function getLatestFlows(count = 20) {
  const lim = Math.min(Number(count) || 20, 50);
  const rows = await listFlows(lim, 0);
  const flows = rows
    .map((r) => {
      try {
        return JSON.parse(r.data);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return {
    count: Math.min(lim, flows.length),
    flows: flows.slice(0, lim).map((flow) => ({
      callId: flow.callId,
      status: flow.status,
      createdAt: flow.createdAt,
      durationMs: flow.durationMs,
      summary: {
        name: flow.summary?.name,
        service: flow.summary?.service,
        bookingId: flow.summary?.bookingId,
        errorReason: flow.summary?.errorReason
      },
      stageCount: flow.stages?.length || 0
    }))
  };
}

/**
 * Get full flow record with navigation (previous/next)
 */
export async function getFlowByCallId(callId) {
  const id = String(callId || '');
  if (!id) return null;

  const row = await getFlowRowById(id);
  if (!row) return null;

  let flow;
  try {
    flow = JSON.parse(row.data);
  } catch {
    return null;
  }

  // Navigation: derive neighbors from latest 1000 (bounded)
  const rows = await listFlows(1000, 0);
  const ids = rows.map((r) => r.id);
  const currentIndex = ids.findIndex((x) => String(x) === id);
  const previousCallId = currentIndex >= 0 && currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null;
  const nextCallId = currentIndex > 0 ? ids[currentIndex - 1] : null;

  return {
    flow: toUIFlowObject(flow),
    navigation: {
      previousCallId,
      nextCallId,
      position: currentIndex >= 0 ? currentIndex + 1 : 1,
      total: ids.length
    }
  };
}

/**
 * Get flow statistics for dashboard
 */
export async function getFlowStats() {
  // Bounded scan for simple stats (keeps it safe + fast)
  const rows = await listFlows(1000, 0);
  const flows = rows
    .map((r) => {
      try {
        return JSON.parse(r.data);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const total = await countFlows();
  const successful = flows.filter(f => f.status === 'success').length;
  const failed = flows.filter(f => f.status === 'failed' || f.status === 'error').length;
  const pending = flows.filter(f => f.status === 'pending').length;
  const duplicate = flows.filter(f => f.status === 'duplicate').length;

  const avgDuration = flows.length > 0
    ? Math.round(flows.reduce((sum, f) => sum + (f.durationMs || 0), 0) / flows.length)
    : 0;

  const successRate = successful + failed > 0 ? Math.round((successful / (successful + failed)) * 100) : 0;

  const stageStats = {};
  flows.forEach(flow => {
    (flow.stages || []).forEach(stage => {
      if (!stageStats[stage.stage]) {
        stageStats[stage.stage] = { count: 0, avgDuration: 0, failures: 0 };
      }
      stageStats[stage.stage].count++;
      stageStats[stage.stage].avgDuration += stage.durationMs || 0;
      if (stage.status === 'failed') stageStats[stage.stage].failures++;
    });
  });
  Object.keys(stageStats).forEach(stage => {
    const stat = stageStats[stage];
    stat.avgDuration = stat.count > 0 ? Math.round(stat.avgDuration / stat.count) : 0;
    stat.label = STAGE_LABELS[stage] || stage;
  });

  return {
    total,
    successful,
    failed,
    pending,
    duplicate,
    successRate,
    avgDurationMs: avgDuration,
    oldestRecord: flows.length > 0 ? flows[flows.length - 1].createdAt : null,
    newestRecord: flows.length > 0 ? flows[0].createdAt : null,
    stageStats
  };
}

/**
 * Sync with trace context - converts trace to flow record with UI data
 */
export function syncFromTraceContext(traceContext, finalStatus, resultData) {
  const callId = traceContext.callId;

  // Ensure base record exists
  initFlowRecord(callId, traceContext.toolCallId);

  // Persist stages + summary
  traceContext.stages.forEach(stage => recordStage(callId, stage));
  if (resultData.summary) updateFlowSummary(callId, resultData.summary);

  // Finalize
  return finalizeFlowRecord(callId, finalStatus, resultData);
}

/**
 * Clear all flows (for debugging)
 */
export function clearAllFlows() {
  return deleteAllFlows().then((r) => ({ cleared: true, count: 0, previousCount: r?.deleted || 0 })).catch(() => ({ cleared: false, count: 0, previousCount: 0 }));
}

export default {
  initFlowRecord,
  updateFlowSummary,
  recordStage,
  finalizeFlowRecord,
  getAllFlows,
  getLatestFlows,
  getFlowByCallId,
  getFlowStats,
  syncFromTraceContext,
  clearAllFlows,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS
};
