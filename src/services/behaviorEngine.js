/**
 * SECOND SOUL — Local Behavioral Inference Engine
 *
 * Pipeline:
 *   Raw Events → Metrics Layer → Inference Layer → Confidence → Explanation
 *
 * Design principles:
 *   - Fully local, zero network calls
 *   - Deterministic and rule-based
 *   - Combined metrics only (no single-metric decisions)
 *   - All outputs traceable to data
 */

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const THRESHOLDS = {
  SHORT_SESSION_MS: 60 * 1000,        // < 1 min = short
  LONG_SESSION_MS: 5 * 60 * 1000,     // > 5 min = long
  DEEP_SESSION_MS: 10 * 60 * 1000,    // > 10 min = deep usage
  QUICK_EXIT_MS: 15 * 1000,           // < 15 sec = quick exit
  IDLE_RATIO_HIGH: 0.4,               // idle > 40% of time
  SWITCH_FREQ_HIGH: 4,                // > 4 sessions/hour = fragmented
  PEAK_HOUR_TOP_N: 3,                 // top N active hours
  MIN_DAYS_FOR_HIGH_CONFIDENCE: 7,
  MIN_DAYS_FOR_MEDIUM_CONFIDENCE: 3,
};

// ═══════════════════════════════════════════════════════════
// LAYER 1 — METRICS COMPUTATION
// ═══════════════════════════════════════════════════════════

/**
 * Entry point for metrics layer.
 * @param {Array} events - Raw behavior events
 * @param {number} totalDays - Number of days data spans
 * @returns {Object} metrics
 */
function computeMetrics(events, totalDays) {
  const sessions = extractSessions(events);
  const rhythmMetrics = computeRhythmMetrics(events, sessions, totalDays);
  const attentionMetrics = computeAttentionMetrics(sessions);
  const stabilityMetrics = computeStabilityMetrics(sessions, totalDays);
  const intentMetrics = computeIntentMetrics(sessions);

  return {
    rhythm: rhythmMetrics,
    attention: attentionMetrics,
    stability: stabilityMetrics,
    intent: intentMetrics,
    meta: {
      total_events: events.length,
      total_sessions: sessions.length,
      total_days: totalDays,
    },
  };
}

// ── Session Extraction ─────────────────────────────────────

/**
 * Pair session_start / session_end events into sessions.
 * Falls back to treating single events as point sessions.
 */
function extractSessions(events) {
  const sessions = [];
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  let openSession = null;

  for (const event of sorted) {
    if (event.type === 'session_start') {
      openSession = { start: event.timestamp, interactions: 0, idles: 0 };
    } else if (event.type === 'session_end' && openSession) {
      const duration = event.timestamp - openSession.start;
      sessions.push({
        start: openSession.start,
        end: event.timestamp,
        duration,
        hour: new Date(openSession.start).getHours(),
        date: toDateString(openSession.start),
        interactions: openSession.interactions,
        idles: openSession.idles,
      });
      openSession = null;
    } else if (event.type === 'interaction' && openSession) {
      openSession.interactions++;
    } else if (event.type === 'idle' && openSession) {
      openSession.idles++;
    }
  }

  // Close any unclosed session at last event time
  if (openSession && sorted.length > 0) {
    const lastTs = sorted[sorted.length - 1].timestamp;
    const duration = lastTs - openSession.start;
    if (duration > 0) {
      sessions.push({
        start: openSession.start,
        end: lastTs,
        duration,
        hour: new Date(openSession.start).getHours(),
        date: toDateString(openSession.start),
        interactions: openSession.interactions,
        idles: openSession.idles,
      });
    }
  }

  return sessions;
}

// ── Rhythm Metrics ─────────────────────────────────────────

