import React, { useCallback, useRef, useState } from "react";
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, typography, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { PrimaryButton, H_PAD } from "./ui";
import Icon from "./Icon";
import { LEGAL_DOCS } from "../utils/legalText";

/*
 * The Terms and Conditions and the Privacy Policy, in full, before sign-up
 * (the thesis panel, 2026-10-21: "pop up and scroll muna ng user sa baba bago
 * i-approve"). "I agree" stays off until the reader has reached the end of
 * both; a text short enough to fit on one screen counts as read.
 *
 * The words are the website's (utils/legalText.js, generated from
 * libotbulacan.com/terms and /privacy by scripts/gen-legal.js).
 */

// How close to the bottom counts as the end: a fling rarely lands on the last pixel.
const END_SLACK = 24;

/** Has a scroll view of this size reached its end? */
export function reachedEnd({ layoutHeight, offsetY, contentHeight }) {
  return layoutHeight > 0 && contentHeight > 0 && layoutHeight + offsetY >= contentHeight - END_SLACK;
}

function Runs({ runs, style, boldStyle }) {
  return (
    <Text style={style}>
      {runs.map((r, i) => (
        <Text key={i} style={r.bold ? boldStyle : null}>{r.text}</Text>
      ))}
    </Text>
  );
}

function Block({ block, colors }) {
  if (block.type === "h") {
    return <Text style={[st.heading, { color: colors.textPrimary }]} accessibilityRole="header">{block.text}</Text>;
  }
  const bold = [st.bold, { color: colors.textPrimary }];
  if (block.type === "li") {
    return (
      <View style={[st.li, { paddingLeft: (block.depth - 1) * 18 }]}>
        <View style={[st.bullet, { backgroundColor: block.depth > 1 ? colors.textMuted : colors.brand }]} />
        <Runs runs={block.runs} style={[st.body, { color: colors.textSecondary }]} boldStyle={bold} />
      </View>
    );
  }
  return (
    <Runs
      runs={block.runs}
      style={[block.lede ? st.lede : st.body, st.para, { color: block.lede ? colors.textPrimary : colors.textSecondary }]}
      boldStyle={bold}
    />
  );
}

export default function LegalConsentModal({ visible, onAgree, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [atEnd, setAtEnd] = useState(false);
  const [progress, setProgress] = useState(0);
  const size = useRef({ layoutHeight: 0, contentHeight: 0, offsetY: 0 });

  const check = useCallback(() => {
    const m = size.current;
    const scrollable = Math.max(1, m.contentHeight - m.layoutHeight);
    setProgress(m.contentHeight <= m.layoutHeight ? 1 : Math.min(1, m.offsetY / scrollable));
    if (reachedEnd(m)) setAtEnd(true); // once reached, it stays reached
  }, []);

  const onShow = () => { setAtEnd(false); setProgress(0); size.current.offsetY = 0; };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
      onShow={onShow}
    >
      <View style={[st.root, { backgroundColor: colors.background, paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8 }]}>
        <View style={st.head}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { color: colors.textPrimary }]} maxFontSizeMultiplier={MAX_FONT_SCALE} accessibilityRole="header">
              Terms and Privacy
            </Text>
            <Text style={[st.sub, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Read both to the end, then agree to create your account.
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[st.close, { backgroundColor: colors.backgroundSoft }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close without agreeing"
          >
            <Icon name="x" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Reading progress: how far through the two documents. */}
        <View style={[st.track, { backgroundColor: colors.divider }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[st.fill, { backgroundColor: colors.brand, width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <ScrollView
          testID="legal-scroll"
          style={{ flex: 1 }}
          contentContainerStyle={st.scroll}
          scrollEventThrottle={64}
          onLayout={(e) => { size.current.layoutHeight = e.nativeEvent.layout.height; check(); }}
          onContentSizeChange={(_, h) => { size.current.contentHeight = h; check(); }}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            size.current = { layoutHeight: layoutMeasurement.height, offsetY: contentOffset.y, contentHeight: contentSize.height };
            check();
          }}
        >
          {LEGAL_DOCS.map((doc, d) => (
            <View key={doc.title} style={d > 0 ? [st.docGap, { borderTopColor: colors.divider }] : null}>
              <Text style={[st.docTitle, { color: colors.textPrimary }]} accessibilityRole="header">{doc.title}</Text>
              <Text style={[st.effective, { color: colors.textMuted }]}>Effective {doc.effective}</Text>
              {doc.blocks.map((b, i) => <Block key={i} block={b} colors={colors} />)}
            </View>
          ))}
          <Text style={[st.end, { color: colors.textMuted }]}>End of the Terms and Privacy Policy</Text>
        </ScrollView>

        <View style={[st.foot, { borderTopColor: colors.divider, backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          {!atEnd && (
            <View style={st.hintRow}>
              <Icon name="chevrons-down" size={14} color={colors.textMuted} />
              <Text style={[st.hint, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Scroll to the end to agree · {Math.round(progress * 100)}% read
              </Text>
            </View>
          )}
          <PrimaryButton
            title={atEnd ? "I agree" : "Scroll to the end"}
            icon={atEnd ? "check" : undefined}
            onPress={() => atEnd && onAgree?.()}
            disabled={!atEnd}
            accessibilityLabel={atEnd ? "I agree to the Terms and Conditions and Privacy Policy" : "Scroll to the end to agree"}
          />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root:      { flex: 1 },
  head:      { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: H_PAD, paddingBottom: 12 },
  sub:       { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  close:     { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  track:     { height: 3 },
  fill:      { height: 3 },
  scroll:    { paddingHorizontal: H_PAD, paddingTop: 20, paddingBottom: 28 },
  docGap:    { marginTop: 28, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth },
  docTitle:  { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  effective: { fontFamily: fonts.sansMedium, fontSize: 12.5, marginTop: 4, marginBottom: 14 },
  heading:   { fontFamily: fonts.sansSemi, fontSize: 16, lineHeight: 22, marginTop: 18, marginBottom: 8 },
  body:      { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 22, flex: 1 },
  lede:      { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 23 },
  para:      { marginBottom: 10 },
  bold:      { fontFamily: fonts.sansSemi },
  li:        { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  bullet:    { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  end:       { fontFamily: fonts.sansMedium, fontSize: 12.5, textAlign: "center", marginTop: 24 },
  foot:      { paddingHorizontal: H_PAD, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  hintRow:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hint:      { fontFamily: fonts.sansMedium, fontSize: 12.5, flexShrink: 1, textAlign: "center" },
});
