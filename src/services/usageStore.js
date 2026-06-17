/**
 * SECOND SOUL — Usage Store
 * V5
 *
 * SQLite storage for App usage sessions.
 * One row per session (FOREGROUND→BACKGROUND pair).
 *
 * Schema:
 *   app_sessions(
 *     id, package_name, category,
 *     start_ts, end_ts, duration,
 *     date, hour
 *   )
 *
 * NO aggregation. NO scoring. NO derived columns.
 * The engine reads raw sessions and infers structure from them.
 */

import * as SQLite from 'expo-sqlite';

let db = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initUsageStore() {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('second_soul.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS app_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      package_name TEXT    NOT NULL,
      category     TEXT    NOT NULL DEFAULT 'unknown',
      start_ts     INTEGER NOT NULL,
      end_ts       INTEGER NOT NULL,
      duration     INTEGER NOT NULL,
      date         TEXT    NOT NULL,
      hour         INTEGER NOT NULL,
      UNIQUE(package_name, start_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_app_date     ON app_sessions(date);
    CREATE INDEX IF NOT EXISTS idx_app_pkg      ON app_sessions(package_name);
    CREATE INDEX IF NOT EXISTS idx_app_cat      ON app_sessions(category);
    CREATE INDEX IF NOT EXISTS idx_app_start_ts ON app_sessions(start_ts);
  `);

  return db;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of App sessions.
 * UNIQUE(package_name, start_ts) prevents duplicates across syncs.
 * ON CONFLICT REPLACE updates end_ts/duration for still-open sessions.
 *
 * @param {Array} sessions  From usageCollector.buildSessionsFromTimeline()
 */
export async function upsertAppSessions(sessions) {
  if (!db || sessions.length === 0) return;

  // Batch in chunks of 100 to avoid SQLite variable limits
  const CHUNK = 100;
  for (let i = 0; i < sessions.length; i += CHUNK) {
    const chunk = sessions.slice(i, i + CHUNK);
    await db.withTransactionAsync(async () => {
      for (const s of chunk) {
        await db.runAsync(
          `INSERT INTO app_sessions
             (package_name, category, start_ts, end_ts, duration, date, hour)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(package_name, start_ts)
           DO UPDATE SET
             end_ts   = excluded.end_ts,
             duration = excluded.duration`,
          [
            s.packageName,
            s.category,
            s.start_ts,
            s.end_ts,
            s.duration,
            s.date,
            s.hour,
          ]
        );
      }
    });
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * All completed sessions ordered by start_ts.
 * Used by SecondSoulEngine.
 */
export async function getAllAppSessions() {
  if (!db) return [];
  return await db.getAllAsync(
    `SELECT * FROM app_sessions
     WHERE duration > 0
     ORDER BY start_ts ASC`
  );
}

/**
 * Sessions within a date range.
 * @param {string} fromDate  YYYY-MM-DD
 * @param {string} toDate    YYYY-MM-DD
 */
export async function getAppSessionsByDate(fromDate, toDate) {
  if (!db) return [];
  return await db.getAllAsync(
    `SELECT * FROM app_sessions
     WHERE date >= ? AND date <= ? AND duration > 0
     ORDER BY start_ts ASC`,
    [fromDate, toDate]
  );
}

/**
 * All distinct dates with session data — for engine completeness check.
 */
export async function getActiveDates() {
  if (!db) return [];
  const rows = await db.getAllAsync(
    `SELECT DISTINCT date FROM app_sessions
     WHERE duration > 0
     ORDER BY date ASC`
  );
  return rows.map(r => r.date);
}

/**
 * Session count by category for a given date.
 * Used only for debug display — not for engine inference.
 */
export async function getCategoryBreakdown(date) {
  if (!db) return {};
  const rows = await db.getAllAsync(
    `SELECT category, COUNT(*) as count,
            SUM(duration) as total_duration
     FROM app_sessions
     WHERE date = ? AND duration > 0
     GROUP BY category`,
    [date]
  );
  const result = {};
  for (const r of rows) {
    result[r.category] = { count: r.count, total_duration: r.total_duration };
  }
  return result;
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export async function pruneOldAppSessions(retentionDays = 60) {
  if (!db) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  const result = await db.runAsync(
    `DELETE FROM app_sessions WHERE date < ?`, [cutoffDate]
  );
  console.log(`[UsageStore] Pruned sessions before ${cutoffDate}: ${result.changes} rows`);
}