function computeRhythmMetrics(events, sessions, totalDays) {
  // Hourly distribution: count session starts per hour
  const hourly_distribution = new Array(24).fill(0);
  sessions.forEach(s => { hourly_distribution[s.hour]++; });

  // Peak hours: top N hours by activity
  const hourlyIndexed = hourly_distribution.map((count, hour) => ({ hour, count }));
  const peak_hours = hourlyIndexed
    .sort((a, b) => b.count - a.count)
    .slice(0, THRESHOLDS.PEAK_HOUR_TOP_N)
    .filter(h => h.count > 0)
    .map(h => h.hour);

  // Time variance: variance of active hours
  const activeHours = sessions.map(s => s.hour);
  const time_variance = activeHours.length > 1 ? variance(activeHours) : 0;

  // Session clustering: measure how "bunched" sessions are in time
  // High clustering = sessions happen in bursts
  const session_clustering = computeSessionClustering(sessions);

  return { hourly_distribution, peak_hours, time_variance, session_clustering };
}

function computeSessionClustering(sessions) {
  if (sessions.length < 2) return 0;
  const gaps = [];
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].start - sorted[i - 1].end);
  }
  const avgGap = mean(gaps);
  const gapVar = variance(gaps);
  // High variance in gaps + some short gaps = clustering
  return avgGap > 0 ? Math.min(1, gapVar / (avgGap * avgGap)) : 0;
}

// ── Attention Metrics ──────────────────────────────────────

function computeAttentionMetrics(sessions) {
  if (sessions.length === 0) {
    return { avg_session_duration: 0, short_session_ratio: 0, long_session_ratio: 0, switch_frequency: 0, idle_ratio: 0 };
  }

  const durations = sessions.map(s => s.duration);
  const avg_session_duration = mean(durations);

  const short_session_ratio = sessions.filter(s => s.duration < THRESHOLDS.SHORT_SESSION_MS).length / sessions.length;
  const long_session_ratio = sessions.filter(s => s.duration > THRESHOLDS.LONG_SESSION_MS).length / sessions.length;

  // Switch frequency: sessions per active hour
  const activeHourSet = new Set(sessions.map(s => `${s.date}-${s.hour}`));
  const switch_frequency = activeHourSet.size > 0 ? sessions.length / activeHourSet.size : 0;

  // Idle ratio: proportion of idle events across all sessions
  const totalEvents = sessions.reduce((acc, s) => acc + s.interactions + s.idles, 0);
  const totalIdles = sessions.reduce((acc, s) => acc + s.idles, 0);
  const idle_ratio = totalEvents > 0 ? totalIdles / totalEvents : 0;

  return { avg_session_duration, short_session_ratio, long_session_ratio, switch_frequency, idle_ratio };
}

// ── Stability Metrics ──────────────────────────────────────

function computeStabilityMetrics(sessions, totalDays) {
  if (sessions.length === 0 || totalDays === 0) {
    return { daily_active_time_std: 0, daily_session_std: 0, consistency_days_ratio: 0 };
  }

  // Group sessions by date
  const byDate = {};
  sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  const activeDates = Object.keys(byDate);
  const dailyActiveTimes = activeDates.map(d => byDate[d].reduce((sum, s) => sum + s.duration, 0));
  const dailySessionCounts = activeDates.map(d => byDate[d].length);

  const daily_active_time_std = standardDeviation(dailyActiveTimes);
  const daily_session_std = standardDeviation(dailySessionCounts);
  const consistency_days_ratio = activeDates.length / Math.max(1, totalDays);

  return { daily_active_time_std, daily_session_std, consistency_days_ratio };
}

// ── Intent Metrics ─────────────────────────────────────────

function computeIntentMetrics(sessions) {
  if (sessions.length === 0) {
    return { quick_exit_ratio: 0, deep_usage_ratio: 0, exploration_ratio: 0 };
  }

  const quick_exit_ratio = sessions.filter(s => s.duration < THRESHOLDS.QUICK_EXIT_MS).length / sessions.length;
  const deep_usage_ratio = sessions.filter(s => s.duration > THRESHOLDS.DEEP_SESSION_MS).length / sessions.length;

  // Exploration: short-to-medium sessions with low idle (active browsing)
  const exploratoryCount = sessions.filter(s =>
    s.duration >= THRESHOLDS.QUICK_EXIT_MS &&
    s.duration < THRESHOLDS.LONG_SESSION_MS &&
    s.interactions > 0
  ).length;
  const exploration_ratio = exploratoryCount / sessions.length;

  return { quick_exit_ratio, deep_usage_ratio, exploration_ratio };
}

