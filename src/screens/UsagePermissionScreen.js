import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, NativeModules,
} from 'react-native';
import { COLORS } from '../theme/colors';

const { UsageStatsModule } = NativeModules;

export default function UsagePermissionScreen({ onGranted, onSkip }) {
  const [waiting, setWaiting] = useState(false);

  async function handleGrant() {
    setWaiting(true);
    try {
      if (UsageStatsModule) {
        // 1. 先检查手机当前是否已经给过权限了
        const alreadyHas = await UsageStatsModule.hasPermission();
        if (alreadyHas) {
          if (onGranted) onGranted();
        } else {
          // 2. 没给过权限，则调用底层方法直接冲进三星系统的授权设置页
          await UsageStatsModule.openUsageAccessSettings();
        }
      } else {
        console.warn('[UsagePermission] UsageStatsModule is not bridged correctly.');
      }
    } catch (e) {
      console.warn('[UsagePermission] Failed to handle permission:', e.message);
    }
    setWaiting(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>SECOND SOUL · 第二灵魂</Text>
        <Text style={styles.title}>To reconstruct{'\n'}a second soul,{'\n'}the system needs{'\n'}to observe.</Text>
        <View style={styles.divider} />
        <Text style={styles.body}>
          The system reads your phone's App usage history — which Apps you use, when, and for how long.
        </Text>
        <Text style={styles.bodyCN}>
          系统读取你的手机应用使用记录——{'\n'}你用了哪些应用，什么时候用，用了多久。
        </Text>
        <View style={styles.items}>
          {[
            ['Collected', 'App names · usage duration · time of day · switching sequence'],
            ['NOT collected', 'App content · messages · browsing history · location · microphone'],
            ['Storage', 'Local only. Never leaves this device.'],
          ].map(([label, desc]) => (
            <View key={label} style={styles.item}>
              <Text style={styles.itemLabel}>{label}</Text>
              <Text style={styles.itemDesc}>{desc}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          This permission requires manual approval in system Settings. The system will open the Settings page.
        </Text>
        <Text style={styles.noteCN}>
          此权限需要在系统设置中手动开启。{'\n'}系统将打开设置页面。
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleGrant} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>
            {waiting ? 'Opening Settings…' : 'OPEN SETTINGS · 打开设置'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>Not now · 暂不授权</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  content: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 4, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 20 },
  title: { fontSize: 32, color: COLORS.textPrimary, fontFamily: 'Georgia', lineHeight: 42, marginBottom: 20 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginBottom: 20 },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 8 },
  bodyCN: { fontSize: 13, color: COLORS.textDim, lineHeight: 22, marginBottom: 24, fontStyle: 'italic' },
  items: { gap: 14, marginBottom: 24 },
  item: { paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: COLORS.divider },
  itemLabel: { fontSize: 11, letterSpacing: 1, color: COLORS.accent, textTransform: 'uppercase', marginBottom: 3 },
  itemDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  note: { fontSize: 12, color: COLORS.textDim, lineHeight: 20, marginBottom: 6 },
  noteCN: { fontSize: 11, color: COLORS.textDim, lineHeight: 18, opacity: 0.6 },
  actions: { gap: 12 },
  primaryBtn: { backgroundColor: COLORS.accent, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, letterSpacing: 2, color: '#FFFFFF', textTransform: 'uppercase' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { fontSize: 12, color: COLORS.textDim },
});
