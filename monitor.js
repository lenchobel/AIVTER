import { getMetricsSnapshot, getFailureRate } from './utils/metrics.js';
import { getAlerts } from './utils/alerts.js';

function percent(n) {
  return `${Math.round(n * 100)}%`;
}

let lastTotal = 0;

setInterval(() => {
  const m = getMetricsSnapshot();
  const total = m.totalRequests;
  const delta = total - lastTotal;
  lastTotal = total;

  const fr = getFailureRate();
  const max = m.responseTime.maxMs;
  const avg = m.responseTime.avgMs;
  const alerts = getAlerts(5);

  const line1 = `[MONITOR] req/5s=${delta} total=${total} failureRate=${percent(fr)} avg=${avg}ms max=${max}ms slotConflicts=${m.slotConflictCount} idempoHits=${m.idempotencyHits}`;
  console.log(line1);

  if (alerts.length > 0) {
    console.log('[MONITOR] recent alerts:');
    alerts.forEach((a) => console.log(`- ${a.timestamp} ${a.type}: ${a.message}`));
  }
}, 5000);
