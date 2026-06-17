/**
 * SECOND SOUL — Sensor Collection Service
 * Battery-efficient background data collection.
 *
 * Architecture:
 *  - Steps: Pedometer polling (expo-sensors), aggregated hourly
 *  - Location: Significant-change only (not GPS polling) — ~100m threshold
 *  - Night Score: Derived from device usage timestamps (not actual screen time API,
 *    which requires special entitlements) — computed from location/step data timing
 */

import { Pedometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { saveDailySnapshot, getSnapshot, getTodayDate } from '../database/soulDatabase';

const BACKGROUND_FETCH_TASK = 'SECOND_SOUL_DAILY_SYNC';
const LOCATION_TASK = 'SECOND_SOUL_LOCATION';

// In-memory location buffer (flushed to DB every sync)
let locationBuffer = [];

// ─────────────────────────────────────────────
// STEP COUNT
// ─────────────────────────────────────────────

/**
 * Reads today's step count from the Pedometer.
 * Uses the start of today as the window.
 * @returns {Promise<number>}
 */
export async function fetchTodaySteps() {
  const isAvailable = await Pedometer.isAvailableAsync();
  if (!isAvailable) {
    console.warn('[Sensors] Pedometer not available on this device.');
    return 0;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  const result = await Pedometer.getStepCountAsync(startOfDay, now);
  return result?.steps ?? 0;
}

// ─────────────────────────────────────────────
// LOCATION ENTROPY
// ─────────────────────────────────────────────

/**
 * Starts significant-location-change monitoring.
 * This is the battery-efficient approach — NOT continuous GPS.
 * iOS fires on ~500m changes; Android on ~100m.
 */
export async function startLocationMonitoring() {
  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[Sensors] Background location not granted.');
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,     // NOT High — saves battery
    distanceInterval: 150,                    // Meters before new update
    deferredUpdatesInterval: 300000,          // Min 5 min between updates
    showsBackgroundLocationIndicator: false,  // No blue iOS bar
    foregroundService: {
      notificationTitle: 'Second Soul',
      notificationBody: 'Silently observing…',
      notificationColor: '#4A3AFF',
    },
    pausesUpdatesAutomatically: true,         // iOS: stops when stationary
  });

  console.log('[Sensors] Location monitoring started ✓');
}

/**
 * Computes location entropy for a given set of coordinates.
 * Entropy measures the "spread" of locations — 0 = never left home, 1 = everywhere.
 * 
 * Algorithm: Normalized unique-grid-cell count.
 * We divide the world into ~1km grid cells and count how many distinct
 * cells were visited, normalized against a "maximally nomadic" day.
 *
 * @param {Array} locations - [{latitude, longitude}]
 * @returns {number} 0.0–1.0
 */
export function computeLocationEntropy(locations) {
  if (!locations || locations.length < 2) return 0.0;

  const GRID_SIZE = 0.01; // ~1.1km cells
  const MAX_EXPECTED_CELLS = 12; // A "maximally nomadic" day visits ~12 distinct areas

  const cells = new Set(
    locations.map(loc => {
      const latCell = Math.floor(loc.latitude / GRID_SIZE);
      const lngCell = Math.floor(loc.longitude / GRID_SIZE);
      return `${latCell}:${lngCell}`;
    })
  );

  return Math.min(1.0, cells.size / MAX_EXPECTED_CELLS);
}

// ─────────────────────────────────────────────
// LATE NIGHT SCORE
// ─────────────────────────────────────────────

/**
 * Computes a late-night usage score from location/step timestamps.
 * 
 * Late night window: 11 PM – 4 AM
 * Score = ratio of late-night data points vs total data points.
 *
 * @param {Array} locations - [{latitude, longitude, timestamp}]
 * @returns {number} 0.0–1.0
 */
export function computeLateNightScore(locations) {
  if (!locations || locations.length === 0) return 0.0;

  const lateNightPoints = locations.filter(loc => {
    const hour = new Date(loc.timestamp).getHours();
    return hour >= 23 || hour < 4; // 11 PM to 4 AM
  });

  return Math.min(1.0, lateNightPoints.length / Math.max(1, locations.length));
}

// ─────────────────────────────────────────────
// BACKGROUND TASK DEFINITIONS
// ─────────────────────────────────────────────

/**
 * Background location receiver — stores incoming location to buffer.
 */
TaskManager.defineTask(LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.error('[LocationTask] Error:', error);
    return;
  }
  if (data?.locations) {
    const simplified = data.locations.map(l => ({
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      timestamp: l.timestamp,
    }));
    locationBuffer.push(...simplified);
    // Keep buffer from growing unbounded (max 200 points/day)
    if (locationBuffer.length > 200) {
      locationBuffer = locationBuffer.slice(-200);
    }
  }
});

/**
 * Daily background sync — runs every 15 min (system-throttled).
 * Aggregates all sensor data and writes to SQLite.
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const today = getTodayDate();
    const steps = await fetchTodaySteps();
    const entropy = computeLocationEntropy(locationBuffer);
    const nightScore = computeLateNightScore(locationBuffer);

    await saveDailySnapshot({
      date: today,
      step_count: steps,
      location_entropy: entropy,
      late_night_score: nightScore,
      raw_locations: locationBuffer,
    });

    console.log(`[BackgroundFetch] Synced: steps=${steps}, entropy=${entropy.toFixed(2)}`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error('[BackgroundFetch] Sync failed:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background fetch task.
 */
export async function registerBackgroundSync() {
  await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 15 * 60,  // 15 minutes (OS may throttle further)
    stopOnTerminate: false,
    startOnBoot: true,
  });
  console.log('[Sensors] Background sync registered ✓');
}

/**
 * Manually triggers a sync (call from foreground when app opens).
 */
export async function syncNow() {
  const today = getTodayDate();
  const steps = await fetchTodaySteps();
  const entropy = computeLocationEntropy(locationBuffer);
  const nightScore = computeLateNightScore(locationBuffer);

  await saveDailySnapshot({
    date: today,
    step_count: steps,
    location_entropy: entropy,
    late_night_score: nightScore,
    raw_locations: locationBuffer,
  });

  return { steps, entropy, nightScore };
}
