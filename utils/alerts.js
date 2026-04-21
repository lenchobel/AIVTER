const alerts = [];
const lastAlertAtByType = new Map();

function nowIso() {
  return new Date().toISOString();
}

export function pushAlert({ type, message }, cooldownMs = 30_000) {
  const now = Date.now();
  const last = lastAlertAtByType.get(type) || 0;
  if (now - last < cooldownMs) return null;

  lastAlertAtByType.set(type, now);
  const alert = { type, message, timestamp: nowIso() };
  alerts.unshift(alert);
  if (alerts.length > 100) alerts.length = 100;
  return alert;
}

export function getAlerts(limit = 50) {
  const lim = Math.min(Number(limit) || 50, 100);
  return alerts.slice(0, lim);
}

export function maybeTriggerAlerts({ metrics, dbErrorSpike = false }) {
  const failureRate = metrics.totalRequests > 0 ? metrics.failureCount / metrics.totalRequests : 0;

  const out = [];
  if (failureRate > 0.4) {
    const a = pushAlert({ type: 'HIGH_FAILURE_RATE', message: `Failure rate critical: ${Math.round(failureRate * 100)}%` });
    if (a) out.push(a);
  } else if (failureRate > 0.2) {
    const a = pushAlert({ type: 'ELEVATED_FAILURE_RATE', message: `Failure rate degraded: ${Math.round(failureRate * 100)}%` });
    if (a) out.push(a);
  }

  if (dbErrorSpike) {
    const a = pushAlert({ type: 'DB_ERROR_SPIKE', message: 'Database errors spiking' });
    if (a) out.push(a);
  }

  if (metrics.slotConflictCount >= 20) {
    const a = pushAlert({ type: 'SLOT_CONFLICTS_HIGH', message: `Slot conflicts high: ${metrics.slotConflictCount}` });
    if (a) out.push(a);
  }

  if (metrics.responseTime?.maxMs >= 1000) {
    const a = pushAlert({ type: 'SLOW_RESPONSES', message: `Slow responses detected. max=${metrics.responseTime.maxMs}ms` });
    if (a) out.push(a);
  }

  return out;
}
