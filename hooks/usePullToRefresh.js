import React, { useCallback, useState } from "react";
import { RefreshControl } from "react-native";
import { useTheme } from "../context/ThemeContext";

/*
 * Pull to refresh for a screen that shows fetched data, in the app's colours.
 *
 * `load` re-fetches what the screen shows and returns a promise; the spinner
 * stays until it settles. The loaders it calls keep what's on screen and set
 * their own error state when a request fails, so a failure here only ends the
 * spinner.
 *
 *   const { refreshing, refreshControl } = usePullToRefresh(reload);
 *   <ScrollView refreshControl={refreshControl}>
 *
 * `refreshing` lets a screen keep its list mounted during a pull instead of
 * swapping in its first-load skeleton. `enabled: false` turns the pull off
 * without remounting the list (Android wraps the list in the refresh view).
 */
export default function usePullToRefresh(load, { enabled = true } = {}) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (_) {
      // Each loader reports its own failure; see above.
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      tintColor={colors.brand}
      colors={[colors.brand]}
      progressBackgroundColor={colors.card}
    />
  );

  return { refreshing, refreshControl };
}
