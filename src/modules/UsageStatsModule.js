/**
 * SECOND SOUL — UsageStats JS Bridge
 * V5
 *
 * Wraps the Android native UsageStatsModule.
 * All methods return raw data — no processing in this layer.
 *
 * Event types from Android:
 *   1 = MOVE_TO_FOREGROUND
 *   2 = MOVE_TO_BACKGROUND
 */

import { NativeModules, Platform } from 'react-native';

const Native = NativeModules.UsageStatsModule;

function notAvailable(name) {
  console.warn(`[UsageStats] ${name} — native module not available (iOS or not linked)`);
}

/**
 * Check if PACKAGE_USAGE_STATS permission is granted.
 * @returns {Promise<boolean>}
 */
export async function hasUsagePermission() {
  if (Platform.OS !== 'android' || !Native) return false;
  return Native.hasPermission();
}

/**
 * Open system Usage Access settings.
 * On Android 10+: deep-links to this app's entry.
 * On older Android: opens the general usage access list.
 * @returns {Promise<boolean>}
 */
export async function openUsageAccessSettings() {
  if (Platform.OS !== 'android' || !Native) { notAvailable('openUsageAccessSettings'); return false; }
  return Native.openUsageAccessSettings();
}

/**
 * Fetch raw App switching timeline between two Unix timestamps (ms).
 *
 * Returns time-ordered array:
 * [{ packageName: string, eventType: 1|2, timestamp: number }, ...]
 *
 * @param {number} startTime  Unix ms
 * @param {number} endTime    Unix ms
 * @returns {Promise<Array>}
 */
export async function getAppUsageTimeline(startTime, endTime) {
  if (Platform.OS !== 'android' || !Native) return [];
  return Native.getAppUsageTimeline(startTime, endTime);
}

/**
 * Fetch raw timeline for the last N days.
 * @param {number} daysBack  Default: 30
 * @returns {Promise<Array>}
 */
export async function getTimelineLastDays(daysBack = 30) {
  if (Platform.OS !== 'android' || !Native) return [];
  return Native.getTimelineLastDays(daysBack);
}
