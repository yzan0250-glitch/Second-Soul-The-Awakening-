/**
 * SECOND SOUL — Soul Log Database
 *
 * Role: raw sensor snapshot storage ONLY.
 *
 * This module has NO authority over:
 *   - DAY count  (owned by App.js via AsyncStorage)
 *   - Onboarding (owned by App.js via AsyncStorage)
 *
 * Tables: soul_log (sensor readings per date)
 *         app_meta (internal metadata — NOT state authority)
 *
 * No COUNT(*), no AVG, no scoring, no analytics.
 */

import * as SQLite from 'expo-sqlite';

let db = null;

export async function initDatabase() {
  db = await SQLite.openDatabaseAsync('second_soul.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS soul_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT UNIQUE NOT NULL,
      step_count     INTEGER DEFAULT 0,
      locations_json TEXT DEFAULT '[]',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_soul_log_date ON soul_log(date);
  `);

  console.log('[SoulDB] Initialized ✓');
  return db;
}

/**
 * Ensure today has a row in soul_log.
 * Returns nothing — DAY is NOT computed here.
 * DAY lives in App.js / AsyncStorage only.
 */
export async function ensureTodayRecord() {
  if (!db) await initDatabase();
  const today = getTodayDate();
  const now   = new Date().toISOString();

  await db.runAsync(
    `INSERT OR IGNORE INTO soul_log
       (date, step_count, locations_json, created_at, updated_at)
     VALUES (?, 0, '[]', ?, ?)`,
    [today, now, now]
  );
  // No return value — caller must not use this for DAY calculation
}

/**
 * Save today's raw sensor readings.
 * No derived scores. No computed fields.
 */
export async function saveDailySnapshot({ date, step_count = 0, raw_locations = [] }) {
  if (!db) throw new Error('[SoulDB] Not initialized');
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO soul_log
       (date, step_count, locations_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       step_count     = excluded.step_count,
       locations_json = excluded.locations_json,
       updated_at     = excluded.updated_at`,
    [date, step_count, JSON.stringify(raw_locations), now, now]
  );
}

/**
 * Get today's raw sensor snapshot.
 */
export async function getTodaySnapshot() {
  if (!db) return null;
  const row = await db.getFirstAsync(
    'SELECT * FROM soul_log WHERE date = ?',
    [getTodayDate()]
  );
  if (!row) return null;
  return { ...row, raw_locations: JSON.parse(row.locations_json || '[]') };
}

/**
 * Prune raw location data older than 7 days (privacy).
 */
export async function pruneRawLocations() {
  if (!db) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  await db.runAsync(
    `UPDATE soul_log SET locations_json = '[]' WHERE date < ?`,
    [cutoff.toISOString().split('T')[0]]
  );
}

export function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
