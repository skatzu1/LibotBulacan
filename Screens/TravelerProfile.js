// Screens/TravelerProfile.js
//
// Another traveler's profile, opened by tapping them on the Leaderboard or on
// one of their reviews (2026-10-25). What the board shows, a little more (where
// they live, since when), and "Report this traveler", which goes to the admins'
// User Management → Reported (Screens/ReportTraveler.js). No email, birthday or
// places: the server leaves them out (LibotBackend GET /api/users/traveler/:id).
//
// The name, photo and title the opening screen already had show at once; the
// rest loads under them.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, ListRow, Avatar, EmptyState, ErrorState, H_PAD } from "../components/ui";
import Skeleton from "../components/Skeleton";
import Icon from "../components/Icon";
import TitleChip from "../components/TitleChip";
import { useLive } from "../utils/live";
import api from "../api";

const joinedLabel = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `Joined ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
};

export default function TravelerProfile({ navigation, route }) {
  const { colors } = useTheme();
  const preview = route.params || {};
  const clerkUserId = preview.clerkUserId;

  const [traveler, setTraveler] = useState(null);
  const [error, setError] = useState(null); // "gone" | "hidden" | "failed"
  const [refreshing, setRefreshing] = useState(false);
  const shown = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/users/traveler/${encodeURIComponent(clerkUserId)}`);
      setTraveler(data.traveler);
      shown.current = true;
      setError(null);
    } catch (err) {
      // A profile already on screen stays when a later load fails.
      // They hid their account (2026-10-28), maybe while this was open.
      if (err?.response?.status === 404) setError(err.response.data?.hidden ? "hidden" : "gone");
      else if (!shown.current) setError("failed");
    }
  }, [clerkUserId]);

  // Again on coming back from the report, so it shows as reported.
  useEffect(() => {
    load();
    return navigation.addListener("focus", load);
  }, [navigation, load]);
  // Points, title or photo changed; or they were banned and left public view.
  useLive(["progress"], load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const name = traveler?.name || preview.name || "Traveler";
  const photo = traveler ? traveler.profileImage : preview.avatar;
  const title = traveler ? traveler.title : preview.title;
  const sub = [traveler?.municipality && `Lives in ${traveler.municipality}`, joinedLabel(traveler?.joinedAt)]
    .filter(Boolean).join(" · ");

  const header = <ScreenHeader title="Traveler" onBack={() => navigation.goBack()} />;

  if (error === "gone" || error === "hidden") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.state}>
          {error === "hidden"
            ? <EmptyState icon="eye-off" title="This traveler keeps their account hidden" text="They chose not to show their profile to other travelers." />
            : <EmptyState icon="user" title="This traveler is no longer here" text="Their account was removed or is out of public view." />}
        </View>
      </View>
    );
  }
  if (error === "failed" && !traveler) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.state}>
          <ErrorState onRetry={load} />
        </View>
      </View>
    );
  }

  const stat = (icon, label, value, tint) => (
    <View style={styles.statCard} accessible accessibilityLabel={traveler ? `${value} ${label.toLowerCase()}` : `${label}, loading`}>
      <Icon name={icon} size={18} color={tint} style={styles.statIcon} />
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      {traveler
        ? <Text style={[styles.statCount, { color: colors.textPrimary }]}>{value}</Text>
        : <Skeleton width={36} height={26} radius={8} style={styles.statBone} />}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.card} />
        }
      >
        <View style={styles.photoContainer}>
          <View style={[styles.photoWrapper, { backgroundColor: colors.brand, borderColor: colors.card }]}>
            <Avatar uri={photo} name={name} size={96} strong />
          </View>
        </View>

        <Text style={[styles.userName, { color: colors.textPrimary }]}>{name}</Text>
        {title && <TitleChip title={title} style={styles.title} />}
        {traveler
          ? !!sub && <Text style={[styles.sub, { color: colors.textSecondary }]}>{sub}</Text>
          : <Skeleton width={180} height={13} radius={6} style={styles.subBone} />}

        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {stat("map-pin", "Spots", traveler?.spotsVisited ?? 0, colors.brand)}
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          {stat("star", "Points", traveler?.points ?? 0, colors.star)}
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          {stat("award", "Badges", (traveler?.badges ?? 0) + (traveler?.townBadges ?? 0), colors.brand)}
        </View>

        {traveler && !traveler.isMe && (traveler.reportedByMe ? (
          <ListRow
            icon="check-circle"
            title="You reported this traveler"
            subtitle="The admins will look at it."
            right={null}
          />
        ) : (
          <ListRow
            icon="flag"
            title="Report this traveler"
            subtitle="Their name, photo or what they did"
            danger
            onPress={() => navigation.navigate("ReportTraveler", { clerkUserId, name })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 60 },
  state:         { paddingHorizontal: H_PAD, paddingTop: 24 },

  photoContainer: { alignItems: "center", marginBottom: 14 },
  photoWrapper: {
    width: 104, height: 104, borderRadius: 52, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
    borderWidth: 4,
  },

  userName: { ...typography.display, fontSize: 26, lineHeight: 32, textAlign: "center", marginBottom: 4 },
  title:    { alignSelf: "center", marginBottom: 8 },
  sub:      { fontSize: 13, fontFamily: fonts.sansMedium, textAlign: "center", marginBottom: 26 },
  subBone:  { alignSelf: "center", marginTop: 2, marginBottom: 26 },

  statsRow: {
    flexDirection: "row", borderRadius: 22, paddingVertical: 20, paddingHorizontal: 12,
    marginBottom: 28, alignItems: "center", borderWidth: 1,
  },
  statCard:    { flex: 1, alignItems: "center" },
  statIcon:    { marginBottom: 5 },
  statDivider: { width: 1, height: 50, marginHorizontal: 4 },
  statLabel:   { fontSize: 11, fontFamily: fonts.sansMedium, marginBottom: 4 },
  statCount:   { ...typography.display, fontSize: 28, lineHeight: 32 },
  statBone:    { marginTop: 3, marginBottom: 3 },
});
