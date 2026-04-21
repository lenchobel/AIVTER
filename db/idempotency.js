import sqlite3 from 'sqlite3';

let db;

export async function initIdempotencyDb(databasePath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(databasePath, (err) => {
      if (err) return reject(err);

      db.run(
        `CREATE TABLE IF NOT EXISTS idempotency (
          key TEXT PRIMARY KEY,
          response TEXT NOT NULL,
          createdAt TEXT NOT NULL
        )`,
        (tableErr) => {
          if (tableErr) return reject(tableErr);
          resolve(db);
        }
      );
    });
  });
}

export function getIdempotencyDb() {
  if (!db) throw new Error('Idempotency DB not initialized');
  return db;
}

export async function getIdempotencyResponse(key) {
  return new Promise((resolve, reject) => {
    getIdempotencyDb().get(
      'SELECT response FROM idempotency WHERE key = ?',
      [key],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        try {
          resolve(JSON.parse(row.response));
        } catch {
          resolve(null);
        }
      }
    );
  });
}

export async function putIdempotencyResponse(key, responseObj) {
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify(responseObj ?? {});

  return new Promise((resolve, reject) => {
    getIdempotencyDb().run(
      `INSERT INTO idempotency (key, response, createdAt)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         response=excluded.response`,
      [key, payload, createdAt],
      (err) => {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}
