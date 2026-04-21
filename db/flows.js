import sqlite3 from 'sqlite3';

let db;

export async function initFlowsDb(databasePath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(databasePath, (err) => {
      if (err) return reject(err);

      db.serialize(() => {
        db.run(
          `CREATE TABLE IF NOT EXISTS flows (
            id TEXT PRIMARY KEY,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            status TEXT NOT NULL,
            failureStage TEXT,
            failureReason TEXT,
            totalDurationMs INTEGER,
            data TEXT NOT NULL
          )`,
          (tableErr) => {
            if (tableErr) return reject(tableErr);

            db.run(
              'CREATE INDEX IF NOT EXISTS idx_flows_updatedAt ON flows(updatedAt DESC)',
              (indexErr) => {
                if (indexErr) return reject(indexErr);
                resolve(db);
              }
            );
          }
        );
      });
    });
  });
}

export function getFlowsDb() {
  if (!db) throw new Error('Flows DB not initialized');
  return db;
}

export async function upsertFlow({
  id,
  createdAt,
  updatedAt,
  status,
  failureStage = null,
  failureReason = null,
  totalDurationMs = null,
  data
}) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data ?? {});

  return new Promise((resolve, reject) => {
    getFlowsDb().run(
      `INSERT INTO flows (id, createdAt, updatedAt, status, failureStage, failureReason, totalDurationMs, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         updatedAt=excluded.updatedAt,
         status=excluded.status,
         failureStage=excluded.failureStage,
         failureReason=excluded.failureReason,
         totalDurationMs=excluded.totalDurationMs,
         data=excluded.data`,
      [
        id,
        createdAt,
        updatedAt,
        status,
        failureStage,
        failureReason,
        totalDurationMs,
        payload
      ],
      (err) => {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

export async function cleanupOldFlows(keep = 1000) {
  const limit = Math.max(0, Number(keep) || 1000);

  return new Promise((resolve, reject) => {
    getFlowsDb().run(
      `DELETE FROM flows
       WHERE id NOT IN (
         SELECT id FROM flows
         ORDER BY updatedAt DESC
         LIMIT ?
       )`,
      [limit],
      function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes || 0 });
      }
    );
  });
}

export async function listFlows(limit = 50, offset = 0) {
  const lim = Math.min(Number(limit) || 50, 100);
  const off = Math.max(Number(offset) || 0, 0);

  return new Promise((resolve, reject) => {
    getFlowsDb().all(
      `SELECT * FROM flows
       ORDER BY updatedAt DESC
       LIMIT ? OFFSET ?`,
      [lim, off],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

export async function countFlows() {
  return new Promise((resolve, reject) => {
    getFlowsDb().get('SELECT COUNT(*) as c FROM flows', (err, row) => {
      if (err) return reject(err);
      resolve(row?.c || 0);
    });
  });
}

export async function getFlowRowById(id) {
  return new Promise((resolve, reject) => {
    getFlowsDb().get('SELECT * FROM flows WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export async function deleteAllFlows() {
  return new Promise((resolve, reject) => {
    getFlowsDb().run('DELETE FROM flows', function (err) {
      if (err) return reject(err);
      resolve({ deleted: this.changes || 0 });
    });
  });
}