// ═══════════════════════════════════════════════════════════
// LAYER 2 — INFERENCE
// ═══════════════════════════════════════════════════════════

function runInference(metrics) {
  return {
    rhythm: inferRhythm(metrics.rhythm, metrics.meta),
    attention: inferAttention(metrics.attention, metrics.meta),
    stability: inferStability(metrics.stability, metrics.meta),
    intent: inferIntent(metrics.intent, metrics.attention, metrics.meta),
  };
}

// ── Rhythm Inference ───────────────────────────────────────

function inferRhythm(rhythm, meta) {
  const { peak_hours, time_variance, session_clustering, hourly_distribution } = rhythm;

  // score_concentrated: activity focused in few hours
  const totalActivity = hourly_distribution.reduce((a, b) => a + b, 0);
  const topHoursActivity = peak_hours.reduce((sum, h) => sum + hourly_distribution[h], 0);
  const concentration_ratio = totalActivity > 0 ? topHoursActivity / totalActivity : 0;

  const score_concentrated =
    concentration_ratio * 0.5 +
    (1 - Math.min(1, time_variance / 30)) * 0.3 +
    session_clustering * 0.2;

  // score_distributed: activity spread across many hours
  const active_hour_count = hourly_distribution.filter(c => c > 0).length;
  const score_distributed =
    (active_hour_count / 24) * 0.5 +
    Math.min(1, time_variance / 30) * 0.3 +
    (1 - concentration_ratio) * 0.2;

  const scores = { concentrated: score_concentrated, distributed: score_distributed };
  const type = classifyFromScores(scores, 0.15, 'irregular');
  const confidence = computeConfidence(scores, meta.total_days);

  return { type, confidence, scores };
}

// ── Attention Inference ────────────────────────────────────

function inferAttention(attention, meta) {
  const { avg_session_duration, short_session_ratio, long_session_ratio, switch_frequency, idle_ratio } = attention;

  const score_deep =
    long_session_ratio * 0.35 +
    (1 - short_session_ratio) * 0.25 +
    Math.min(1, avg_session_duration / THRESHOLDS.DEEP_SESSION_MS) * 0.25 +
    (1 - Math.min(1, switch_frequency / THRESHOLDS.SWITCH_FREQ_HIGH)) * 0.15;

  const score_fragmented =
    short_session_ratio * 0.35 +
    Math.min(1, switch_frequency / THRESHOLDS.SWITCH_FREQ_HIGH) * 0.30 +
    idle_ratio * 0.20 +
    (1 - long_session_ratio) * 0.15;

  const scores = { deep: score_deep, fragmented: score_fragmented };
  const type = classifyFromScores(scores, 0.12, 'mixed');
  const confidence = computeConfidence(scores, meta.total_days);

  return { type, confidence, scores };
}

// ── Stability Inference ────────────────────────────────────

function inferStability(stability, meta) {
  const { daily_active_time_std, daily_session_std, consistency_days_ratio } = stability;

  // Normalize std values (assume 30min std = moderate, 60min = high)
  const norm_time_std = Math.min(1, daily_active_time_std / (60 * 60 * 1000));
  const norm_session_std = Math.min(1, daily_session_std / 5);

  const score_stable =
    consistency_days_ratio * 0.40 +
    (1 - norm_time_std) * 0.35 +
    (1 - norm_session_std) * 0.25;

  const score_volatile =
    norm_time_std * 0.40 +
    norm_session_std * 0.35 +
    (1 - consistency_days_ratio) * 0.25;

  const scores = { stable: score_stable, volatile: score_volatile };
  const type = classifyFromScores(scores, 0.15, 'changing');
  const confidence = computeConfidence(scores, meta.total_days);

  return { type, confidence, scores };
}

// ── Intent Inference ───────────────────────────────────────

