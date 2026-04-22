import { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Platform, Text, RefreshControl, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { TouchableOpacity } from "react-native";

import FeedItem from "../../components/feed/FeedItem";
import { supabase } from "../../services/supabase";
import { normalizeStorageUrl } from "../../services/storage";
import { COLORS, FONT_SIZE, SPACING } from "../../config/theme";

type FeedPhoto = {
  id:          string;
  url:         string;
  title:       string | null;
  aspect:      number;
  catalog_id:  string;
};

const FALLBACK_RATIOS = [0.75, 1.2, 0.65, 1.0, 0.85, 1.4, 0.7, 1.1];

export default function HomeScreen() {
  const numColumns = Platform.OS === "web" ? 6 : 2;
  const COLUMN_GAP = 10;

  const [photos,     setPhotos]     = useState<FeedPhoto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("photos")
      .select("id, url, title, catalog_id, catalogs!inner(is_private)")
      .eq("catalogs.is_private", false)
      .order("created_at", { ascending: false })
      .limit(60);

    if (fetchErr) {
      // Fallback: fetch all photos without catalog filter
      const { data: fallback } = await supabase
        .from("photos")
        .select("id, url, title, catalog_id")
        .order("created_at", { ascending: false })
        .limit(60);

      const mapped = (fallback ?? []).map((p: any, i: number) => ({
        id:         p.id,
        url:        normalizeStorageUrl(p.url) ?? p.url,
        title:      p.title,
        aspect:     FALLBACK_RATIOS[i % FALLBACK_RATIOS.length],
        catalog_id: p.catalog_id,
      }));
      setPhotos(mapped);
    } else {
      const mapped = (data ?? []).map((p: any, i: number) => ({
        id:         p.id,
        url:        normalizeStorageUrl(p.url) ?? p.url,
        title:      p.title,
        aspect:     FALLBACK_RATIOS[i % FALLBACK_RATIOS.length],
        catalog_id: p.catalog_id,
      }));
      setPhotos(mapped);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFeed(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!loading && photos.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No photos yet — create a catalog and upload some!</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlashList
        data={photos}
        numColumns={numColumns}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.itemWrapper,
              {
                paddingLeft:  (index % numColumns) === 0 ? 0 : COLUMN_GAP / 2,
                paddingRight: (index % numColumns) === (numColumns - 1) ? 0 : COLUMN_GAP / 2,
              },
            ]}
            activeOpacity={0.9}
            onPress={() => router.push(`/photo/${item.id}` as any)}
          >
            <FeedItem
              feeditem={{
                title:       item.title ?? "",
                image:       item.url,
                aspectRatio: item.aspect,
              }}
            />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listPadding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  emptyText: {
    color:     COLORS.textMuted,
    fontSize:  FONT_SIZE.base,
    textAlign: "center",
    lineHeight: 22,
  },
  listPadding: {
    paddingHorizontal: 6,
    paddingTop:        10,
    paddingBottom:     80,
  },
  itemWrapper: {
    flex:         1,
    marginBottom: 10,
  },
});
