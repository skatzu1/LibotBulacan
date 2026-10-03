import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/clerk-expo";
import { useIsFocused } from "@react-navigation/native";
import { useTheme, fonts, typography, radius, MAX_FONT_SCALE } from "../context/ThemeContext";

/*
 * The first-run tour of Home: the screen dims, one thing at a time is cut out
 * of the dimming, and a card next to it says what it's for, with Skip and
 * Next. Asked for by the thesis panel ("start tutorial on Home").
 *
 * Shown once per account, the first time Home is on screen. Settings has
 * "Show the app tour" to see it again.
 *
 * Home marks the things it explains with `ref={tourTarget("points")}` etc.
 * Each target needs `collapsable={false}` so Android keeps a real view to
 * measure. A step whose target isn't on screen is skipped rather than
 * pointing at nothing.
 */

const SEEN_KEY = (userId) => `homeTourSeen_v1:${userId || "anon"}`;

// In order, top of the screen to the bottom.
const STEPS = [
  {
    key: "avatar",
    title: "Your profile",
    body: "Your badges, the places you've been, and Settings, where you can switch between light and dark mode.",
    round: true,
  },
  {
    key: "points",
    title: "Your points",
    body: "Finish missions and reach places to earn points. They decide your place on the Ranking.",
    round: true,
  },
  {
    key: "quick",
    title: "Start here",
    body: "AR View, Bakit List and Navigate each ask which spot you want first. My Trips keeps the places you've reached.",
  },
  {
    key: "featured",
    title: "Featured places",
    body: "Swipe through them, and tap one to open its story, missions and reviews.",
  },
  {
    key: "tabs",
    title: "Get around",
    body: "Explore spots by category, find the ones you saved, and see who's on top of the Ranking.",
    round: true,
  },
];

// ── Target registry ─────────────────────────────────────────────────────────
// Module-level so Home's header, body and tab bar (three separate components)
// can all register without threading refs through the navigator.
const targets = new Map();
const refFns = {};
export const tourTarget = (key) =>
  (refFns[key] ||= (node) => {
    if (node) targets.set(key, node);
    else targets.delete(key);
  });

// ── Replay from Settings ────────────────────────────────────────────────────
const listeners = new Set();
export function requestHomeTour() {
  listeners.forEach((fn) => fn());
}

const measure = (node) =>
  new Promise((resolve) => {
    if (!node?.measureInWindow) return resolve(null);
    node.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null)
    );
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A rounded rectangle, as an SVG sub-path. With the whole screen as the first
// sub-path and fillRule="evenodd", this becomes the hole in the dimming.
function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

const PAD = 8;          // room between the target and the edge of the hole
const BUBBLE_GAP = 14;  // between the hole and the card
const SIDE = 16;

