/**
 * SECOND SOUL — Event Store
 * V5 — SQLite raw storage only. No analytics. No derived values.
 *
 * Tables:
 *   raw_events   — timestamped interaction events
 *   raw_sessions — session open/close pairs
 *
 * Export (DEV only):
 *   exportRawEvents() → JSON file + native share dialog
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

let db = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initEventStore() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('second_soul.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS raw_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       TEXT    NOT NULL,
      timestamp        INTEGER NOT NULL,
      app_focus        TEXT    DEFAULT '',
      interaction_type TEXT    DEFAULT '',
      duration         INTEGER DEFAULT 0,
      app_switch       INTEGER DEFAULT 0,
      idle_time        INTEGER DEFAULT 0,
      date             TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    UNIQUE NOT NULL,
      start_ts   INTEGER NOT NULL,
      end_ts     INTEGER,
      duration   INTEGER DEFAULT 0,
      date       TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_date   ON raw_events(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON raw_sessions(date);
    CREATE INDEX IF NOT EXISTS idx_events_session ON raw_events(session_id);
  `);

  return db;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist a single raw event.
 * Called by behaviorService via the onEvent callback.
 * No transformation. No derived fields. No meaning assignment.
 */
export async function persistEvent(event) {
  if (!db) return;

  const date = _tsToDate(event.timestamp);

  try {
    if (event.session_start) {
      await db.runAsync(
        `INSERT OR IGNORE INTO raw_sessions (session_id, start_ts, date)
         VALUES (?, ?, ?)`,
        [event._session_id, event.timestamp, date]
      );
    }

    if (event.session_end) {
      await db.runAsync(
        `UPDATE raw_sessions SET end_ts = ?, duration = ?
         WHERE session_id = ?`,
        [event.timestamp, event.duration || 0, event._session_id]
      );
    }

    await db.runAsync(
      `INSERT INTO raw_events
         (session_id, timestamp, app_focus, interaction_type,
          duration, app_switch, idle_time, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event._session_id       || 'unknown',
        event.timestamp,
        event.app_focus         || '',
        event.interaction_type  || '',
        event.duration          || 0,
        event.app_switch        ? 1 : 0,
        event.idle_time         || 0,
        date,
      ]
    );
  } catch (e) {
    console.warn('[EventStore] Write error:', e.message);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllEvents() {
  if (!db) return [];
  return await db.getAllAsync(
    `SELECT * FROM raw_events ORDER BY timestamp ASC`
  );
}

export async function getAllSessions() {
  if (!db) return [];
  return await db.getAllAsync(
    `SELECT * FROM raw_sessions
     WHERE end_ts IS NOT NULL
     ORDER BY start_ts ASC`
  );
}

// ── Export (DEV only) ─────────────────────────────────────────────────────────

/**
 * Export last N days of raw events as JSON.
 * Writes to DocumentDirectory and triggers native share dialog.
 *
 * MUST only be called when __DEV__ is true.
 * No transformation. No labeling. Raw data only.
 *
 * @param {number} days  Default: 30
 * @returns {string}     Path to written file
 */
export async function exportRawEvents(days = 30) {
  if (!db) throw new Error('[EventStore] Not initialized');

  const cutoff   = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const fromDate = _tsToDate(cutoff.getTime());

  const events = await db.getAllAsync(
    `SELECT timestamp, app_focus, interaction_type,
            duration, app_switch, idle_time, date
     FROM raw_events
     WHERE date >= ?
     ORDER BY timestamp ASC`,
    [fromDate]
  );

  const sessions = await db.getAllAsync(
    `SELECT start_ts, end_ts, duration, date
     FROM raw_sessions
     WHERE date >= ? AND end_ts IS NOT NULL
     ORDER BY start_ts ASC`,
    [fromDate]
  );

  const payload = JSON.stringify({
    exported_at:   new Date().toISOString(),
    days_included: days,
    from_date:     fromDate,
    event_count:   events.length,
    session_count: sessions.length,
    events,
    sessions,
  }, null, 2);

  const path = FileSystem.documentDirectory + 'second_soul_raw_events.json';
  await FileSystem.writeAsStringAsync(path, payload, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType:    'application/json',
      dialogTitle: 'Second Soul — Raw Events',
    });
  } else {
    console.log('[EventStore] File saved to:', path);
  }

  return path;
}

// ── Maintenance ───────────────────────────────────────────────────────────────

/** Delete records older than retentionDays (default: 60). */
export async function pruneOldEvents(retentionDays = 60) {
  if (!db) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffDate = _tsToDate(cutoff.getTime());
  await db.runAsync(`DELETE FROM raw_events   WHERE date < ?`, [cutoffDate]);
  await db.runAsync(`DELETE FROM raw_sessions WHERE date < ?`, [cutoffDate]);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _tsToDate(ts) {
  const d = new Date(ts);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