function inferIntent(intent, attention, meta) {
  const { quick_exit_ratio, deep_usage_ratio, exploration_ratio } = intent;
  const { long_session_ratio, idle_ratio } = attention;

  const score_active =
    deep_usage_ratio * 0.40 +
    long_session_ratio * 0.30 +
    (1 - quick_exit_ratio) * 0.20 +
    (1 - idle_ratio) * 0.10;

  const score_passive =
    idle_ratio * 0.40 +
    (1 - deep_usage_ratio) * 0.30 +
    quick_exit_ratio * 0.20 +
    (1 - exploration_ratio) * 0.10;

  const score_exploratory =
    exploration_ratio * 0.45 +
    (1 - quick_exit_ratio) * 0.25 +
    (1 - deep_usage_ratio) * 0.20 +
    (1 - idle_ratio) * 0.10;

  const scores = { active: score_active, passive: score_passive, exploratory: score_exploratory };
  const type = classifyFromScores(scores, 0.10, 'exploratory');
  const confidence = computeConfidence(scores, meta.total_days);

  return { type, confidence, scores };
}

// ═══════════════════════════════════════════════════════════
// LAYER 3 — CONFIDENCE CALCULATION
// ═══════════════════════════════════════════════════════════

/**
 * Confidence based on:
 * 1. Data coverage (days of data)
 * 2. Score separation (top vs second score)
 */
