/**
 * SECOND SOUL — Permission Hook
 * Handles requesting all three required permissions gracefully.
 * Returns status for each and a trigger function.
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Location from 'expo-location';

export const PERMISSION_STATUS = {
  IDLE: 'idle',
  GRANTED: 'granted',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
};

export function usePermissions() {
  const [permissions, setPermissions] = useState({
    motion: PERMISSION_STATUS.IDLE,    // Steps / Pedometer
    location: PERMISSION_STATUS.IDLE,  // Foreground location
    locationBg: PERMISSION_STATUS.IDLE,// Background location
    notifications: PERMISSION_STATUS.IDLE,
  });

  const [isRequesting, setIsRequesting] = useState(false);

  const updatePermission = (key, value) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  // ── Motion / Steps ──────────────────────────
  const requestMotion = useCallback(async () => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) {
        updatePermission('motion', PERMISSION_STATUS.UNAVAILABLE);
        return false;
      }
      // Pedometer on iOS prompts for HealthKit via requestPermissionsAsync
      const { status } = await Pedometer.requestPermissionsAsync();
      const granted = status === 'granted';
      updatePermission('motion', granted ? PERMISSION_STATUS.GRANTED : PERMISSION_STATUS.DENIED);
      return granted;
    } catch (e) {
      console.warn('[Permissions] Motion error:', e);
      updatePermission('motion', PERMISSION_STATUS.DENIED);
      return false;
    }
  }, []);

  // ── Location (foreground + background) ──────
  const requestLocation = useCallback(async () => {
    try {
      // Step 1: Foreground
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      const fgGranted = fgStatus === 'granted';
      updatePermission('location', fgGranted ? PERMISSION_STATUS.GRANTED : PERMISSION_STATUS.DENIED);

      if (!fgGranted) return false;

      // Step 2: Background (only ask after foreground is granted)
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      const bgGranted = bgStatus === 'granted';
      updatePermission('locationBg', bgGranted ? PERMISSION_STATUS.GRANTED : PERMISSION_STATUS.DENIED);

      return fgGranted; // App works with just foreground, bg is bonus
    } catch (e) {
      console.warn('[Permissions] Location error:', e);
      updatePermission('location', PERMISSION_STATUS.DENIED);
      return false;
    }
  }, []);

  // ── Notifications ────────────────────────────
  const requestNotifications = useCallback(async () => {
    // expo-notifications removed — notifications not required for core system
    updatePermission('notifications', PERMISSION_STATUS.GRANTED);
    return true;
  }, []);

  // ── Request all sequentially ─────────────────
  const requestAll = useCallback(async () => {
    setIsRequesting(true);
    try {
      await requestMotion();
      await new Promise(r => setTimeout(r, 600)); // Pause between dialogs
      await requestLocation();
      await new Promise(r => setTimeout(r, 600));
      await requestNotifications();
    } finally {
      setIsRequesting(false);
    }
  }, [requestMotion, requestLocation, requestNotifications]);

  const allGranted =
    permissions.motion !== PERMISSION_STATUS.IDLE &&
    permissions.location !== PERMISSION_STATUS.IDLE &&
    permissions.notifications !== PERMISSION_STATUS.IDLE;

  const allEssentialGranted =
    (permissions.motion === PERMISSION_STATUS.GRANTED || permissions.motion === PERMISSION_STATUS.UNAVAILABLE) &&
    permissions.location === PERMISSION_STATUS.GRANTED;

  return {
    permissions,
    isRequesting,
    allGranted,
    allEssentialGranted,
    requestAll,
    requestMotion,
    requestLocation,
    requestNotifications,
  };
}
