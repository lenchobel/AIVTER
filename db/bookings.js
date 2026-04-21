import sqlite3 from 'sqlite3';

let db;

export async function initBookingsDb(databasePath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(databasePath, (err) => {
      if (err) return reject(err);

      db.run(
        `CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          callId TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          service TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          status TEXT DEFAULT 'confirmed',
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
        (tableErr) => {
          if (tableErr) return reject(tableErr);

          // Check if unique slot index already exists
          db.get(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_bookings_slot'",
            (idxErr, row) => {
              if (idxErr) return reject(idxErr);
              if (row) return resolve(db); // Index already exists

              // Dedupe slots before creating unique index (keep earliest)
              db.run(
                `DELETE FROM bookings WHERE id NOT IN (
                  SELECT MIN(id) FROM bookings GROUP BY date, time, service
                )`,
                (dedupeErr) => {
                  if (dedupeErr && !dedupeErr.message.includes('no such column')) {
                    console.warn('[bookings] Dedupe warning:', dedupeErr.message);
                  }
                  db.run(
                    'CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(date, time, service)',
                    (indexErr) => {
                      if (indexErr) {
                        console.error('[bookings] Failed to create slot index:', indexErr.message);
                        return resolve(db); // Start anyway, log warning
                      }
                      resolve(db);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
}

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function getBookingByCallId(callId) {
  return new Promise((resolve, reject) => {
    getDb().get('SELECT * FROM bookings WHERE callId = ?', [callId], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function getBookingBySlot(date, time) {
  return new Promise((resolve, reject) => {
    getDb().get(
      'SELECT * FROM bookings WHERE date = ? AND time = ? AND status = ?',
      [date, time, 'confirmed'],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

export function createBooking({ callId, name, service, date, time }) {
  return new Promise((resolve, reject) => {
    getDb().run(
      'INSERT INTO bookings (callId, name, service, date, time) VALUES (?, ?, ?, ?, ?)',
      [callId, name, service, date, time],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, callId, name, service, date, time, status: 'confirmed' });
      }
    );
  });
}

export function listBookings() {
  return new Promise((resolve, reject) => {
    getDb().all('SELECT * FROM bookings ORDER BY createdAt DESC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}
