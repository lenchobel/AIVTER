import http from 'http';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/vapi-webhook';
const RPS = parseInt(process.env.RPS) || 10;
const DURATION_SEC = parseInt(process.env.DURATION) || 30;
const [host, port] = WEBHOOK_URL.replace('http://', '').replace('https://', '').split(/\/|:/).filter(Boolean);

let sent = 0;
let ok = 0;
let fail = 0;
let startTime = Date.now();
let active = true;

const services = ['cleaning', 'checkup', 'whitening'];
const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];

function randDate() {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * 14));
  return d.toISOString().split('T')[0];
}

function randTime() {
  const hour = 9 + Math.floor(Math.random() * 9);
  const min = Math.random() > 0.5 ? '00' : '30';
  return `${hour}:${min}`;
}

function randPayload(type) {
  if (type === 'valid') {
    return {
      call: { id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      toolCall: {
        id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        function: {
          arguments: {
            name: names[Math.floor(Math.random() * names.length)],
            service: services[Math.floor(Math.random() * services.length)],
            date: randDate(),
            time: randTime()
          }
        }
      }
    };
  }
  if (type === 'missing_callId') {
    return {
      toolCall: {
        id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        function: { arguments: { name: 'X', service: 'cleaning', date: randDate(), time: randTime() } }
      }
    };
  }
  if (type === 'missing_args') {
    return {
      call: { id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      toolCall: { id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, function: { arguments: null } }
    };
  }
  if (type === 'duplicate') {
    const fixedCallId = 'dup-call-001';
    const fixedToolId = 'dup-tool-001';
    return {
      call: { id: fixedCallId },
      toolCall: {
        id: fixedToolId,
        function: {
          arguments: {
            name: 'DupUser',
            service: 'cleaning',
            date: '2026-05-01',
            time: '10:00'
          }
        }
      }
    };
  }
  if (type === 'slot_conflict') {
    return {
      call: { id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      toolCall: {
        id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        function: {
          arguments: {
            name: names[Math.floor(Math.random() * names.length)],
            service: 'cleaning',
            date: '2026-06-15',
            time: '14:00'
          }
        }
      }
    };
  }
  return randPayload('valid');
}

function request(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: host,
      port: port || 3001,
      path: '/vapi-webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, success: !!json.success, duplicate: !!json.duplicate });
        } catch {
          resolve({ status: res.statusCode, success: false });
        }
      });
    });

    req.on('error', () => resolve({ status: 0, success: false }));
    req.write(data);
    req.end();
  });
}

async function fire() {
  const r = Math.random();
  let type = 'valid';
  if (r < 0.15) type = 'missing_callId';
  else if (r < 0.25) type = 'missing_args';
  else if (r < 0.35) type = 'duplicate';
  else if (r < 0.45) type = 'slot_conflict';

  const payload = randPayload(type);
  const res = await request(payload);
  sent++;
  if (res.success) ok++;
  else fail++;
}

async function tick() {
  const batch = Array.from({ length: RPS }, () => fire());
  await Promise.all(batch);
}

async function fetchHealth() {
  return new Promise((resolve) => {
    http.get(`http://${host}:${port || 3001}/health`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchAlerts() {
  return new Promise((resolve) => {
    http.get(`http://${host}:${port || 3001}/alerts`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body)?.alerts || []);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

function printStats() {
  const elapsed = (Date.now() - startTime) / 1000;
  const rps = (sent / elapsed).toFixed(1);
  const failRate = sent > 0 ? ((fail / sent) * 100).toFixed(1) : 0;
  console.clear();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  LOAD TEST: ${RPS} r/s for ${DURATION_SEC}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Sent:      ${sent}`);
  console.log(`  OK:        ${ok}`);
  console.log(`  Failed:    ${fail} (${failRate}%)`);
  console.log(`  Elapsed:   ${elapsed.toFixed(1)}s`);
  console.log(`  Actual:    ${rps} req/s`);
  console.log('');
}

async function printHealthAndAlerts() {
  const h = await fetchHealth();
  const a = await fetchAlerts();
  if (h) {
    console.log('  Health:');
    console.log(`    status:         ${h.status}`);
    console.log(`    failureRate:    ${(h.failureRate * 100).toFixed(1)}%`);
    console.log(`    avgResponseTime:${h.avgResponseTime}ms`);
  }
  if (a.length > 0) {
    console.log('');
    console.log('  Active Alerts:');
    a.slice(0, 5).forEach((al) => console.log(`    ⚠️  ${al.type}: ${al.message}`));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function main() {
  console.log(`Starting load test: ${RPS} req/s for ${DURATION_SEC}s → ${WEBHOOK_URL}`);
  console.log('Types: valid (55%), missing_callId (10%), missing_args (10%), duplicate (10%), slot_conflict (10%)');
  console.log('');

  const interval = setInterval(tick, 1000);
  const statsInterval = setInterval(async () => {
    printStats();
    await printHealthAndAlerts();
  }, 2000);

  setTimeout(() => {
    active = false;
    clearInterval(interval);
    clearInterval(statsInterval);
    printStats();
    printHealthAndAlerts().then(() => {
      console.log('');
      console.log('Load test complete.');
      process.exit(0);
    });
  }, DURATION_SEC * 1000);
}

main();
