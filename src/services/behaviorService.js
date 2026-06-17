/**
 * SECOND SOUL — Behavior Service
 * V5 — No background tasks, no polling, no notifications dependency
 *
 * Wakes ONLY on:
 *   1. App enters foreground  → session_start
 *   2. App leaves foreground  → session_end
 *   3. Screen navigation      → screen_enter / screen_exit
 *   4. 3-min inactivity gap   → idle (fires once, then silent)
 */

import { AppState } from 'react-native';

// ── In-memory session state ───────────────────────────────────────────────────
let _sessionId       = null;
let _sessionStart    = null;
let _currentScreen   = null;
let _focusStart      = null;
let _idleTimer       = null;
let _appStateRef     = null;
let _onEvent         = null;

const IDLE_MS = 3 * 60 * 1000; // 3 minutes

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start ambient collector.
 * @param {Function} onEvent  Receives each Event object as it occurs
 */
export function startCollector(onEvent) {
  _onEvent = onEvent;
  _beginSession();
  _appStateRef = AppState.addEventListener('change', _handleAppState);
}

/** Stop collector and clean up. */
export function stopCollector() {
  _endSession();
  if (_appStateRef) { _appStateRef.remove(); _appStateRef = null; }
  _clearIdle();
  _onEvent = null;
}

/**
 * Record screen focus shift.
 * Call from each screen's useEffect on mount.
 * @param {string} screenName
 */
export function recordScreenFocus(screenName) {
  if (!_sessionId) return;
  const now = Date.now();

  // Close previous screen
  if (_currentScreen && _focusStart) {
    _emit({
      timestamp:        now,
      session_start:    false,
      session_end:      false,
      app_focus:        _currentScreen,
      interaction_type: 'screen_exit',
      duration:         now - _focusStart,
      app_switch:       _currentScreen !== screenName,
      idle_time:        0,
    });
  }

  _currentScreen = screenName;
  _focusStart    = now;

  _emit({
    timestamp:        now,
    session_start:    false,
    session_end:      false,
    app_focus:        screenName,
    interaction_type: 'screen_enter',
    duration:         0,
    app_switch:       false,
    idle_time:        0,
  });

  _resetIdle();
}

/**
 * Record a user interaction within the current screen.
 * @param {string} type  e.g. 'tap', 'expand', 'scroll'
 */
export function recordInteraction(type = 'tap') {
  if (!_sessionId) return;
  _emit({
    timestamp:        Date.now(),
    session_start:    false,
    session_end:      false,
    app_focus:        _currentScreen || 'unknown',
    interaction_type: type,
    duration:         0,
    app_switch:       false,
    idle_time:        0,
  });
  _resetIdle();
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

function _beginSession() {
  _sessionId    = _makeId();
  _sessionStart = Date.now();
  _focusStart   = _sessionStart;

  _emit({
    timestamp:        _sessionStart,
    session_start:    true,
    session_end:      false,
    app_focus:        _currentScreen || 'app',
    interaction_type: 'session_start',
    duration:         0,
    app_switch:       false,
    idle_time:        0,
  });

  _resetIdle();
}

function _endSession() {
  if (!_sessionId) return;
  const now      = Date.now();
  const duration = _sessionStart ? now - _sessionStart : 0;

  // Close current screen focus
  if (_currentScreen && _focusStart) {
    _emit({
      timestamp:        now,
      session_start:    false,
      session_end:      false,
      app_focus:        _currentScreen,
      interaction_type: 'screen_exit',
      duration:         now - _focusStart,
      app_switch:       false,
      idle_time:        0,
    });
  }

  _emit({
    timestamp:        now,
    session_start:    false,
    session_end:      true,
    app_focus:        _currentScreen || 'app',
    interaction_type: 'session_end',
    duration,
    app_switch:       false,
    idle_time:        0,
  });

  _clearIdle();
  _sessionId    = null;
  _sessionStart = null;
  _focusStart   = null;
}

// ── AppState handler ──────────────────────────────────────────────────────────

function _handleAppState(nextState) {
  if (nextState === 'active') {
    if (!_sessionId) _beginSession();
  } else if (nextState === 'background' || nextState === 'inactive') {
    if (_sessionId) _endSession();
  }
}

// ── Idle detection (single-fire, passive) ─────────────────────────────────────

function _resetIdle() {
  _clearIdle();
  _idleTimer = setTimeout(_handleIdle, IDLE_MS);
}

function _clearIdle() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
}

function _handleIdle() {
  if (!_sessionId) return;
  _emit({
    timestamp:        Date.now(),
    session_start:    false,
    session_end:      false,
    app_focus:        _currentScreen || 'app',
    interaction_type: 'idle',
    duration:         IDLE_MS,
    app_switch:       false,
    idle_time:        IDLE_MS,
  });
  // Timer stops here — fires once, stays silent until next real interaction
}

// ── Emit ──────────────────────────────────────────────────────────────────────

function _emit(event) {
  if (!_onEvent) return;
  try { _onEvent({ ...event, _session_id: _sessionId }); }
  catch (e) { console.warn('[Collector] Emit error:', e.message); }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function _makeId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
