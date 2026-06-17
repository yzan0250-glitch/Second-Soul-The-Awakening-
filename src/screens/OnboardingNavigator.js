/**
 * SECOND SOUL — Onboarding Navigator
 * Module A: The Ritual Onboarding
 *
 * Screens:
 *  0. WelcomeScreen  — "Before you existed, there was silence."
 *  1. PhilosophyScreen — What Second Soul is
 *  2. PermissionScreen — The three permissions, framed as offerings
 *  3. ReadyScreen     — "The observation begins."
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { usePermissions, PERMISSION_STATUS } from '../hooks/usePermissions';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────
// ONBOARDING NAVIGATOR
// ─────────────────────────────────────────────
export default function OnboardingNavigator({ onComplete }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setStep(s => s + 1);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  };

  const screens = [
    <WelcomeScreen onNext={goNext} />,
    <PhilosophyScreen onNext={goNext} />,
    <PermissionScreen onNext={goNext} />,
    <ReadyScreen onComplete={onComplete} />,
  ];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Ambient top glow */}
      <View style={styles.topGlow} />

      {screens[step]}

      {/* Step dots */}
      {step < 3 && (
        <View style={styles.dots}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// SCREEN 0: WELCOME
// ─────────────────────────────────────────────
function WelcomeScreen({ onNext }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.screen}>
      {/* Soul seed visual */}
      <Animated.View style={[styles.seedOuter, { opacity: pulse }]}>
        <Animated.View style={[styles.seedInner, { transform: [{ scale: pulse }] }]}>
          <View style={styles.seedCore} />
        </Animated.View>
      </Animated.View>

      <View style={styles.textBlock}>
        <Text style={styles.eyebrow}>SECOND SOUL · 第二灵魂</Text>
        <Text style={styles.body}>
          Your behavior does not describe you directly.{'\n'}
          But certain patterns may begin to form.{'\n\n'}
          Not all patterns become structure.{'\n'}
          But when a structure stabilizes,{'\n'}
          it may reveal something else.
        </Text>
        <Text style={styles.bodySecondary}>
          你的行为并不会直接定义你。{'\n'}
          但某些模式可能逐渐浮现。{'\n\n'}
          并非所有模式都会形成结构。{'\n'}
          但当结构趋于稳定，{'\n'}
          它也许会显现出别的东西。
        </Text>
      </View>

      <RitualButton label="CONTINUE · 继续" onPress={onNext} />
    </View>
  );
}

