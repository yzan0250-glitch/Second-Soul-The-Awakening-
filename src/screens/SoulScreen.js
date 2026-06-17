/**
 * SECOND SOUL ENGINE — SoulScreen_Debug.js
 * (Force Export Edition)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Animated, Dimensions, TouchableOpacity, Alert,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { runSecondSoulEngine } from '../services/secondSoulEngine';
import { initSoulStore, loadSoul, persistSoul } from '../services/soulStore';
import { initEventStore, getAllEvents, getAllSessions, exportRawEvents } from '../stores/eventStore';

const { width } = Dimensions.get('window');

const SECTIONS = [
  { key: 'archetype_structure',          label: 'ARCHETYPE STRUCTURE',    labelCN: '原型结构',    glyph: '◈' },
  { key: 'core_drives',                  label: 'CORE DRIVES',            labelCN: '核心驱动',    glyph: '◉', isArray: true },
  { key: 'cognitive_style',              label: 'COGNITIVE STYLE',        labelCN: '认知风格',    glyph: '◎' },
  { key: 'attention_architecture',       label: 'ATTENTION ARCHITECTURE', labelCN: '注意力架构',  glyph: '◐' },
  { key: 'decision_pattern',             label: 'DECISION PATTERN',       labelCN: '决策模式',    glyph: '◑' },
  { key: 'emotional_reactivity_pattern', label: 'EMOTIONAL PATTERN',      labelCN: '情绪反应模式', glyph: '◒' },
  { key: 'behavioral_signature',         label: 'BEHAVIORAL SIGNATURE',   labelCN: '行为特征',    glyph: '◓' },
];

const COMPLETENESS = {
  absent:   { en: 'Structure not yet formed.',           cn: '结构尚未形成。',         color: COLORS.textDim },
  emerging: { en: 'Insufficient structural coherence.',   cn: '结构一致性尚不充分。',       color: COLORS.textDim },
  partial:  { en: 'A latent pattern is stabilizing.',     cn: '一种潜在模式正在趋于稳定。', color: COLORS.accent },
  coherent: { en: 'A structure has emerged.',             cn: '一个结构已经浮现。',         color: COLORS.success },
};

const NOT_FORMED = {
  no_traces: {
    title:   'Structure not yet formed.',
    titleCN: '结构尚未形成。',
    body:    'There is nothing to show yet.\nThe structure emerges from behavioral traces.\nNot from intention. Not from effort.',
    bodyCN:  '暂时没有什么可以显示。\n结构在行为痕迹中浮现。\n不来自意图，不来自努力。',
  },
  insufficient_structural_coherence: {
    title:   'Insufficient structural coherence.',
    titleCN: '结构一致性尚不充分。',
    body:    'Behavioral traces exist, but the patterns have not yet aligned.\n\nThe soul does not emerge on demand.\nIt emerges when the structure is ready.',
    bodyCN:  '行为痕迹已存在，\n但各种模式尚未形成稳定结构。\n\n灵魂不会应需而生。\n它在结构准备好时浮现。',
  },
};

export default function SoulScreen({ dayCount = 1 }) {
  const [soul, setSoul]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1,   duration: 3000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
    ])).start();

    try {
      const { recordScreenFocus } = require('../services/behaviorService');
      recordScreenFocus('SoulScreen');
    } catch (_) {}

    loadSoulData();
  }, []);

  async function loadSoulData() {
    try {
      await initEventStore();
      await initSoulStore();
      const [events, sessions] = await Promise.all([getAllEvents(), getAllSessions()]);
      const engineSessions = sessions.filter(s => s.start_ts && s.end_ts).map(s => ({
          start: s.start_ts, end: s.end_ts, duration: s.duration > 0 ? s.duration : (s.end_ts - s.start_ts),
        }));
      const engineEvents = events.map(e => ({
        timestamp: e.timestamp, session_start: e.interaction_type === 'session_start',
        session_end: e.interaction_type === 'session_end', app_focus: e.app_focus,
        interaction_type: e.interaction_type, duration: e.duration,
        app_switch: !!e.app_switch, idle_time: e.idle_time,
      }));

      const priorSoul = await loadSoul();
      const newInference = runSecondSoulEngine(engineEvents, engineSessions);

      if (!newInference._not_formed) { await persistSoul(newInference, priorSoul); }
      const display = !newInference._not_formed ? (await loadSoul() || newInference) : (priorSoul || newInference);
      setSoul(display);
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    } catch (e) {
      setSoul(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      await initEventStore();
      const path = await exportRawEvents(30);
      Alert.alert('Export Success', `Data shared from: ${path}`);
    } catch (e) {
      Alert.alert('Export failed', e.message || 'No data to export.');
    }
  }

  const completeness = soul?._completeness || 'absent';
  const completenessInfo = COMPLETENESS[completeness] || COMPLETENESS.absent;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SECOND SOUL · 第二灵魂</Text>
        <Text style={styles.title}>Psychological{'\n'}Structure</Text>
        <View style={styles.divider} />
        <View style={styles.completenessRow}>
          <Animated.View style={[styles.completenessDot, { backgroundColor: completenessInfo.color, opacity: pulseAnim }]} />
          <View>
            <Text style={[styles.completenessText, { color: completenessInfo.color }]}>{completenessInfo.en}</Text>
            <Text style={styles.completenessTextCN}>{completenessInfo.cn}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Animated.Text style={[styles.loadingText, { opacity: pulseAnim }]}>reconstructing...</Animated.Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ─── DEBUG EXPORT BUTTON (FORCED TOP) ─── */}
          <TouchableOpacity style={styles.devExportBtn} onPress={handleExport}>
            <Text style={styles.devExportText}>
              [DEV] EXPORT RAW EVENTS · 导出原始数据
            </Text>
          </TouchableOpacity>

          {soul?._not_formed ? (
            <NotFormedView reason={soul._reason} pulseAnim={pulseAnim} />
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {SECTIONS.map((section, index) => (
                <SoulSection
                  key={section.key}
                  section={section}
                  value={soul?.[section.key]}
                  index={index}
                  expanded={expanded === section.key}
                  onToggle={() => setExpanded(expanded === section.key ? null : section.key)}
                />
              ))}
            </Animated.View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerLine}>◈  ◈  ◈</Text>
            <Text style={styles.footerText}>
              This reconstruction emerges from behavioral traces only.{'\n'}
              It is not a diagnosis, a label, or a score.{'\n'}
              It is a mirror.
            </Text>
            <Text style={styles.footerTextCN}>
              此重建仅来自行为痕迹。{'\n'}
              它不是诊断、标签或评分。{'\n'}
              它是一面镜子。
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function NotFormedView({ reason, pulseAnim }) {
  const text = NOT_FORMED[reason] || NOT_FORMED.insufficient_structural_coherence;
  return (
    <View style={styles.notFormedContainer}>
      <Animated.View style={[styles.notFormedOrb, { opacity: pulseAnim }]} />
      <Text style={styles.notFormedTitle}>{text.title}</Text>
      <Text style={styles.notFormedTitleCN}>{text.titleCN}</Text>
      <Text style={styles.notFormedBody}>{text.body}</Text>
      <Text style={styles.notFormedBodyCN}>{text.bodyCN}</Text>
    </View>
  );
}

function SoulSection({ section, value, index, expanded, onToggle }) {
  const entryAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTimeout(() => {
      Animated.timing(entryAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, index * 100);
  }, []);

  const isEmpty = !value || (Array.isArray(value) && value.length === 0);

  const renderValue = () => {
    if (section.isArray && Array.isArray(value)) {
      return value.map((item, i) => (
        <View key={i} style={styles.driveRow}>
          <Text style={styles.driveGlyph}>—</Text>
          <Text style={styles.bodyText}>{item}</Text>
        </View>
      ));
    }
    return <Text style={[styles.bodyText, isEmpty && styles.bodyTextDim]}>{value || '—'}</Text>;
  };

  return (
    <Animated.View style={[styles.section, { opacity: entryAnim }]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionGlyph}>{section.glyph}</Text>
          <View>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <Text style={styles.sectionLabelCN}>{section.labelCN}</Text>
          </View>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {!expanded && !isEmpty && (
        <Text style={styles.previewText} numberOfLines={1}>
          {Array.isArray(value) ? value[0]?.slice(0, 60) + '…' : value?.slice(0, 60) + '…'}
        </Text>
      )}
      {expanded && <View style={styles.sectionBody}>{renderValue()}</View>}
      <View style={styles.sectionDivider} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void },
  header: { paddingTop: 60, paddingHorizontal: 28, paddingBottom: 20, gap: 8 },
  eyebrow: { fontSize: 10, letterSpacing: 4, color: COLORS.textDim, textTransform: 'uppercase' },
  title: { fontSize: 32, color: COLORS.textPrimary, fontFamily: 'Georgia', lineHeight: 40 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginTop: 4 },
  completenessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  completenessDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  completenessText: { fontSize: 12, fontWeight: '300' },
  completenessTextCN: { fontSize: 11, color: COLORS.textDim, marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 12, letterSpacing: 4, color: COLORS.textDim, textTransform: 'uppercase' },
  scrollContent: { paddingHorizontal: 28 },
  section: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1 },
  sectionGlyph: { fontSize: 16, color: COLORS.accent, marginTop: 1 },
  sectionLabel: { fontSize: 11, letterSpacing: 3, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: '300' },
  sectionLabelCN: { fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginTop: 2 },
  expandIcon: { fontSize: 18, color: COLORS.textDim, fontWeight: '200' },
  previewText: { fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', paddingLeft: 30, paddingBottom: 12, lineHeight: 18 },
  sectionBody: { paddingLeft: 30, paddingBottom: 16, gap: 12 },
  bodyText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 24, fontWeight: '300' },
  bodyTextDim: { color: COLORS.textDim, fontStyle: 'italic' },
  driveRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  driveGlyph: { fontSize: 14, color: COLORS.accent, marginTop: 4, opacity: 0.6 },
  sectionDivider: { height: 1, backgroundColor: COLORS.divider },
  notFormedContainer: { minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 16 },
  notFormedOrb: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: COLORS.textDim, marginBottom: 8 },
  notFormedTitle: { fontSize: 16, color: COLORS.textSecondary, fontFamily: 'Georgia', textAlign: 'center', lineHeight: 24 },
  notFormedTitleCN: { fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 22 },
  notFormedBody: { fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 22, fontStyle: 'italic', marginTop: 8 },
  notFormedBodyCN: { fontSize: 12, color: COLORS.textDim, textAlign: 'center', lineHeight: 20, opacity: 0.5 },
  devExportBtn: {
    marginTop: 20, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.accent,
    borderStyle: 'dashed',
    paddingVertical: 12, paddingHorizontal: 20,
    alignItems: 'center',
  },
  devExportText: { fontSize: 10, letterSpacing: 2, color: COLORS.accent, fontWeight: 'bold' },
  footer: { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: 12, alignItems: 'center', paddingBottom: 60 },
  footerLine: { fontSize: 14, color: COLORS.textDim, letterSpacing: 8 },
  footerText: { fontSize: 12, color: COLORS.textDim, textAlign: 'center', lineHeight: 20, fontStyle: 'italic', opacity: 0.7 },
  footerTextCN: { fontSize: 11, color: COLORS.textDim, textAlign: 'center', lineHeight: 20, opacity: 0.4 },
});