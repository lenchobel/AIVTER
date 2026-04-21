let metrics = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  idempotencyHits: 0,
  slotConflictCount: 0,
  failureByStage: {
    VALIDATION: 0,
    BUSINESS_RULES: 0,
    DB_WRITE: 0
  },
  responseTime: {
    count: 0,
    totalMs: 0,
    avgMs: 0,
    maxMs: 0
  },
  recentFailures: []
};

export function recordRequestStart() {
  metrics.totalRequests += 1;
}

export function recordIdempotencyHit() {
  metrics.idempotencyHits += 1;
}

export function recordSlotConflict() {
  metrics.slotConflictCount += 1;
}

function stageBucket(stage) {
  if (!stage) return null;
  if (stage === 'REQUEST_VALIDATION' || stage === 'WEBHOOK_RECEIVED' || stage === 'PAYLOAD_EXTRACTION' || stage === 'IDEMPOTENCY_CHECK') return 'VALIDATION';
  if (stage === 'BUSINESS_RULES' || stage === 'NORMALIZATION') return 'BUSINESS_RULES';
  if (stage === 'DATABASE_WRITE') return 'DB_WRITE';
  return null;
}

export function recordRequestEnd({ success, stage, code, message, responseTimeMs, isDbError = false }) {
  if (success) metrics.successCount += 1;
  else metrics.failureCount += 1;

  const bucket = stageBucket(stage);
  if (!success && bucket) {
    metrics.failureByStage[bucket] += 1;
  }

  if (typeof responseTimeMs === 'number' && Number.isFinite(responseTimeMs) && responseTimeMs >= 0) {
    metrics.responseTime.count += 1;
    metrics.responseTime.totalMs += responseTimeMs;
    metrics.responseTime.avgMs = Math.round(metrics.responseTime.totalMs / metrics.responseTime.count);
    metrics.responseTime.maxMs = Math.max(metrics.responseTime.maxMs, responseTimeMs);
  }

  if (!success) {
    metrics.recentFailures.unshift({
      stage: stage || null,
      code: code || null,
      message: message || null,
      isDbError: !!isDbError,
      timestamp: new Date().toISOString()
    });
    metrics.recentFailures = metrics.recentFailures.slice(0, 5);
  }
}

export function getMetricsSnapshot() {
  return JSON.parse(JSON.stringify(metrics));
}

export function getFailureRate() {
  if (metrics.totalRequests === 0) return 0;
  return metrics.failureCount / metrics.totalRequests;
}

export function resetMetricsForTests() {
  metrics = {
    startedAt: new Date().toISOString(),
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    idempotencyHits: 0,
    slotConflictCount: 0,
    failureByStage: {
      VALIDATION: 0,
      BUSINESS_RULES: 0,
      DB_WRITE: 0
    },
    responseTime: {
      count: 0,
      totalMs: 0,
      avgMs: 0,
      maxMs: 0
    },
    recentFailures: []
  };
}
