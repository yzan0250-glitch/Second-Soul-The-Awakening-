/**
 * SECOND SOUL ENGINE — App.js
 * Version 5: UsageStats + State-Safe
 *
 * Time authority   : AsyncStorage only
 *   first_launch_date  → YYYY-MM-DD, written once
 *   onboarding_complete → "true", written once
 *
 * Behavior authority: Android UsageStatsManager → SQLite app_sessions
 *
 * Sync trigger: App enters foreground (AppState 'active')
 * No background tasks. No polling. No timers.
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppState, StatusBar, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingNavigator    from './src/screens/OnboardingNavigator';
import MainScreen             from './src/screens/MainScreen';
import SoulScreen             from './src/screens/SoulScreen';
import UsagePermissionScreen  from './src/screens/UsagePermissionScreen';
import { COLORS }             from './src/theme/colors';

import { hasUsagePermission, openUsageAccessSettings } from './src/modules/UsageStatsModule';
import { syncUsageData }    from './src/services/usageCollector';
import { initUsageStore }   from './src/services/usageStore';

// ── AsyncStorage keys ─────────────────────────────────────────────────────────
const KEY_FIRST_LAUNCH        = '@second_soul:first_launch_date';
const KEY_FIRST_LAUNCH_LEGACY = '@second_soul:first_launch_timestamp';
const KEY_ONBOARDING          = '@second_soul:onboarding_complete';

// ── Date utilities ────────────────────────────────────────────────────────────

function localDateStr(date) {
  const d = date || new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function computeDay(firstLaunchDate) {
  const [fy, fm, fd] = firstLaunchDate.split('-').map(Number);
  const today        = localDateStr();
  const [ty, tm, td] = today.split('-').map(Number);

  // Convert to day-number using UTC midnight — no timezone drift
  const toMs = (y, m, d) => Date.UTC(y, m - 1, d);
  const diff = Math.floor((toMs(ty, tm, td) - toMs(fy, fm, fd)) / 86400000);
  return Math.max(1, diff + 1);
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [appReady,        setAppReady]        = useState(false);
  const [onboarded,       setOnboarded]       = useState(false);
  const [dayCount,        setDayCount]        = useState(1);
  const [activeTab,       setActiveTab]       = useState('main');
  const [hasPermission,   setHasPermission]   = useState(false);
  const [showPermScreen,  setShowPermScreen]  = useState(false);

  const appStateRef = useRef(AppState.currentState);

  // ── Bootstrap (run once on mount) ─────────────────────────────────────────
  useEffect(() => {
    bootstrap();

    // AppState listener — refresh DAY + sync usage on every foreground event
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  async function bootstrap() {
    try {
      // 1. First launch date — write once, never overwrite
      let firstDate = await AsyncStorage.getItem(KEY_FIRST_LAUNCH);
      if (!firstDate) {
        // Migrate from old timestamp key if it exists
        const legacyTs = await AsyncStorage.getItem(KEY_FIRST_LAUNCH_LEGACY);
        firstDate = legacyTs
          ? localDateStr(new Date(parseInt(legacyTs, 10)))
          : localDateStr();
        await AsyncStorage.setItem(KEY_FIRST_LAUNCH, firstDate);
      }

      // 2. Compute DAY from calendar diff
      setDayCount(computeDay(firstDate));

      // 3. Onboarding state
      const done = await AsyncStorage.getItem(KEY_ONBOARDING);
      if (done === 'true') setOnboarded(true);

      // 4. Init usage store and check permission
      await initUsageStore();
      const perm = await hasUsagePermission();
      setHasPermission(perm);

      if (perm) {
        // Permission granted — sync immediately on launch
        syncUsageData(30).catch(() => {});
      } else if (done === 'true') {
        // Onboarded but no permission yet — show permission screen
        setShowPermScreen(true);
      }

    } catch (e) {
      console.warn('[App] Bootstrap error:', e.message);
    } finally {
      setAppReady(true);
    }
  }

  // ── Foreground handler ─────────────────────────────────────────────────────
  async function handleAppState(nextState) {
    if (appStateRef.current !== 'active' && nextState === 'active') {
      // Refresh DAY (handles midnight crossover)
      try {
        const firstDate = await AsyncStorage.getItem(KEY_FIRST_LAUNCH);
        if (firstDate) setDayCount(computeDay(firstDate));
      } catch (_) {}

      // Re-check permission (user may have just granted it in Settings)
      try {
        const perm = await hasUsagePermission();
        setHasPermission(perm);
        if (perm) {
          setShowPermScreen(false);
          // Sync latest usage data — this is the only trigger
          syncUsageData(30).catch(() => {});
        }
      } catch (_) {}
    }
    appStateRef.current = nextState;
  }

  // ── Onboarding completion ──────────────────────────────────────────────────
  async function handleOnboardingComplete() {
    try {
      await AsyncStorage.setItem(KEY_ONBOARDING, 'true');
    } catch (_) {}
    setOnboarded(true);
    // Show permission screen immediately after onboarding
    const perm = await hasUsagePermission();
    setHasPermission(perm);
    if (!perm) setShowPermScreen(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Blank while AsyncStorage loads — prevents onboarding flash
  if (!appReady) return <View style={styles.container} />;

  if (!onboarded) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <OnboardingNavigator onComplete={handleOnboardingComplete} />
      </View>
    );
  }

  if (showPermScreen && !hasPermission) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <UsagePermissionScreen
          onGranted={() => {
            setHasPermission(true);
            setShowPermScreen(false);
            syncUsageData(30).catch(() => {});
          }}
          onSkip={() => setShowPermScreen(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {activeTab === 'main'
          ? <MainScreen dayCount={dayCount} />
          : <SoulScreen dayCount={dayCount} />
        }
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'main' && styles.tabActive]}
          onPress={() => setActiveTab('main')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabGlyph,   activeTab === 'main' && styles.tabGlyphActive]}>◉</Text>
          <Text style={[styles.tabLabel,   activeTab === 'main' && styles.tabLabelActive]}>SOUL CORE</Text>
          <Text style={[styles.tabLabelCN, activeTab === 'main' && styles.tabLabelActive]}>灵魂核心</Text>
        </TouchableOpacity>

        <View style={styles.tabDivider} />

        <TouchableOpacity
          style={[styles.tab, activeTab === 'soul' && styles.tabActive]}
          onPress={() => setActiveTab('soul')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabGlyph,   activeTab === 'soul' && styles.tabGlyphActive]}>◈</Text>
          <Text style={[styles.tabLabel,   activeTab === 'soul' && styles.tabLabelActive]}>STRUCTURE</Text>
          <Text style={[styles.tabLabelCN, activeTab === 'soul' && styles.tabLabelActive]}>心理结构</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.void },
  content:        { flex: 1 },
  tabBar:         { flexDirection: 'row', backgroundColor: COLORS.abyss, borderTopWidth: 1, borderTopColor: COLORS.divider, paddingBottom: 20, paddingTop: 12 },
  tab:            { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, opacity: 0.4 },
  tabActive:      { opacity: 1 },
  tabGlyph:       { fontSize: 16, color: COLORS.textDim },
  tabGlyphActive: { color: COLORS.accent },
  tabLabel:       { fontSize: 9, letterSpacing: 2, color: COLORS.textDim, textTransform: 'uppercase', fontWeight: '300' },
  tabLabelCN:     { fontSize: 9, color: COLORS.textDim, letterSpacing: 1 },
  tabLabelActive: { color: COLORS.textSecondary },
  tabDivider:     { width: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
});
