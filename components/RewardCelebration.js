import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, Image, StyleSheet, Animated, Easing, TouchableOpacity, Pressable,
  useWindowDimensions, AccessibilityInfo, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, G } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme, fonts, radius, shadow, MAX_FONT_SCALE } from "../context/ThemeContext";
import { navigationRef } from "../navigation/navigationRef";
import { badgeImage } from "../utils/image";
import { starPath } from "../utils/townEmblem";
import { shareBadge } from "../utils/badgeShare";
import { setRewardHandlers } from "../utils/rewards";
import { showAlert } from "./AppAlert";
import TownEmblem from "./TownEmblem";
import ProgressRing from "./ProgressRing";
import { BadgeShine, Sparkles } from "./BadgeEffects";
import useReduceMotion from "../hooks/useReduceMotion";

/*
 * The moment something is earned (the thesis panel, 2026-10-21: "pagandahin
 * yung magiging achievement ng user kapag natapos mga missions"). Screens call
 * celebrate / showProgress / celebrateResult from utils/rewards.js; this draws
 * them:
 *
 *   a full-screen moment per reward — a spot's badge, then a town's (bronze),
 *   a district's (silver), The GOAT Traveler (gold), in that order when one
 *   step earns several — and a small banner for a step on the way ("+5 points
 *   · 2 of 3 done at …"). A town's and a district's moment also name the title
 *   that comes with them.
 *
 * The look: the Libot compass star as a slow sunburst behind the reward, gold
 * confetti, and for a whole town or district, fiesta banderitas swinging in
 * across the top. Always on the dark teal of the AR screen, in either theme, so
 * the metals read as metals. Reduce Motion keeps the words and the medal,
 * without the movement.
 */

// ── Words ───────────────────────────────────────────────────────────────────

export function copyFor(item) {
  if (item.kind === "spot") {
    return { eyebrow: "Badge unlocked", headline: item.badge?.name || "New badge", body: "You finished every mission here. It's in your achievements now.", tier: "gold" };
  }
  if (item.kind === "town") {
    const town = item.town?.municipality || "this town";
    return {
      eyebrow: "Town finished · Bronze",
      headline: item.town?.name || town,
      body: item.town?.description && item.town.description !== `Finished every mission in ${town}`
        ? item.town.description
        : `Every spot in ${town}, every mission. That's the whole town.`,
      title: item.town?.title?.name || null,
      tier: "bronze",
    };
  }
  if (item.kind === "district") {
    const name = item.district?.name || "this district";
    return {
      eyebrow: "District finished · Silver",
      headline: name,
      body: `Every town in ${name} with spots, every mission.`,
      title: item.district?.title?.name || null,
      tier: "silver",
    };
  }
  return {
    eyebrow: "New title · Gold",
    headline: item.title?.name || "New title",
    body: "Every town in Bulacan with spots, finished. There's no title above this one.",
    tier: "gold",
  };
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const GOLD = "#F2CE1B";
// The tiers' metals on the dark teal (the theme's bronze and silver are for the
// page behind, which this never uses).
const METAL = { bronze: "#D08A50", silver: "#C9D2D8", gold: GOLD };
const CONFETTI_COLORS = [GOLD, "#8FE1E9", "#FFFFFF", "#56D6E2", "#F6DF5C", "#E0A66B"];
// Fiesta colours for the banderitas.
const FLAG_COLORS = ["#D93A3A", GOLD, "#2E5AAC", "#2F9E62", "#FFFFFF", "#E07B39"];

// The compass star's rays, as a slow-turning sunburst.
function Sunburst({ size, reduce }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 36000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, spin]);
  const rays = useMemo(() => {
    const c = size / 2;
    return Array.from({ length: 16 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 16;
      const w = i % 2 === 0 ? 0.075 : 0.045;
      const r = i % 2 === 0 ? c : c * 0.82;
      const p = (ang, rad) => `${(c + rad * Math.cos(ang)).toFixed(1)},${(c + rad * Math.sin(ang)).toFixed(1)}`;
      return { d: `M${c},${c} L${p(a - w, r)} L${p(a + w, r)} Z`, o: i % 2 === 0 ? 0.12 : 0.065 };
    });
  }, [size]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size}>
        {rays.map((ray, i) => <Path key={i} d={ray.d} fill={GOLD} fillOpacity={ray.o} />)}
      </Svg>
    </Animated.View>
  );
}