function computeConfidence(scores, totalDays) {
  const scoreValues = Object.values(scores).sort((a, b) => b - a);
  const separation = scoreValues.length >= 2 ? scoreValues[0] - scoreValues[1] : scoreValues[0];

  // Data coverage score
  let coverage_score;
  if (totalDays >= THRESHOLDS.MIN_DAYS_FOR_HIGH_CONFIDENCE) coverage_score = 1.0;
  else if (totalDays >= THRESHOLDS.MIN_DAYS_FOR_MEDIUM_CONFIDENCE) coverage_score = 0.6;
  else coverage_score = 0.2;

  // Separation score
  const separation_score = Math.min(1, separation / 0.25);

  const combined = coverage_score * 0.5 + separation_score * 0.5;

  if (combined >= 0.7) return 'high';
  if (combined >= 0.4) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════
// LAYER 4 — EXPLANATION GENERATION
// ═══════════════════════════════════════════════════════════

function generateExplanations(inference, metrics) {
  return {
    rhythm: explainRhythm(inference.rhythm, metrics.rhythm),
    attention: explainAttention(inference.attention, metrics.attention),
    stability: explainStability(inference.stability, metrics.stability),
    intent: explainIntent(inference.intent, metrics.intent, metrics.attention),
  };
}

function explainRhythm(result, m) {
  const peakStr = m.peak_hours.length > 0
    ? `hours ${m.peak_hours.map(h => `${h}:00`).join(', ')}`
    : 'no clear peak hours';

  if (result.type === 'concentrated') {
    return `Activity is concentrated in ${peakStr}. Sessions cluster within a narrow time window, indicating a structured daily schedule.`;
  }
  if (result.type === 'distributed') {
    const activeCount = m.hourly_distribution.filter(c => c > 0).length;
    return `Activity is spread across ${activeCount} different hours. No dominant time window detected, indicating flexible usage patterns.`;
  }
  return `Activity shows no consistent time structure. High variance (${m.time_variance.toFixed(1)}) across session hours indicates irregular scheduling.`;
}

function explainAttention(result, m) {
  const avgMin = (m.avg_session_duration / 60000).toFixed(1);
  const shortPct = Math.round(m.short_session_ratio * 100);
  const longPct = Math.round(m.long_session_ratio * 100);

  if (result.type === 'deep') {
    return `Average session duration is ${avgMin} minutes. ${longPct}% of sessions exceed the long-session threshold. Low switch frequency (${m.switch_frequency.toFixed(1)} sessions/hour) supports sustained attention.`;
  }
  if (result.type === 'fragmented') {
    return `${shortPct}% of sessions are short (under 1 minute). Switch frequency of ${m.switch_frequency.toFixed(1)} sessions/hour and idle ratio of ${Math.round(m.idle_ratio * 100)}% indicate fragmented attention.`;
  }
  return `Mix of session lengths (${shortPct}% short, ${longPct}% long) with average ${avgMin} minutes. Attention pattern does not clearly favor deep or fragmented usage.`;
}

function explainStability(result, m) {
  const consistencyPct = Math.round(m.consistency_days_ratio * 100);
  const stdMin = (m.daily_active_time_std / 60000).toFixed(1);

  if (result.type === 'stable') {
    return `Active on ${consistencyPct}% of observed days. Daily active time varies by ${stdMin} minutes on average, indicating consistent usage habits.`;
  }
  if (result.type === 'volatile') {
    return `Daily active time varies significantly (±${stdMin} min). Session count fluctuates with std of ${m.daily_session_std.toFixed(1)}. Usage patterns are inconsistent across days.`;
  }
  return `Active on ${consistencyPct}% of days with moderate variability (±${stdMin} min daily). Stability is transitioning — pattern not yet settled.`;
}

function explainIntent(result, intent, attention) {
  const deepPct = Math.round(intent.deep_usage_ratio * 100);
  const quickPct = Math.round(intent.quick_exit_ratio * 100);
  const explorePct = Math.round(intent.exploration_ratio * 100);

  if (result.type === 'active') {
    return `${deepPct}% of sessions exceed the deep-usage threshold. Low quick-exit rate (${quickPct}%) suggests purposeful engagement rather than passive browsing.`;
  }
  if (result.type === 'passive') {
    return `High idle ratio (${Math.round(attention.idle_ratio * 100)}%) and quick-exit rate of ${quickPct}% indicate passive consumption. Sessions rarely reach deep-usage depth.`;
  }
  return `${explorePct}% of sessions fall in the exploratory range — active but not deeply committed. Quick exits (${quickPct}%) coexist with moderate engagement sessions.`;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API — Main Entry Point
// ═══════════════════════════════════════════════════════════

/**
 * Run the full behavioral inference pipeline.
 *
 * @param {Array} events - Raw behavior events
 * @param {number} totalDays - Total days of data coverage
 * @returns {Object} Structured inference result
 */
export function inferBehavior(events, totalDays = 1) {
  if (!events || events.length === 0) {
    return buildEmptyResult();
  }

  const metrics = computeMetrics(events, totalDays);
  const inference = runInference(metrics);
  const explanations = generateExplanations(inference, metrics);

  return {
    rhythm: {
      type: inference.rhythm.type,
      confidence: inference.rhythm.confidence,
      explanation: explanations.rhythm,
    },
    attention: {
      type: inference.attention.type,
      confidence: inference.attention.confidence,
      explanation: explanations.attention,
    },
    stability: {
      type: inference.stability.type,
      confidence: inference.stability.confidence,
      explanation: explanations.stability,
    },
    intent: {
      type: inference.intent.type,
      confidence: inference.intent.confidence,
      explanation: explanations.intent,
    },
    _meta: {
      total_events: events.length,
      total_days: totalDays,
      computed_at: new Date().toISOString(),
    },
  };
}

/**
 * Convenience: run inference from stored DB events.
 * @param {Function} getEvents - async function returning events array
 * @param {number} totalDays
 */
export async function inferBehaviorFromDB(getEvents, totalDays) {
  try {
    const events = await getEvents();
    return inferBehavior(events, totalDays);
  } catch (e) {
    console.warn('[BehaviorEngine] DB inference failed:', e.message);
    return buildEmptyResult();
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function classifyFromScores(scores, minSeparation, fallback) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];
  const [, secondVal] = entries[1] || [null, 0];
  if (topVal - secondVal < minSeparation) return fallback;
  return topKey;
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return mean(arr.map(x => (x - m) ** 2));
}

function standardDeviation(arr) {
  return Math.sqrt(variance(arr));
}

function toDateString(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildEmptyResult() {
  const empty = { type: 'unknown', confidence: 'low', explanation: 'Insufficient data to determine behavioral pattern.' };
  return {
    rhythm: { ...empty },
    attention: { ...empty },
    stability: { ...empty },
    intent: { ...empty },
    _meta: { total_events: 0, total_days: 0, computed_at: new Date().toISOString() },
  };
}
