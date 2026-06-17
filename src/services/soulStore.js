/**
 * SECOND SOUL — Soul Identity Store
 *
 * Maintains identity continuity across engine runs.
 * The Second Soul evolves — it does NOT regenerate.
 *
 * When a new structure is inferred:
 *   - If no prior soul exists: write it
 *   - If prior soul exists: merge (refine, not replace)
 *
 * The soul's identity is preserved.
 * Only its resolution deepens.
 */

import * as SQLite from 'expo-sqlite';

let db = null;

const SOUL_KEY = 'second_soul_v1';

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

export async function initSoulStore() {
  db = await SQLite.openDatabaseAsync('second_soul.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS soul_identity (
      key         TEXT PRIMARY KEY,
      soul_json   TEXT NOT NULL,
      completeness TEXT NOT NULL,
      first_formed_at TEXT NOT NULL,
      last_refined_at TEXT NOT NULL,
      refinement_count INTEGER DEFAULT 0
    );
  `);

  console.log('[SoulStore] Initialized ✓');
  return db;
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

/**
 * Load the persisted Second Soul.
 * Returns null if no soul has formed yet.
 */
export async function loadSoul() {
  if (!db) await initSoulStore();

  const row = await db.getFirstAsync(
    `SELECT * FROM soul_identity WHERE key = ?`,
    [SOUL_KEY]
  );

  if (!row) return null;

  try {
    return {
      ...JSON.parse(row.soul_json),
      _completeness: row.completeness,
      _first_formed_at: row.first_formed_at,
      _last_refined_at: row.last_refined_at,
      _refinement_count: row.refinement_count,
    };
  } catch (e) {
    console.warn('[SoulStore] Parse error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// WRITE — with identity continuity
// ─────────────────────────────────────────────

/**
 * Persist a new soul inference, maintaining identity continuity.
 *
 * Rules:
 * - If no prior soul: write directly
 * - If prior soul exists and completeness is same or lower: refine fields
 * - If prior soul exists and completeness increased: allow deeper resolution
 * - NEVER replace identity with a contradictory structure
 *
 * @param {Object} newSoul - output from SecondSoulEngine
 * @param {Object|null} priorSoul - previously persisted soul
 */
export async function persistSoul(newSoul, priorSoul) {
  // Never persist a not-formed state — silence does not overwrite structure
  if (newSoul._not_formed) return;
  if (!db) await initSoulStore();

  const now = new Date().toISOString();

  if (!priorSoul) {
    // First formation — write directly
    const soulData = extractSoulData(newSoul);
    await db.runAsync(
      `INSERT OR REPLACE INTO soul_identity
         (key, soul_json, completeness, first_formed_at, last_refined_at, refinement_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [SOUL_KEY, JSON.stringify(soulData), newSoul._completeness, now, now]
    );
    console.log('[SoulStore] Soul formed for first time. Completeness:', newSoul._completeness);
    return;
  }

  // Subsequent runs — refine, do not replace
  const refined = refineSoul(priorSoul, newSoul);
  const soulData = extractSoulData(refined);

  await db.runAsync(
    `UPDATE soul_identity
     SET soul_json = ?,
         completeness = ?,
         last_refined_at = ?,
         refinement_count = refinement_count + 1
     WHERE key = ?`,
    [JSON.stringify(soulData), refined._completeness, now, SOUL_KEY]
  );

  console.log('[SoulStore] Soul refined. Count:', (priorSoul._refinement_count || 0) + 1);
}

// ─────────────────────────────────────────────
// REFINEMENT LOGIC
// ─────────────────────────────────────────────

/**
 * Refine the existing soul with new structural inference.
 *
 * Refinement rules:
 * - Fields in prior soul are preserved unless new inference is deeper
 * - "Deeper" = more specific, more resolved, longer description
 * - Completeness can only increase or stay the same (never regress)
 * - core_drives: union of prior and new (additive, not replacement)
 */
function refineSoul(prior, next) {
  const completenessRank = { absent: 0, emerging: 1, partial: 2, coherent: 3 };

  const priorRank = completenessRank[prior._completeness] || 0;
  const nextRank = completenessRank[next._completeness] || 0;

  // Completeness never regresses
  const completeness = nextRank >= priorRank ? next._completeness : prior._completeness;

  // For each field: take the more resolved version
  const refined = {
    archetype_structure: resolveField(prior.archetype_structure, next.archetype_structure),
    cognitive_style: resolveField(prior.cognitive_style, next.cognitive_style),
    attention_architecture: resolveField(prior.attention_architecture, next.attention_architecture),
    decision_pattern: resolveField(prior.decision_pattern, next.decision_pattern),
    emotional_reactivity_pattern: resolveField(prior.emotional_reactivity_pattern, next.emotional_reactivity_pattern),
    behavioral_signature: resolveField(prior.behavioral_signature, next.behavioral_signature),
    // core_drives: additive union, deduplicated by first sentence
    core_drives: mergeDrives(prior.core_drives, next.core_drives),
    _completeness: completeness,
  };

  return refined;
}

/**
 * Select the more structurally resolved version of a field.
 * "More resolved" = longer and not an "Unresolved" placeholder.
 */
function resolveField(priorText, nextText) {
  const isUnresolved = t => !t || t.startsWith('Unresolved') || t.startsWith('No behavioral');
  const priorUnresolved = isUnresolved(priorText);
  const nextUnresolved = isUnresolved(nextText);

  if (priorUnresolved && !nextUnresolved) return nextText;
  if (!priorUnresolved && nextUnresolved) return priorText;
  if (priorUnresolved && nextUnresolved) return priorText || nextText;

  // Both resolved — take the longer (more specific) one
  return (nextText || '').length >= (priorText || '').length ? nextText : priorText;
}

/**
 * Merge drive arrays — additive, deduplicated by opening phrase.
 * Prevents duplicate drives while allowing new ones to accumulate.
 */
function mergeDrives(priorDrives, nextDrives) {
  const all = [...(priorDrives || []), ...(nextDrives || [])];
  const seen = new Set();
  const merged = [];

  for (const drive of all) {
    // Use first 30 chars as dedup key
    const key = (drive || '').slice(0, 30).toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(drive);
    }
  }

  return merged.length > 0 ? merged : ['Latent — the system requires behavioral depth before drives can be surfaced.'];
}

/**
 * Extract only the soul data fields (no internal meta).
 */
function extractSoulData(soul) {
  return {
    archetype_structure: soul.archetype_structure,
    core_drives: soul.core_drives,
    cognitive_style: soul.cognitive_style,
    attention_architecture: soul.attention_architecture,
    decision_pattern: soul.decision_pattern,
    emotional_reactivity_pattern: soul.emotional_reactivity_pattern,
    behavioral_signature: soul.behavioral_signature,
  };
}
