/**
 * SECOND SOUL — Main Screen
 * V5 — Soul Core + ambient collector + day marker
 *
 * Receives dayCount as prop from App.js (single source of truth).
 * Reads raw sensors (steps, location) and saves to soul_log.
 * Starts ambient behavior collector on mount.
 * No scores. No percentages. No debug controls.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, AppState,
} from 'react-native';
import { COLORS } from '../theme/colors';
import SoulCore from '../components/SoulCore';
import { startCollector, stopCollector, recordScreenFocus } from '../services/behaviorService';
import { initEventStore, persistEvent } from '../stores/eventStore';
import {
  initDatabase, ensureTodayRecord,
  saveDailySnapshot, getTodayDate,
} from '../database/soulDatabase';

const { width } = Dimensions.get('window');

export default function MainScreen({ dayCount = 1 }) {
  const [stepCount,  setStepCount]  = useState(0);
  const [isNightTime, setIsNightTime] = useState(false);
  const [locationCount, setLocationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const coreOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.stagger(400, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(coreOpacity,   { toValue: 1, duration: 900, useNativeDriver: true }),
    ]).start();

    // Set night-time flag
    const hour = new Date().getHours();
    setIsNightTime(hour >= 22 || hour < 5);

    // Init event store and start ambient collector
    (async () => {
      try {
        await initEventStore();
        startCollector(async (event) => {
          try { await persistEvent(event); } catch (_) {}
        });
        recordScreenFocus('MainScreen');
      } catch (e) {
        console.warn('[MainScreen] Collector init failed:', e.message);
      }
    })();

    // Load sensor data
    loadData();

    return () => {
      try { stopCollector(); } catch (_) {}
    };
  }, []);

  async function loadData() {
    let steps = 0;
    let locs  = [];

    // Init DB — ensure today has a row
    try {
      await initDatabase();
      await ensureTodayRecord();
    } catch (e) {
      console.warn('[MainScreen] DB init failed:', e.message);
    }

    // Step count (raw sensor, no scoring)
    try {
      const { Pedometer } = require('expo-sensors');
      const available = await Pedometer.isAvailableAsync();
      if (available) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, new Date());
        steps = result?.steps ?? 0;
        setStepCount(steps);
      }
    } catch (_) {}

    // Location (single point, no continuous tracking)
    try {
      const Location = require('expo-location');
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (loc) {
          locs = [{
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
          }];
          setLocationCount(1);
        }
      }
    } catch (_) {}

    // Save raw sensor snapshot (no derived scores)
    try {
      await saveDailySnapshot({
        date:          getTodayDate(),
        step_count:    steps,
        raw_locations: locs,
      });
    } catch (_) {}

    setLoading(false);
  }

  const daysRemaining = Math.max(0, 30 - dayCount);

  return (
    <View style={styles.container}>
      <View style={styles.bgGlow} />

      {/* Header — day marker only, no progress bar, no metrics */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Text style={styles.eyebrow}>SECOND SOUL</Text>
        <Text style={styles.day}>
          DAY {dayCount}<Text style={styles.dayOf}> / 30</Text>
        </Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>
          {loading
            ? 'Reading your patterns… · 读取你的模式…'
            : daysRemaining > 0
              ? `${daysRemaining} days · 距离灵魂成形还有 ${daysRemaining} 天`
              : 'Your soul has fully formed · 你的灵魂已经完全成形'}
        </Text>
      </Animated.View>

      {/* Soul Core — particle sphere evolving into sleeping baby */}
      <Animated.View style={[styles.coreWrapper, { opacity: coreOpacity }]}>
        <SoulCore
          stepCount={stepCount}
          isNightTime={isNightTime}
          locationCount={locationCount}
          dayIndex={dayCount}
        />
      </Animated.View>

      {/* Footer — structural state only */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>◈  SILENT OBSERVATION · 静默观察期  ◈</Text>
        <Text style={styles.footerSub}>
          All data stored locally · 所有数据本地储存 · Zero servers · 零服务器
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.void,
  },
  bgGlow: {
    position: 'absolute',
    top: -100,
    left: width * 0.2,
    width: width * 0.6,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 28,
    gap: 8,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 5,
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  day: {
    fontSize: 28,
    color: COLORS.textPrimary,
    fontFamily: 'Georgia',
    letterSpacing: 2,
  },
  dayOf: {
    color: COLORS.textDim,
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  coreWrapper: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 8,
    gap: 4,
  },
  footerText: {
    fontSize: 9,
    letterSpacing: 4,
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  footerSub: {
    fontSize: 10,
    color: COLORS.textDim,
    opacity: 0.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