function Confetti({ width, height, reduce }) {
  const pieces = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    x: Math.random() * width,
    sway: 18 + Math.random() * 34,
    delay: Math.random() * 700,
    duration: 2600 + Math.random() * 1800,
    rot: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    shape: ["rect", "dot", "diamond"][i % 3],
    v: new Animated.Value(0),
  })), [width]);
  useEffect(() => {
    if (reduce) return undefined;
    const anims = pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: p.duration, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [pieces, reduce]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = p.v.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] });
        const translateX = p.v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [p.x, p.x + p.sway, p.x, p.x - p.sway, p.x] });
        const rotate = p.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.rot}deg`] });
        const opacity = p.v.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
        const shape = p.shape === "rect" ? s.cRect : p.shape === "dot" ? s.cDot : s.cDiamond;
        return (
          <Animated.View
            key={i}
            style={[shape, { backgroundColor: p.color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }]}
          />
        );
      })}
    </View>
  );
}

// A string of triangular flags across the top, as at a town fiesta.
function Banderitas({ width, top, reduce }) {
  const drop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    Animated.spring(drop, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(swing, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swing, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, drop, swing]);
  const h = 84;
  const sag = 34;
  const n = Math.max(9, Math.round(width / 38));
  // The string: a gentle curve; each flag hangs from a point on it.
  const curveY = (t) => 8 + 4 * sag * t * (1 - t);
  const flags = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const x = t * width;
    const y = curveY(t);
    const w = (width / n) * 0.78;
    return { d: `M${(x - w / 2).toFixed(1)},${y.toFixed(1)} L${(x + w / 2).toFixed(1)},${y.toFixed(1)} L${x.toFixed(1)},${(y + 26).toFixed(1)} Z`, color: FLAG_COLORS[i % FLAG_COLORS.length] };
  });
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-h - top, 0] });
  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ["-1.6deg", "1.6deg"] });
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top, left: 0, width, height: h, transform: [{ translateY }, { rotate }] }}>
      <Svg width={width} height={h}>
        <Path d={`M0,8 Q${width / 2},${8 + 2 * sag} ${width},8`} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.5} fill="none" />
        {flags.map((f, i) => <Path key={i} d={f.d} fill={f.color} fillOpacity={0.95} />)}
      </Svg>
    </Animated.View>
  );
}

function Medal({ item, size }) {
  if (item.kind === "spot") {
    return (
      <View style={[s.medalRing, { width: size, height: size, borderRadius: size / 2 }]}>
        {item.badge?.image ? (
          <Image
            source={{ uri: badgeImage(item.badge.image, Math.round(size)) }}
            style={{ width: size - 22, height: size - 22, borderRadius: (size - 22) / 2 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24"><Path d={starPath(12, 12, 12, 7, 3.2)} fill={GOLD} /></Svg>
        )}
      </View>
    );
  }
  // A town's badge in a bronze ring, a district's in silver.
  if (item.kind === "town" || item.kind === "district") {
    const metal = METAL[item.kind === "town" ? "bronze" : "silver"];
    return (
      <View style={[s.medalRing, { width: size, height: size, borderRadius: size / 2, borderColor: metal }]}>
        <TownEmblem image={(item.town || item.district)?.image} size={size - 22} color={metal} />
      </View>
    );
  }
  // The GOAT Traveler: the Libot star itself, struck in gold.
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="46" fill="#0B3A3F" stroke={GOLD} strokeWidth={2} />
      <G>
        <Path d={starPath(50, 50, 40, 24, 11)} fill={GOLD} />
        <Path d={starPath(50, 50, 24, 14, 6.5)} fill="#FBF1C4" />
        <Circle cx="50" cy="50" r="4.5" fill="#0B3A3F" />
      </G>
    </Svg>
  );
}

// ── One moment ──────────────────────────────────────────────────────────────

function Moment({ item, index, count, onNext, onAchievements, onShare, sharing, reduce }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const copy = copyFor(item);

  const medal = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const words = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility?.(`${copy.eyebrow}: ${copy.headline}. ${copy.body}${copy.title ? ` New title: ${copy.title}.` : ""}`);
    if (reduce) return undefined;
    Animated.sequence([
      Animated.spring(medal, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
    ]).start();
    Animated.timing(words, { toValue: 1, duration: 420, delay: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const medalSize = Math.min(188, width * 0.46);
  const burst = Math.max(width, height) * 1.05;
  const scale = medal.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const rotate = medal.interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "0deg"] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const lift = words.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const more = index < count - 1;

  return (
    <View style={s.fill} accessibilityViewIsModal>
      <LinearGradient colors={["#04191B", "#0B3A3F", "#051C1F"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

      <View style={[s.stage, { paddingTop: insets.top + 70 }]}>
        <View style={[s.medalBox, { width: medalSize * 1.5, height: medalSize * 1.5 }]}>
          <Sunburst size={burst} reduce={reduce} />
          <Animated.View style={[s.halo, { width: medalSize * 1.32, height: medalSize * 1.32, borderRadius: medalSize, transform: [{ scale: haloScale }] }]} />
          <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
            <Medal item={item} size={medalSize} />
            {/* The light catching the new badge, as on the Achievements screen. */}
            <BadgeShine size={medalSize} delay={900} every={2200} intensity={0.55} />
          </Animated.View>
          <Sparkles size={medalSize} count={7} spread={0.66} seed={index} />
        </View>

        <Animated.View style={[s.words, { opacity: words, transform: [{ translateY: lift }] }]}>
          <Text style={[s.eyebrow, { color: METAL[copy.tier] }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{copy.eyebrow.toUpperCase()}</Text>
          <Text style={s.headline} maxFontSizeMultiplier={MAX_FONT_SCALE} accessibilityRole="header">{copy.headline}</Text>
          {!!copy.body && <Text style={s.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>{copy.body}</Text>}
          {/* The title that comes with a town or district. */}
          {!!copy.title && (
            <View style={[s.newTitle, { borderColor: METAL[copy.tier] }]}>
              <Svg width={12} height={12} viewBox="0 0 24 24"><Path d={starPath(12, 12, 12, 7, 3.2)} fill={METAL[copy.tier]} /></Svg>
              <Text style={s.newTitleText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                New title: <Text style={{ color: METAL[copy.tier] }}>{copy.title}</Text>
              </Text>
            </View>
          )}
        </Animated.View>
      </View>

      <Confetti width={width} height={height} reduce={reduce} />
      {(item.kind === "town" || item.kind === "district") && <Banderitas width={width} top={insets.top + 6} reduce={reduce} />}

      <Animated.View style={[s.actions, { paddingBottom: Math.max(insets.bottom, 16) + 12, opacity: words }]}>
        {count > 1 && (
          <View style={s.dots} accessible accessibilityLabel={`${index + 1} of ${count}`}>
            {Array.from({ length: count }, (_, i) => (
              <View key={i} style={[s.dot, i === index && s.dotOn]} />
            ))}
          </View>
        )}
        <TouchableOpacity
          onPress={onNext}
          style={[s.primary, { backgroundColor: colors.accent }, shadow.sm]}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={more ? "Next reward" : "Continue"}
        >
          <Text style={[s.primaryText, { color: colors.onAccent }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{more ? "Next" : "Continue"}</Text>
        </TouchableOpacity>
        <View style={s.secondaryRow}>
          {item.kind === "spot" && (
            <TouchableOpacity onPress={onShare} disabled={sharing} style={s.secondary} accessibilityRole="button" accessibilityLabel="Share a link to this badge">
              <Text style={s.secondaryText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{sharing ? "Opening…" : "Share"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onAchievements} style={s.secondary} accessibilityRole="button" accessibilityLabel="View your achievements">
            <Text style={s.secondaryText} maxFontSizeMultiplier={MAX_FONT_SCALE}>View achievements</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ── The banner for a step on the way ────────────────────────────────────────

function ProgressBanner({ data, onDone }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Haptics.selectionAsync().catch(() => {});
    Animated.spring(y, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }).start(onDone);
    }, 3200);
    return () => clearTimeout(t);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const { points, done, total, spotName, complete } = data;
  const line = complete ? `All done at ${spotName}` : `${done} of ${total} done at ${spotName}`;
  return (
    <Animated.View pointerEvents="box-none" style={[s.bannerWrap, { top: insets.top + 8, transform: [{ translateY }], opacity: y }]}>
      <Pressable
        onPress={onDone}
        // Shadow on iOS only: an Android elevation under a rounded view has
        // drawn as a hard square on the team's phone (see Home's tab bar).
        style={[s.banner, { backgroundColor: colors.card, borderColor: colors.cardBorder }, Platform.OS === "ios" && shadow.lg]}
        accessibilityRole="alert"
        accessibilityLabel={`${points ? `Plus ${points} points. ` : ""}${line}`}
      >
        <ProgressRing done={done} total={total} size={40} stroke={4}>
          <Text style={[s.bannerCount, { color: colors.textPrimary }]}>{done}/{total}</Text>
        </ProgressRing>
        <View style={{ flex: 1 }}>
          {!!points && <Text style={[s.bannerPts, { color: colors.brand }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>+{points} points</Text>}
          <Text style={[s.bannerLine, { color: colors.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{line}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

export function RewardCelebrationProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [banner, setBanner] = useState(null);
  const [sharing, setSharing] = useState(false);
  const reduce = useReduceMotion();
  const { getToken } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setRewardHandlers({
      items: (items) => {
        setBanner(null);
        setQueue((prev) => (prev.length ? [...prev, ...items] : items));
      },
      banner: (data) => setBanner({ ...data, at: Date.now() }),
    });
    return () => setRewardHandlers(null);
  }, []);

  const visible = queue.length > 0;
  useEffect(() => {
    if (visible) Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [visible, fade]);

  const close = useCallback((then) => {
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setQueue([]);
      setIndex(0);
      then?.();
    });
  }, [fade]);

  const item = queue[index];
  const next = () => (index < queue.length - 1 ? setIndex(index + 1) : close());
  const toAchievements = () => {
    const tab = { town: "towns", district: "districts", title: "titles" }[item?.kind] || "spots";
    close(() => { if (navigationRef.isReady?.()) navigationRef.navigate("Badges", { tab }); });
  };
  const share = async () => {
    if (!item?.badge) return;
    setSharing(true);
    const ok = await shareBadge(item.badge, getToken);
    setSharing(false);
    if (!ok) showAlert("Error", "Could not open sharing. Please try again.");
  };

  return (
    <>
      {children}
      {banner && !visible && <ProgressBanner key={banner.at} data={banner} onDone={() => setBanner(null)} />}
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={next}>
        <Animated.View style={[s.fill, { opacity: fade }]}>
          {item && (
            <Moment
              key={`${index}-${item.kind}`}
              item={item}
              index={index}
              count={queue.length}
              onNext={next}
              onAchievements={toAchievements}
              onShare={share}
              sharing={sharing}
              reduce={reduce}
            />
          )}
        </Animated.View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fill:      { flex: 1 },
  stage:     { flex: 1, alignItems: "center" },
  medalBox:  { alignItems: "center", justifyContent: "center", overflow: "visible" },
  halo:      { position: "absolute", backgroundColor: "rgba(242,206,27,0.10)", borderWidth: 1, borderColor: "rgba(242,206,27,0.35)" },
  medalRing: {
    alignItems: "center", justifyContent: "center", backgroundColor: "#0B3A3F",
    borderWidth: 6, borderColor: GOLD,
  },
  words:     { alignItems: "center", paddingHorizontal: 32, marginTop: 8 },
  eyebrow:   { fontFamily: fonts.sansBold, fontSize: 12.5, letterSpacing: 3.2, color: GOLD, marginBottom: 8 },
  headline:  { fontFamily: fonts.displayBlack, fontSize: 36, lineHeight: 42, letterSpacing: -0.5, color: "#FFFFFF", textAlign: "center" },
  body:      { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23, color: "rgba(255,255,255,0.78)", textAlign: "center", marginTop: 10, maxWidth: 340 },
  newTitle:  {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.06)",
  },
  newTitleText: { fontFamily: fonts.sansSemi, fontSize: 14, color: "rgba(255,255,255,0.88)" },

  actions:   { paddingHorizontal: 24, gap: 6 },
  dots:      { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 10 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" },
  dotOn:     { backgroundColor: GOLD, width: 18 },
  primary:   { height: 54, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 16.5 },
  secondaryRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  secondary: { paddingVertical: 12, paddingHorizontal: 16 },
  secondaryText: { fontFamily: fonts.sansSemi, fontSize: 14.5, color: "rgba(255,255,255,0.88)", textDecorationLine: "underline" },

  cRect:     { position: "absolute", top: 0, left: 0, width: 7, height: 13, borderRadius: 2 },
  cDot:      { position: "absolute", top: 0, left: 0, width: 9, height: 9, borderRadius: 4.5 },
  cDiamond:  { position: "absolute", top: 0, left: 0, width: 9, height: 9, borderRadius: 1.5 },

  bannerWrap: { position: "absolute", left: 14, right: 14, zIndex: 50 },
  banner:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  bannerCount: { fontFamily: fonts.sansBold, fontSize: 11 },
  bannerPts: { fontFamily: fonts.sansBold, fontSize: 15 },
  bannerLine: { fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 1 },
});
