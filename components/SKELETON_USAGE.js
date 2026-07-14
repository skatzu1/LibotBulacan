/**
 * HOW TO WIRE UP SKELETONS
 * ========================
 * Four skeleton components, four screens. Each section below shows the
 * exact lines to change — search for the comment anchor, replace the
 * ActivityIndicator (or the loading text) with the skeleton.
 *
 * All skeleton files live in: components/
 *   Skeleton.js             ← primitive (used internally)
 *   HomeSkeleton.js
 *   InformationSkeleton.js
 *   ListsSkeleton.js
 *   CategoriesSkeleton.js
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * 1.  Home.js  →  HomeContent  (the TopCities loading state)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIND (inside HomeTab):
 *
 *   if (loading) return null;
 *
 * REPLACE WITH:
 *
 *   import HomeSkeleton from "../components/HomeSkeleton";
 *   // ... inside HomeTab:
 *   if (loading) return <HomeSkeleton />;
 *
 * ALSO FIND (inside HomeContent, the topLoading block):
 *
 *   {topLoading ? (
 *     <View style={h.loadingBox}>
 *       <Text style={[h.loadingText, { color: colors.textMuted }]}>Loading…</Text>
 *     </View>
 *   ) : ...
 *
 * This is now covered by HomeSkeleton showing on the whole screen before
 * allSpots is populated. If you want the Top Cities section to shimmer
 * independently on pull-to-refresh, replace just that block:
 *
 *   import { View, StyleSheet, Dimensions } from "react-native";
 *   import Skeleton from "../components/Skeleton";
 *   const { width } = Dimensions.get("window");
 *   const CARD_W = (width - 54) / 2;
 *
 *   {topLoading ? (
 *     <View>
 *       <Skeleton width="100%" height={175} radius={18} style={{ marginBottom: 10 }} />
 *       <View style={{ flexDirection: "row", gap: 10 }}>
 *         <Skeleton width={CARD_W} height={140} radius={18} />
 *         <Skeleton width={CARD_W} height={140} radius={18} />
 *       </View>
 *     </View>
 *   ) : ...
 */


/* ─────────────────────────────────────────────────────────────────────────────
 * 2.  InformationScreen.js  →  add a loading state while reviews + missions fetch
 * ─────────────────────────────────────────────────────────────────────────────
 * ADD state + effect near the top of InformationScreen:
 *
 *   import InformationSkeleton from "../components/InformationSkeleton";
 *
 *   const [screenReady, setScreenReady] = useState(false);
 *
 *   // existing useEffect that calls fetchReviews + fetchMissions:
 *   useEffect(() => {
 *     if (spot?._id) {
 *       setScreenReady(false);
 *       Promise.all([fetchReviews(spot._id), fetchMissions(spot._id)])
 *         .finally(() => setScreenReady(true));
 *     }
 *   }, [spot?._id]);
 *
 * FIND (right after the !spot guard):
 *
 *   // existing: if (!spot) { ... }
 *
 * ADD after that block:
 *
 *   if (!screenReady) return <InformationSkeleton />;
 */


/* ─────────────────────────────────────────────────────────────────────────────
 * 3.  Lists.js  →  replace ActivityIndicator loading screen
 * ─────────────────────────────────────────────────────────────────────────────
 * ADD import at the top:
 *
 *   import ListsSkeleton from "../components/ListsSkeleton";
 *
 * FIND:
 *
 *   if (loading) {
 *     return (
 *       <View style={styles.loadingContainer}>
 *         <ActivityIndicator size="large" color="#6b4b45" />
 *         <Text style={styles.loadingText}>Loading destinations...</Text>
 *       </View>
 *     );
 *   }
 *
 * REPLACE WITH:
 *
 *   if (loading) return <ListsSkeleton cardCount={4} />;
 *
 * You can also remove loadingContainer + loadingText from the StyleSheet
 * if nothing else uses them.
 */


/* ─────────────────────────────────────────────────────────────────────────────
 * 4.  Categories.js  →  no existing loader, add one on initial mount
 * ─────────────────────────────────────────────────────────────────────────────
 * ADD import at the top:
 *
 *   import { useState, useEffect } from "react";
 *   import CategoriesSkeleton from "../components/CategoriesSkeleton";
 *
 * ADD state inside the component (categories is a static array so this
 * just gives the images time to be ready):
 *
 *   const [ready, setReady] = useState(false);
 *   useEffect(() => {
 *     // Tiny defer so the navigator transition finishes before heavy render
 *     const t = setTimeout(() => setReady(true), 120);
 *     return () => clearTimeout(t);
 *   }, []);
 *
 *   if (!ready) return <CategoriesSkeleton count={4} />;
 *
 * Place that guard right before the main return.
 */
