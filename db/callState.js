import sqlite3 from 'sqlite3';

let db;

export async function initCallStateDb(databasePath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(databasePath, (err) => {
      if (err) return reject(err);

      db.run(
        `CREATE TABLE IF NOT EXISTS call_state (
          callId TEXT PRIMARY KEY,
          state_json TEXT NOT NULL,
          lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
        (tableErr) => {
          if (tableErr) return reject(tableErr);
          resolve(db);
        }
      );
    });
  });
}

export function getDb() {
  if (!db) throw new Error('CallState DB not initialized');
  return db;
}

export function upsertCallState(callId, stateObj) {
  const state_json = JSON.stringify(stateObj ?? {});
  return new Promise((resolve, reject) => {
    getDb().run(
      `INSERT INTO call_state (callId, state_json, lastUpdated)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(callId) DO UPDATE SET
         state_json=excluded.state_json,
         lastUpdated=CURRENT_TIMESTAMP`,
      [callId, state_json],
      (err) => {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

export function getCallState(callId) {
  return new Promise((resolve, reject) => {
    getDb().get('SELECT * FROM call_state WHERE callId = ?', [callId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);

      try {
        resolve({
          callId: row.callId,
          state: JSON.parse(row.state_json),
          lastUpdated: row.lastUpdated
        });
      } catch {
        resolve({ callId: row.callId, state: {}, lastUpdated: row.lastUpdated });
      }
    });
  });
}
