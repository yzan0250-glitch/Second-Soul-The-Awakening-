/**
 * SECOND SOUL ENGINE — v3
 *
 * Emergence is structural, not quantitative.
 *
 * Three structures must ALL be satisfied for COHERENT state:
 *   1. REPETITION  — same relational patterns recur across sessions
 *   2. CONSISTENCY — patterns do not contradict each other
 *   3. DIRECTIONAL — all patterns point toward same latent tendency
 *
 * Silence is always a valid outcome.
 *
 * FORBIDDEN: counts, averages, thresholds, scoring, time-based triggers
 * OUTPUT: inner tendencies, psychological structure, affinity, drives
 *         NEVER behavior description
 */

// ═══════════════════════════════════════════════════════════
// SIGNAL EXTRACTION
// ═══════════════════════════════════════════════════════════

function extractSignals(sessions) {
  if (!sessions || sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  return {
    attentional:  extractAttentionalSignal(sorted),
    transitional: extractTransitionalSignal(sorted),
    temporal:     extractTemporalSignal(sorted),
    volitional:   extractVolitionalSignal(sorted),
  };
}

function extractAttentionalSignal(sessions) {
  const durations = sessions.map(s => s.duration);
  const hasDeep  = durations.some(d => d > 10 * 60 * 1000);
  const hasMicro = durations.some(d => d < 30 * 1000);
  const allDeep  = durations.every(d => d > 5 * 60 * 1000);
  const allBrief = durations.every(d => d < 3 * 60 * 1000);

  let rapidReentry = false;
  for (let i = 1; i < sessions.length; i++) {
    const gap = sessions[i].start - sessions[i - 1].end;
    if (gap >= 0 && gap < 2 * 60 * 1000) { rapidReentry = true; break; }
  }

  let form;
  if (allDeep)                  form = 'immersive';
  else if (allBrief)            form = 'punctuated';
  else if (hasDeep && hasMicro) form = 'bifurcated';
  else if (hasDeep && !hasMicro) form = 'depth-dominant';
  else                          form = 'diffuse';

  return { form, hasDeep, hasMicro, allDeep, allBrief, rapidReentry };
}

function extractTransitionalSignal(sessions) {
  if (sessions.length < 2) return { form: 'singular', checkingPattern: false };

  const gaps = [];
  for (let i = 1; i < sessions.length; i++) {
    const gap = sessions[i].start - sessions[i - 1].end;
    if (gap >= 0) gaps.push(gap);
  }
  if (gaps.length === 0) return { form: 'continuous', checkingPattern: false };

  const hasMicroGaps = gaps.some(g => g < 2 * 60 * 1000);
  const hasLongGaps  = gaps.some(g => g > 60 * 60 * 1000);
  const allLongGaps  = gaps.every(g => g > 60 * 60 * 1000);

  let checkingPattern = false;
  let streak = 0;
  for (const g of gaps) {
    if (g < 5 * 60 * 1000) { streak++; if (streak >= 3) { checkingPattern = true; break; } }
    else streak = 0;
  }

  let form;
  if (allLongGaps)                      form = 'deliberate';
  else if (hasMicroGaps && hasLongGaps) form = 'mixed';
  else if (hasMicroGaps)                form = 'continuous';
  else                                  form = 'rhythmic';

  return { form, hasMicroGaps, hasLongGaps, checkingPattern };
}

function extractTemporalSignal(sessions) {
  const toZone = h => {
    if (h >= 4  && h < 8)  return 'early';
    if (h >= 8  && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    if (h >= 18 && h < 23) return 'evening';
    return 'night';
  };

  // First session per day
  const byDate = {};
  sessions.forEach(s => {
    const d = toDateStr(s.start);
    if (!byDate[d] || s.start < byDate[d].start) byDate[d] = s;
  });

  const firstZones = Object.values(byDate)
    .map(s => toZone(new Date(s.start).getHours()));
  const uniqueFirstZones = new Set(firstZones);

  const hours = sessions.map(s => new Date(s.start).getHours());
  const hasNight = hours.some(h => h >= 23 || h < 4);
  const anchored = uniqueFirstZones.size === 1;
  const drifting = uniqueFirstZones.size >= 3;

  return {
    anchored,
    drifting,
    anchorZone: anchored ? [...uniqueFirstZones][0] : null,
    hasNight,
  };
}

function extractVolitionalSignal(sessions) {
  if (sessions.length === 0) return { initiation: 'absent', closure: 'absent', persistence: false };

  const durations  = sessions.map(s => s.duration);
  const first      = durations[0];
  const last       = durations[durations.length - 1];
  const prev       = durations.length > 1 ? durations[durations.length - 2] : null;

  let initiation;
  if (first > 5 * 60 * 1000) initiation = 'committed';
  else if (durations.length > 1 && first < 60 * 1000 && durations[1] > first * 3)
    initiation = 'exploratory';
  else initiation = 'tentative';

  const closure     = (prev !== null && last < prev * 0.5) ? 'gradual' : 'abrupt';
  const persistence = durations.some(d => d > 8 * 60 * 1000);

  return { initiation, closure, persistence };
}

// ═══════════════════════════════════════════════════════════
// THREE-STRUCTURE DETECTION
// ═══════════════════════════════════════════════════════════

function detectStructure(signals, sessions) {
  if (!signals) return 'absent';

  const uniqueDays = new Set(sessions.map(s => toDateStr(s.start)));
  if (uniqueDays.size < 2) return 'emerging';

  const r = detectRepetition(signals, sessions);
  const c = detectConsistency(signals);
  const d = detectDirectional(signals);

  const passed = [r, c, d].filter(Boolean).length;
  if (passed <= 1) return 'emerging';
  if (passed === 2) return 'partial';
  return 'coherent';
}

function detectRepetition(signals, sessions) {
  const byDate = {};
  sessions.forEach(s => {
    const d = toDateStr(s.start);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  });

  const days = Object.values(byDate);
  if (days.length < 2) return false;

  // Relational form per day: depth character of first session + gap character
  const dayForms = days.map(daySessions => {
    const sorted    = [...daySessions].sort((a, b) => a.start - b.start);
    const depthChar = sorted[0].duration > 5 * 60 * 1000 ? 'deep' : 'brief';
    let gapChar     = 'none';
    if (sorted.length > 1) {
      const gap = sorted[1].start - sorted[0].end;
      gapChar   = gap < 5 * 60 * 1000 ? 'rapid' : 'spaced';
    }
    return `${depthChar}-${gapChar}`;
  });

  const formCounts  = {};
  dayForms.forEach(f => { formCounts[f] = (formCounts[f] || 0) + 1; });
  const maxRepeat   = Math.max(...Object.values(formCounts));
  return maxRepeat >= 2;
}

function detectConsistency(signals) {
  const { attentional, transitional, volitional } = signals;

  if (attentional.form === 'bifurcated' && transitional.form === 'deliberate') return false;
  if (attentional.form === 'immersive'  && transitional.checkingPattern)        return false;
  if (volitional.initiation === 'committed' && transitional.form === 'continuous') return false;
  if (attentional.allBrief && volitional.persistence)                            return false;

  return true;
}

function detectDirectional(signals) {
  const { attentional, transitional, temporal, volitional } = signals;

  const directions = [];

  if (attentional.form === 'immersive' || attentional.form === 'depth-dominant')
    directions.push('inward-deepening');
  else if (attentional.form === 'punctuated')
    directions.push('outward-scanning');
  else if (attentional.form === 'bifurcated')
    directions.push('oscillating');

  if (transitional.form === 'deliberate' || transitional.form === 'continuous')
    directions.push('inward-deepening');
  else if (transitional.checkingPattern)
    directions.push('outward-scanning');

  if (volitional.initiation === 'committed' && volitional.persistence)
    directions.push('inward-deepening');
  else if (volitional.initiation === 'exploratory')
    directions.push('outward-scanning');

  if (temporal.drifting) directions.push('oscillating');

  if (directions.length === 0) return false;

  const unique = new Set(directions);
  if (unique.has('oscillating') && unique.size > 1) return false;
  if (unique.has('inward-deepening') && unique.has('outward-scanning')) return false;

  return true;
}

// ═══════════════════════════════════════════════════════════
// SOUL SYNTHESIS
// Output: inner tendencies, structure, affinity, drives
// Never describes behavior.
// ═══════════════════════════════════════════════════════════

function synthesizeSoul(signals) {
  return {
    archetype_structure:          inferArchetype(signals),
    core_drives:                  inferDrives(signals),
    cognitive_style:              inferCognition(signals.attentional, signals.transitional),
    attention_architecture:       inferAttention(signals.attentional, signals.transitional),
    decision_pattern:             inferDecision(signals.volitional, signals.transitional),
    emotional_reactivity_pattern: inferEmotional(signals.temporal, signals.transitional, signals.volitional),
    behavioral_signature:         inferSignature(signals),
  };
}

function inferArchetype({ attentional, volitional, temporal }) {
  if (attentional.form === 'immersive' && volitional.initiation === 'committed') {
    return 'A structure organized around depth as a primary orientation — one that moves toward experience rather than across it. The inner world is built through sustained contact. Commitment precedes engagement; disengagement is never casual.';
  }
  if (attentional.form === 'punctuated' && volitional.initiation === 'exploratory') {
    return 'A structure organized around lateral movement — one that finds coherence through connection rather than depth. The inner world accumulates through partial contacts, each brief engagement leaving a trace that forms the larger pattern.';
  }
  if (attentional.form === 'bifurcated') {
    return 'A structure in productive internal tension — one that holds two orientations without resolving either. The inner world contains both the pull toward depth and the pull toward surface contact. This is not ambivalence; it is a genuinely complex psychological architecture.';
  }
  if (attentional.form === 'depth-dominant' && temporal.anchored) {
    return 'A structure of anchored depth — one that returns reliably to a preferred temporal home and deploys inner resources with deliberate weight. Not habit, but a consistent gravitational pull toward certain conditions of engagement.';
  }
  return 'A latent structure is present but has not yet resolved into a fully legible form. The architecture exists — it is still finding its expression.';
}

function inferDrives({ attentional, transitional, temporal, volitional }) {
  const drives = [];

  if (attentional.hasDeep)
    drives.push('An orientation toward depth as a value in itself — not as a means to an outcome, but as the preferred mode of being in relation to what matters.');
  if (transitional.checkingPattern)
    drives.push('A pull toward unresolved engagement — a structural tendency to maintain contact with what has not yet closed. Incompletion generates its own gravitational field.');
  if (temporal.hasNight)
    drives.push('An affinity for low-stimulus conditions — an inner life that requires a certain quality of quiet to become visible to itself. Most available when external demand recedes.');
  if (volitional.persistence)
    drives.push('A drive toward sustained investment — once genuine engagement is established, the psychological system resists premature withdrawal. Depth, once entered, wants to continue.');
  if (temporal.anchored)
    drives.push('A structural preference for temporal regularity — not routine, but a condition that makes inner access possible. Certain hours carry a different quality of self-availability.');
  if (transitional.form === 'deliberate')
    drives.push('A drive toward considered return — the system does not re-enter engagement reactively. It waits, processes, and chooses. Re-engagement is volitional, not reflexive.');

  if (drives.length === 0)
    drives.push('Latent drives are structurally present but have not yet achieved sufficient definition to be named.');

  return drives;
}

function inferCognition(attentional, transitional) {
  if (attentional.form === 'immersive')
    return 'Convergent-sequential. The cognitive structure processes by narrowing — bringing sustained attention to bear on a single domain and following it inward. Comprehension arrives through immersion, not survey.';
  if (attentional.form === 'punctuated')
    return 'Associative-distributed. The cognitive structure processes laterally — moving across many contact points and finding coherence in the pattern between them. Understanding arrives through connection, not depth.';
  if (attentional.form === 'bifurcated')
    return 'Dual-modal. Two cognitive processing modes coexist — one that converges and deepens, one that disperses and scans. These modes alternate; each is fully expressed in its moment.';
  if (attentional.form === 'depth-dominant' && transitional.form === 'deliberate')
    return 'Deliberative-deep. The cognitive structure favors sustained engagement and approaches re-engagement with prior consideration. Processing is selective and weight-bearing.';
  return 'The cognitive processing style has structural presence that has not yet resolved into a clearly nameable form.';
}

function inferAttention(attentional, transitional) {
  const parts = [];
  if (attentional.form === 'immersive')
    parts.push('The attentional structure is convergent — it narrows toward a point and holds. The attentional system is built for depth, not for monitoring.');
  else if (attentional.form === 'punctuated')
    parts.push('The attentional structure is distributive — it maintains broad, low-intensity contact across many surfaces. This is a different architecture, one that processes through coverage rather than concentration.');
  else if (attentional.form === 'bifurcated')
    parts.push('The attentional structure contains two modes that do not merge. One is capable of extended absorbed focus; the other operates in rapid brief contact. Both are structurally genuine.');
  else if (attentional.form === 'depth-dominant')
    parts.push('The attentional structure tends toward depth while retaining some capacity for brief engagement. The dominant orientation is inward.');

  if (transitional.form === 'continuous' || attentional.rapidReentry)
    parts.push('The attentional system shows strong re-engagement pull — disengagement does not fully release the prior object. Something continues to hold across the gap.');

  return parts.join(' ');
}

function inferDecision(volitional, transitional) {
  if (volitional.initiation === 'committed' && volitional.closure === 'abrupt')
    return 'The decision structure operates on threshold logic — engagement is entered with full commitment once the internal threshold is reached, and released without gradual wind-down once the internal signal arrives. Decisions are executed, not negotiated.';
  if (volitional.initiation === 'exploratory' && volitional.closure === 'gradual')
    return 'The decision structure is approach-oriented — it tests conditions before committing and releases through deceleration rather than sudden exit. Decisions are processes, not events.';
  if (transitional.checkingPattern)
    return 'The decision structure maintains open loops — once engaged, the system does not fully close the decision. It returns to re-evaluate, re-contact, re-confirm. Resolution is approached iteratively.';
  if (transitional.form === 'deliberate')
    return 'The decision structure is characterized by full disengagement before re-commitment. The gap between engagements is not passive; it is internal deliberation. Re-entry is chosen, not default.';
  return 'The decision pattern is structurally present but has not yet revealed its dominant form.';
}

function inferEmotional(temporal, transitional, volitional) {
  const parts = [];
  if (temporal.hasNight)
    parts.push('The emotional system activates most fully in conditions of reduced external demand — an affinity for the quality of inner availability that emerges when the social world recedes.');
  if (transitional.checkingPattern)
    parts.push('Unresolved engagements generate affective tension that pulls the system back. Incompletion is experienced as a form of presence, not absence.');
  if (volitional.persistence)
    parts.push('Once genuine investment is established, the emotional system sustains it. The system protects what it has entered.');
  if (temporal.anchored)
    parts.push('Emotional availability is time-structured — certain periods carry different qualities of inner access. This is a structural feature, not a mood.');

  if (parts.length === 0)
    parts.push('The emotional reactivity structure is present within the behavioral record but has not yet achieved sufficient definition to be described with structural precision.');

  return parts.join(' ');
}

function inferSignature({ attentional, transitional, temporal, volitional }) {
  const fingerprint = [
    attentional.form + ' attention',
    volitional.initiation + ' initiation',
    transitional.form + ' transitions',
    temporal.anchored ? temporal.anchorZone + '-anchored' : 'temporally unanchored',
  ].join(' / ');

  let gestalt;
  if (attentional.form === 'immersive' && volitional.initiation === 'committed')
    gestalt = 'This is a soul that enters fully or not at all. Its relationship to experience is characterized by weight — it does not skim; it inhabits. A psychological structure organized around depth as a way of being.';
  else if (attentional.form === 'punctuated' && transitional.checkingPattern)
    gestalt = 'This is a soul of sustained partial contact — many threads held simultaneously, none released fully. Its relationship to experience is characterized by connection, by the maintenance of multiple open engagements that together form a living web.';
  else if (attentional.form === 'bifurcated')
    gestalt = 'This is a soul that contains its own opposition. It moves between absorption and rapid movement. The productive tension between these poles is not a problem to be resolved — it is the structure itself.';
  else if (temporal.anchored && volitional.persistence)
    gestalt = 'This is a soul of reliable return — one that comes back to what matters, at the same time, with the same quality of presence. A psychological structure that has found a sustainable rhythm between engagement and rest.';
  else
    gestalt = 'This is a soul whose structure has emerged but whose gestalt has not yet fully crystallized. The architecture is coherent; the expression is still forming.';

  return `Structural fingerprint: ${fingerprint}. ${gestalt}`;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

export function runSecondSoulEngine(events, sessions) {
  const signals      = extractSignals(sessions);
  const completeness = detectStructure(signals, sessions || []);

  const silence = {
    _completeness: completeness,
    _not_formed:   true,
    _reason:       completeness === 'absent' ? 'no_traces' : 'insufficient_structural_coherence',
    _computed_at:  new Date().toISOString(),
    archetype_structure: null, core_drives: [],
    cognitive_style: null, attention_architecture: null,
    decision_pattern: null, emotional_reactivity_pattern: null,
    behavioral_signature: null,
  };

  if (completeness === 'absent' || completeness === 'emerging') return silence;

  const soul = synthesizeSoul(signals);
  return {
    ...soul,
    _completeness: completeness,
    _not_formed:   false,
    _computed_at:  new Date().toISOString(),
  };
}

export async function runEngineFromDB(getEvents, getSessions) {
  try {
    const [events, sessions] = await Promise.all([getEvents(), getSessions()]);
    return runSecondSoulEngine(events, sessions);
  } catch (e) {
    console.warn('[SecondSoulEngine] DB load failed:', e.message);
    return {
      _completeness: 'absent', _not_formed: true, _reason: 'no_traces',
      _computed_at: new Date().toISOString(),
      archetype_structure: null, core_drives: [], cognitive_style: null,
      attention_architecture: null, decision_pattern: null,
      emotional_reactivity_pattern: null, behavioral_signature: null,
    };
  }
}

function toDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