// ─────────────────────────────────────────────
// SCREEN 1: PHILOSOPHY
// ─────────────────────────────────────────────
function PhilosophyScreen({ onNext }) {
  return (
    <View style={styles.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>THE COVENANT · 契约</Text>
        <Text style={styles.headline}>Your data{'\n'}never leaves{'\n'}this device.</Text>
        <Text style={styles.headlineSub}>你的数据永远不会离开这台设备。</Text>

        <View style={styles.rulesBlock}>
          {[
            ['◈', 'Zero servers. Zero clouds.', 'Every byte lives only on your phone.'],
            ['◈', 'Behavior only.', 'Steps, location patterns, and night rhythms. Nothing more.'],
            ['◈', 'No social layer.', 'The soul forms in isolation, without external signal.'],
          ].map(([glyph, title, desc]) => (
            <View key={title} style={styles.rule}>
              <Text style={styles.ruleGlyph}>{glyph}</Text>
              <View style={styles.ruleText}>
                <Text style={styles.ruleTitle}>{title}</Text>
                <Text style={styles.ruleDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.bodySecondary}>
          There is nothing to complete.{'\n'}
          Nothing to optimize.{'\n'}
          Only what emerges.{'\n\n'}
          这里没有需要完成的目标，{'\n'}
          也没有需要优化的结果，{'\n'}
          只有正在浮现的东西。
        </Text>
      </ScrollView>

      <RitualButton label="I UNDERSTAND · 我明白" onPress={onNext} />
    </View>
  );
}

// ─────────────────────────────────────────────
// SCREEN 2: PERMISSIONS
// ─────────────────────────────────────────────
function PermissionScreen({ onNext }) {
  const { permissions, isRequesting, allGranted, allEssentialGranted, requestAll } = usePermissions();

  const permissionItems = [
    {
      key: 'motion',
      glyph: '👣',
      name: 'MOVEMENT · 运动',
      desc: 'Step count — the pulse of your day',
      status: permissions.motion,
    },
    {
      key: 'location',
      glyph: '◎',
      name: 'WANDERING · 漫游',
      desc: 'Where you go — never shared, only observed',
      status: permissions.location,
    },
    {
      key: 'notifications',
      glyph: '◑',
      name: 'WHISPERS · 低语',
      desc: 'Silent daily reflections — no sounds',
      status: permissions.notifications,
    },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.textBlock}>
        <Text style={styles.eyebrow}>THE OFFERING · 献礼</Text>
        <Text style={styles.headline}>Three gifts{'\n'}to the{'\n'}soul.</Text>
        <Text style={styles.body}>
          Grant access to these sensors. · 授予传感器权限。{'\n'}
          They are the eyes of your digital twin.
        </Text>
      </View>

      <View style={styles.permissionsBlock}>
        {permissionItems.map(item => (
          <PermissionRow key={item.key} item={item} />
        ))}
      </View>

      {!allGranted ? (
        <RitualButton
          label={isRequesting ? 'LISTENING… · 倾听中…' : 'GRANT THE THREE · 授予三项权限'}
          onPress={requestAll}
          disabled={isRequesting}
        />
      ) : (
        <RitualButton
          label="THE SOUL STIRS →"
          onPress={onNext}
          highlight
        />
      )}
      {allEssentialGranted && !allGranted && (
        <TouchableOpacity onPress={onNext} style={styles.skipLink}>
          <Text style={styles.skipText}>continue without notifications</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PermissionRow({ item }) {
  const statusColor = {
    [PERMISSION_STATUS.IDLE]: COLORS.textDim,
    [PERMISSION_STATUS.GRANTED]: COLORS.success,
    [PERMISSION_STATUS.DENIED]: COLORS.nightWarm,
    [PERMISSION_STATUS.UNAVAILABLE]: COLORS.textSecondary,
  }[item.status];

  const statusLabel = {
    [PERMISSION_STATUS.IDLE]: '○',
    [PERMISSION_STATUS.GRANTED]: '✓',
    [PERMISSION_STATUS.DENIED]: '✗',
    [PERMISSION_STATUS.UNAVAILABLE]: '–',
  }[item.status];

  return (
    <View style={styles.permRow}>
      <Text style={styles.permGlyph}>{item.glyph}</Text>
      <View style={styles.permText}>
        <Text style={styles.permName}>{item.name}</Text>
        <Text style={styles.permDesc}>{item.desc}</Text>
      </View>
      <Text style={[styles.permStatus, { color: statusColor }]}>{statusLabel}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// SCREEN 3: READY
// ─────────────────────────────────────────────
function ReadyScreen({ onComplete }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.screen, { opacity }]}>
      <Animated.View style={[styles.readyOrb, { transform: [{ scale }] }]} />

      <View style={styles.textBlock}>
        <Text style={styles.eyebrow}>DAY 1 OF 30</Text>
        <Text style={styles.headline}>The{'\n'}observation{'\n'}begins.</Text>
        <Text style={styles.body}>
          Your soul is forming in the darkness.{'\n'}
          Check back in 30 days to meet it.
        </Text>
      </View>

      <RitualButton label="ENTER THE SILENCE · 进入寂静 →" onPress={onComplete} highlight />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// SHARED RITUAL BUTTON
// ─────────────────────────────────────────────
function RitualButton({ label, onPress, disabled, highlight }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.button, highlight && styles.buttonHighlight, disabled && styles.buttonDisabled]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <Text style={[styles.buttonText, highlight && styles.buttonTextHighlight]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.void,
  },
  topGlow: {
    position: 'absolute',
    top: -100,
    left: width * 0.2,
    width: width * 0.6,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.accent,
    opacity: 0.06,
  },
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 32,
  },

  // Soul seed animation
  seedOuter: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(74, 58, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  seedInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(74, 58, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowRadius: 20,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
  },

  // Text hierarchy
  textBlock: {
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 5,
    color: COLORS.accent,
    fontWeight: '300',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headlineSub: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '300',
    letterSpacing: 0.3,
    marginTop: -8,
  },
  headline: {
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: 1,
    color: COLORS.textPrimary,
    fontFamily: 'Georgia',
    fontWeight: '400',
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    lineHeight: 26,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    fontWeight: '300',
  },
  bodySecondary: {
    fontSize: 13,
    lineHeight: 23,
    color: COLORS.textDim,
    letterSpacing: 0.5,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Philosophy rules
  rulesBlock: {
    gap: 20,
    marginTop: 8,
  },
  rule: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  ruleGlyph: {
    fontSize: 16,
    color: COLORS.accent,
    marginTop: 2,
  },
  ruleText: {
    flex: 1,
    gap: 2,
  },
  ruleTitle: {
    fontSize: 13,
    letterSpacing: 1,
    color: COLORS.textPrimary,
    fontWeight: '400',
  },
  ruleDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '300',
    lineHeight: 19,
  },

  // Permissions
  permissionsBlock: {
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  permGlyph: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  permText: {
    flex: 1,
    gap: 2,
  },
  permName: {
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.textPrimary,
    fontWeight: '300',
    textTransform: 'uppercase',
  },
  permDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  permStatus: {
    fontSize: 18,
    fontWeight: '300',
    width: 20,
    textAlign: 'center',
  },

  // Buttons
  button: {
    borderWidth: 1,
    borderColor: COLORS.textDim,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonHighlight: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 11,
    letterSpacing: 4,
    color: COLORS.textSecondary,
    fontWeight: '300',
    textTransform: 'uppercase',
  },
  buttonTextHighlight: {
    color: '#FFFFFF',
  },
  skipLink: {
    alignItems: 'center',
    paddingTop: 16,
  },
  skipText: {
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.textDim,
    textDecorationLine: 'underline',
  },

  // Ready screen
  readyOrb: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowRadius: 40,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: 20,
  },

  // Dots
  dots: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textDim,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 20,
  },
});
