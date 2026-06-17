/**
 * SECOND SOUL — Soul Core v5
 * 重新设计的沉睡婴儿，更可爱自然
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const CONTAINER_HEIGHT = height * 0.46;
const CX = width / 2;
const CY = CONTAINER_HEIGHT / 2;

// ─── 粒子 ───────────────────────────────────
function generateParticles(count, radius, entropy, dayProgress) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const convergence = Math.pow(dayProgress, 1.5);
    const scatter = (1 - convergence * 0.55) * (1 + entropy * 0.3 * (Math.random() - 0.5));
    const r = radius * scatter;
    result.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      size: Math.random() * 2.2 + 0.8,
      baseOpacity: Math.random() * 0.35 + 0.2,
      speed: Math.random() * 0.5 + 0.7,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return result;
}

function Particle({ x, y, size, baseOpacity, speed, phase, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const duration = Math.round(2200 / speed);
    const delay = Math.round((phase / (Math.PI * 2)) * duration);
    const timer = setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [baseOpacity * 0.3, baseOpacity] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] });
  return (
    <Animated.View style={{
      position: 'absolute', width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity,
      transform: [{ translateX: CX + x - size / 2 }, { translateY: CY + y - size / 2 }, { scale }],
    }} />
  );
}

// ─── 沉睡婴儿 SVG（重新设计版） ──────────────
function SleepingBaby({ opacity, glowColor }) {
  // 婴儿整体居中
  const cx = width / 2;
  const cy = CY;

  // 肤色系
  const skinLight = '#FFE4C8';
  const skin = '#FECFA8';
  const skinDark = '#F5BC8A';
  const hairColor = '#8B6914';
  const cheekColor = '#FFAAA0';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Svg width={width} height={CONTAINER_HEIGHT}>

        {/* 柔光背景晕 */}
        <Ellipse cx={cx} cy={cy + 10} rx={80} ry={60} fill={glowColor} opacity={0.08} />
        <Ellipse cx={cx} cy={cy + 10} rx={55} ry={40} fill={glowColor} opacity={0.06} />

        {/* ── 身体（蜷缩侧卧） ── */}
        {/* 躯干 */}
        <Ellipse cx={cx + 5} cy={cy + 22} rx={38} ry={26} fill={skin} />
        {/* 衣服纹理 */}
        <Ellipse cx={cx + 5} cy={cy + 22} rx={36} ry={24} fill={skinLight} opacity={0.3} />

        {/* 屁屁（翘起来） */}
        <Circle cx={cx + 36} cy={cy + 14} r={22} fill={skin} />
        <Circle cx={cx + 36} cy={cy + 14} r={18} fill={skinLight} opacity={0.25} />

        {/* 大腿 */}
        <Ellipse cx={cx + 44} cy={cy + 30} rx={16} ry={11} fill={skinDark} opacity={0.7} />
        {/* 小腿 */}
        <Ellipse cx={cx + 50} cy={cy + 20} rx={11} ry={8} fill={skin} />
        {/* 脚丫 */}
        <Ellipse cx={cx + 54} cy={cy + 11} rx={10} ry={7} fill={skin} />
        {/* 脚趾 */}
        <Circle cx={cx + 57} cy={cy + 6} r={3} fill={skinDark} opacity={0.6} />
        <Circle cx={cx + 60} cy={cy + 9} r={2.5} fill={skinDark} opacity={0.5} />
        <Circle cx={cx + 61} cy={cy + 13} r={2.5} fill={skinDark} opacity={0.5} />

        {/* 手臂（藏在胸前） */}
        <Ellipse cx={cx - 10} cy={cy + 8} rx={18} ry={10} fill={skin} />
        {/* 小手 */}
        <Circle cx={cx - 22} cy={cy + 2} r={10} fill={skin} />
        {/* 手指 */}
        <Circle cx={cx - 30} cy={cy - 3} r={3.5} fill={skinDark} opacity={0.5} />
        <Circle cx={cx - 32} cy={cy + 3} r={3} fill={skinDark} opacity={0.45} />
        <Circle cx={cx - 30} cy={cy + 9} r={3} fill={skinDark} opacity={0.4} />

        {/* ── 头部 ── */}
        {/* 头（大圆，Q版比例 头:身 = 1:1） */}
        <Circle cx={cx - 18} cy={cy - 16} r={40} fill={skin} />
        {/* 头部高光 */}
        <Circle cx={cx - 26} cy={cy - 28} r={12} fill={skinLight} opacity={0.4} />

        {/* 耳朵 */}
        <Circle cx={cx - 57} cy={cy - 16} r={11} fill={skin} />
        <Circle cx={cx - 57} cy={cy - 16} r={7} fill={skinDark} opacity={0.15} />

        {/* 头发（自然柔软） */}
        {/* 主发型 */}
        <Ellipse cx={cx - 18} cy={cy - 52} rx={28} ry={12} fill={hairColor} opacity={0.85} />
        <Ellipse cx={cx - 30} cy={cy - 46} rx={16} ry={10} fill={hairColor} opacity={0.8} />
        <Ellipse cx={cx - 4} cy={cy - 46} rx={14} ry={9} fill={hairColor} opacity={0.75} />
        {/* 小呆毛 */}
        <Path d={`M ${cx-18} ${cy-54} Q ${cx-12} ${cy-68} ${cx-8} ${cy-60}`}
          stroke={hairColor} strokeWidth={3.5} fill="none" opacity={0.8} strokeLinecap="round" />
        <Path d={`M ${cx-24} ${cy-55} Q ${cx-30} ${cy-65} ${cx-26} ${cy-58}`}
          stroke={hairColor} strokeWidth={3} fill="none" opacity={0.6} strokeLinecap="round" />

        {/* ── 脸部 ── */}
        {/* 闭眼（弯弯月牙，非常可爱） */}
        <Path d={`M ${cx-32} ${cy-18} Q ${cx-24} ${cy-26} ${cx-16} ${cy-18}`}
          stroke="#8B5A3A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Path d={`M ${cx-10} ${cy-18} Q ${cx-2} ${cy-26} ${cx+6} ${cy-18}`}
          stroke="#8B5A3A" strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {/* 眼睫毛 */}
        <Path d={`M ${cx-32} ${cy-19} L ${cx-35} ${cy-23}`} stroke="#8B5A3A" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
        <Path d={`M ${cx-24} ${cy-26} L ${cx-24} ${cy-30}`} stroke="#8B5A3A" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
        <Path d={`M ${cx-16} ${cy-19} L ${cx-13} ${cy-23}`} stroke="#8B5A3A" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
        <Path d={`M ${cx-10} ${cy-19} L ${cx-7} ${cy-23}`} stroke="#8B5A3A" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
        <Path d={`M ${cx-2} ${cy-26} L ${cx-2} ${cy-30}`} stroke="#8B5A3A" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
        <Path d={`M ${cx+6} ${cy-19} L ${cx+9} ${cy-23}`} stroke="#8B5A3A" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />

        {/* 鼻子（小圆点） */}
        <Circle cx={cx - 13} cy={cy - 10} r={3} fill={skinDark} opacity={0.4} />
        <Circle cx={cx - 5} cy={cy - 10} r={3} fill={skinDark} opacity={0.4} />

        {/* 嘴巴（微微上扬的弧线，像在做梦微笑） */}
        <Path d={`M ${cx-24} ${cy-3} Q ${cx-12} ${cy+4} ${cx} ${cy-3}`}
          stroke="#C47E6A" strokeWidth={2.2} fill="none" strokeLinecap="round" />

        {/* 脸颊红晕 */}
        <Circle cx={cx - 34} cy={cy - 8} r={9} fill={cheekColor} opacity={0.3} />
        <Circle cx={cx + 4} cy={cy - 8} r={9} fill={cheekColor} opacity={0.3} />

        {/* zzz（梦境符号） */}
        <Path d={`M ${cx+18} ${cy-44} L ${cx+28} ${cy-44} L ${cx+18} ${cy-36} L ${cx+28} ${cy-36}`}
          stroke={glowColor} strokeWidth={2.2} fill="none" opacity={0.7}
          strokeLinecap="round" strokeLinejoin="round" />
        <Path d={`M ${cx+24} ${cy-56} L ${cx+32} ${cy-56} L ${cx+24} ${cy-49} L ${cx+32} ${cy-49}`}
          stroke={glowColor} strokeWidth={1.7} fill="none" opacity={0.45}
          strokeLinecap="round" strokeLinejoin="round" />
        <Path d={`M ${cx+30} ${cy-65} L ${cx+36} ${cy-65} L ${cx+30} ${cy-59} L ${cx+36} ${cy-59}`}
          stroke={glowColor} strokeWidth={1.2} fill="none" opacity={0.25}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* 梦境星星 */}
        <Circle cx={cx - 50} cy={cy - 52} r={2} fill={glowColor} opacity={0.5} />
        <Circle cx={cx - 42} cy={cy - 62} r={1.5} fill={glowColor} opacity={0.35} />
        <Circle cx={cx - 56} cy={cy - 38} r={1.5} fill={glowColor} opacity={0.3} />

      </Svg>
    </Animated.View>
  );
}