export default function HomeTour({ rootRef }) {
  const { colors } = useTheme();
  const { user } = useUser();
  const isFocused = useIsFocused();

  // The steps that have a target on screen, with where it is, and the size of
  // the Home screen they were measured in (the overlay covers exactly that).
  const [steps, setSteps] = useState(null);
  const [frame, setFrame] = useState(null);
  const [index, setIndex] = useState(0);
  const running = useRef(false);

  const finish = useCallback(() => {
    setSteps(null);
    setIndex(0);
    running.current = false;
    AsyncStorage.setItem(SEEN_KEY(user?.id), "1").catch(() => {});
  }, [user?.id]);

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;

    // Home's content loads after the header: wait for it (up to ~8 s), then
    // for its entrance animation to settle, so nothing is measured mid-slide.
    for (let i = 0; i < 40 && !(targets.has("quick") && targets.has("points")); i++) await wait(200);
    if (!targets.has("quick")) { running.current = false; return; }
    targets.get("scroll")?.scrollTo?.({ y: 0, animated: false });
    await wait(1000);

    const root = await measure(rootRef.current);
    if (!root) { running.current = false; return; }

    // On a short phone the Featured photo runs on behind the floating tab
    // bar; its hole stops at the bar instead of cutting through it.
    const tabs = await measure(targets.get("tabs"));
    const floor = tabs ? tabs.y - root.y - 6 : root.height;

    const found = [];
    for (const s of STEPS) {
      const box = await measure(targets.get(s.key));
      if (!box) continue;
      const rect = {
        x: box.x - root.x - PAD,
        y: box.y - root.y - PAD,
        width: box.width + PAD * 2,
        height: box.height + PAD * 2,
      };
      if (s.key !== "tabs" && rect.y + rect.height > floor) rect.height = floor - rect.y;
      // Off screen, or almost entirely behind the tab bar → skip it.
      if (rect.y < 0 || rect.height < 48 || rect.y + rect.height > root.height) continue;
      found.push({ ...s, rect });
    }
    if (!found.length) { running.current = false; return; }
    setIndex(0);
    setFrame({ width: root.width, height: root.height });
    setSteps(found);
  }, [rootRef]);

  // First run: once per account, when Home is actually on screen.
  useEffect(() => {
    if (!isFocused || !user?.id) return undefined;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY(user.id))
      .then((seen) => { if (!seen && !cancelled) start(); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isFocused, user?.id, start]);

  // "Show the app tour" in Settings.
  useEffect(() => {
    const fn = () => start();
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, [start]);

  // Android back = Skip while the tour is up.
  useEffect(() => {
    if (!steps) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { finish(); return true; });
    return () => sub.remove();
  }, [steps, finish]);

  if (!steps || !frame) return null;

  const { width: W, height: H } = frame;
  const step = steps[index];
  const last = index === steps.length - 1;
  const { x, y, width, height } = step.rect;
  const r = step.round ? Math.min(height / 2, 32) : radius.card;

  // The card goes on whichever side of the hole has more room, full width,
  // with a small notch pointing at the target.
  const below = y + height / 2 < H / 2;
  const bubbleW = Math.min(W - SIDE * 2, 420);
  const bubbleLeft = (W - bubbleW) / 2;
  const notchX = Math.max(22, Math.min(x + width / 2 - bubbleLeft - 8, bubbleW - 38));
  const bubblePos = below ? { top: y + height + BUBBLE_GAP } : { bottom: H - y + BUBBLE_GAP };

  const next = () => (last ? finish() : setIndex((i) => i + 1));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={`M0 0H${W}V${H}H0Z ${roundedRect(x, y, width, height, r)}`}
          fill="rgba(6,16,18,0.74)"
          fillRule="evenodd"
        />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          s.ring,
          { left: x - 3, top: y - 3, width: width + 6, height: height + 6, borderRadius: r + 3, borderColor: colors.accent },
        ]}
      />

      <Animated.View
        key={step.key}
        entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
        style={[s.bubble, bubblePos, { left: bubbleLeft, width: bubbleW, backgroundColor: colors.card }]}
        accessibilityLiveRegion="polite"
      >
        <View
          style={[
            s.notch,
            below ? { top: -7 } : { bottom: -7 },
            { left: notchX, backgroundColor: colors.card },
          ]}
        />
        <Text style={[s.count, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {index + 1} of {steps.length}
        </Text>
        <Text style={[s.title, { color: colors.brandDark }]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {step.title}
        </Text>
        <Text style={[s.body, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {step.body}
        </Text>

        <View style={s.actions}>
          {!last ? (
            <TouchableOpacity
              onPress={finish}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
            >
              <Text style={[s.skip, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>Skip</Text>
            </TouchableOpacity>
          ) : <View />}
          <TouchableOpacity
            onPress={next}
            style={[s.next, { backgroundColor: colors.accent }]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={last ? "Finish the tour" : "Next tip"}
          >
            <Text style={[s.nextText, { color: colors.onAccent }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {last ? "Start exploring" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  ring: { position: "absolute", borderWidth: 2 },
  bubble: {
    position: "absolute",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  notch: { position: "absolute", width: 16, height: 16, borderRadius: 3, transform: [{ rotate: "45deg" }] },
  count: { ...typography.label, letterSpacing: 0.6, textTransform: "uppercase" },
  title: { ...typography.h2, fontSize: 23, lineHeight: 29, marginTop: 4 },
  body:  { ...typography.body, marginTop: 6 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  skip:  { fontFamily: fonts.sansSemi, fontSize: 14.5, paddingVertical: 8 },
  next:  { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, minWidth: 96, alignItems: "center" },
  nextText: { fontFamily: fonts.sansBold, fontSize: 14.5 },
});
