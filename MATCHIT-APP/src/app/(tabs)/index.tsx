import { useMemo, useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, Text, ScrollView,
  RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FeedItem, { FeedItemData } from "../../components/feed/FeedItem";
import { supabase } from "../../services/supabase";
import { normalizeStorageUrl } from "../../services/storage";
import { COLORS, FONT_SIZE, SPACING } from "../../config/theme";

type FeedPhoto = {
  id:         string;
  url:        string;
  title:      string | null;
  aspect:     number;
  catalog_id: string;
};

const FALLBACK_RATIOS = [0.75, 1.2, 0.65, 1.0, 0.85, 1.4, 0.7, 1.1];
const COL_GAP = 8;
const IS_WEB  = Platform.OS === "web";
const NUM_COLS = IS_WEB ? 7 : 2;

// Distribute photos into N columns, balancing cumulative height
function splitColumns(photos: FeedPhoto[], numCols: number): FeedPhoto[][] {
  const cols    = Array.from({ length: numCols }, (): FeedPhoto[] => []);
  const heights = new Array<number>(numCols).fill(0);
  for (const p of photos) {
    const h   = 1 / (p.aspect || 1);
    const idx = heights.indexOf(Math.min(...heights));
    cols[idx].push(p);
    heights[idx] += h;
  }
  return cols;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [photos,     setPhotos]     = useState<FeedPhoto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos")
      .select("id, url, title, catalog_id, catalogs!inner(is_private)")
      .eq("catalogs.is_private", false)
      .order("created_at", { ascending: false })
      .limit(60);

    const rows = error
      ? (await supabase
          .from("photos")
          .select("id, url, title, catalog_id")
          .order("created_at", { ascending: false })
          .limit(60)
        ).data ?? []
      : data ?? [];

    setPhotos(
      rows.map((p: any, i: number) => ({
        id:         p.id,
        url:        normalizeStorageUrl(p.url) ?? p.url,
        title:      p.title,
        aspect:     FALLBACK_RATIOS[i % FALLBACK_RATIOS.length],
        catalog_id: p.catalog_id,
      }))
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const cols = useMemo(() => splitColumns(photos, NUM_COLS), [photos]);

  const toItem = (p: FeedPhoto): FeedItemData => ({
    id:          p.id,
    url:         p.url,
    title:       p.title,
    aspectRatio: p.aspect,
    catalogId:   p.catalog_id,
  });

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>
          No photos yet — create a catalog and upload some!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchFeed(); }}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={[styles.columns, IS_WEB && styles.columnsWeb]}>
          {cols.map((col, i) => (
            <View key={i} style={styles.column}>
              {col.map((p) => <FeedItem key={p.id} item={toItem(p)} />)}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  center: {
    flex:             1,
    backgroundColor:  COLORS.bg,
    alignItems:       "center",
    justifyContent:   "center",
    padding:          SPACING.xl,
  },
  emptyText: {
    color:      COLORS.textMuted,
    fontSize:   FONT_SIZE.base,
    textAlign:  "center",
    lineHeight: 22,
  },

  grid: {
    paddingHorizontal: 6,
    paddingTop:        10,
    paddingBottom:     80,
  },
  columns: {
    flexDirection: "row",
    gap:           COL_GAP,
  },
  columnsWeb: {
    width: "100%" as any,
  },
  column: {
    flex: 1,
    gap:  COL_GAP,
  },
});