// ─── 主组件 ─────────────────────────────────
export default function SoulCore({
  stepCount = 0,
  isNightTime = false,
  locationCount = 0,
  dayIndex = 0,
}) {
  const globalPulse = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const coreScale = useRef(new Animated.Value(0.9)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;

  const dayProgress = Math.min(1.0, dayIndex / 30);

  // Pulse speed: active day (steps > 5000) vs quiet day — structural, not scored
  const isActiveDay = stepCount > 5000;
  const pulseDuration = isActiveDay ? 1800 : 3200;

  const particleCount = Math.floor(Math.max(4, (40 + dayProgress * 50) * (1 - dayProgress * 0.88)));
  const radius = 72 + dayProgress * 15;
  const babyOpacity = Math.max(0, Math.min(1, (dayProgress - 0.38) / 0.62));

  // Color: structural state, not a score
  // Night presence → warm; active movement → violet; default → teal
  const soulColor = useMemo(() => {
    if (isNightTime) return '#FF6B3A';
    if (isActiveDay) return '#7B5CFF';
    return '#3AFFE8';
  }, [isNightTime, isActiveDay]);

  // locationCount is raw (0 or 1) — not an entropy score
  const hasLocation = locationCount > 0;
  const particles = useMemo(
    () => generateParticles(particleCount, radius, hasLocation ? 0.3 : 0, dayProgress),
    [particleCount, radius, hasLocation, dayProgress]
  );

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(globalPulse, { toValue: 1, duration: pulseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(globalPulse, { toValue: 0, duration: pulseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true })
    );
    const core = Animated.loop(Animated.sequence([
      Animated.timing(coreScale, { toValue: 1.12, duration: pulseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(coreScale, { toValue: 0.88, duration: pulseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1, duration: 3800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulse.start(); rotate.start(); core.start(); breathe.start();
    return () => { pulse.stop(); rotate.stop(); core.stop(); breathe.stop(); };
  }, [pulseDuration]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = globalPulse.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.18] });
  const ringScale = globalPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.06] });
  const babyBreath = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] });
  const particleOpacity = Math.max(0.05, 1 - dayProgress * 0.92);
  const coreOpacity = Math.max(0, 1 - dayProgress * 1.5);

  return (
    <View style={[styles.container, { height: CONTAINER_HEIGHT }]}>
      <Animated.View style={[styles.ring, styles.ring1, { borderColor: soulColor, opacity: glowOpacity, transform: [{ scale: ringScale }] }]} />
      <Animated.View style={[styles.ring, styles.ring2, { borderColor: soulColor, opacity: glowOpacity, transform: [{ scale: ringScale }] }]} />
      {dayProgress > 0.5 && (
        <Animated.View style={[styles.ring, styles.ring3, { borderColor: soulColor, opacity: glowOpacity, transform: [{ scale: ringScale }] }]} />
      )}

      <Animated.View style={[styles.particleField, { opacity: particleOpacity, transform: [{ rotate }] }]}>
        {particles.map((p, i) => (
          <Particle key={i} x={p.x} y={p.y} size={p.size} baseOpacity={p.baseOpacity} speed={p.speed} phase={p.phase} color={soulColor} />
        ))}
      </Animated.View>

      {coreOpacity > 0 && (
        <Animated.View style={[styles.core, { backgroundColor: soulColor, opacity: coreOpacity, transform: [{ scale: coreScale }] }]} />
      )}

      {babyOpacity > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: babyBreath }] }]}>
          <SleepingBaby opacity={babyOpacity} glowColor={soulColor} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1, borderRadius: 999 },
  ring1: { width: 190, height: 190 },
  ring2: { width: 260, height: 260 },
  ring3: { width: 330, height: 330 },
  particleField: { position: 'absolute', width, height: CONTAINER_HEIGHT },
  core: { width: 46, height: 46, borderRadius: 23 },
});
