export function structuredLog({ level = 'info', message, callId = null, stage = null, extra = null }) {
  const payload = {
    level,
    message,
    callId,
    stage,
    timestamp: new Date().toISOString()
  };

  if (extra && typeof extra === 'object') {
    payload.extra = extra;
  }

  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}
