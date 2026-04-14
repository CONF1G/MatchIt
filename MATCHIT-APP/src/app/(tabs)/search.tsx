// src/app/(tabs)/search.tsx
// Ecran de căutare — caută cataloage și utilizatori simultan.
// Folosește debounce pentru a nu face query la fiecare tastă.

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import { COLORS, SPACING, RADIUS } from "../../config/theme";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

type CatalogResult = {
  id: string;
  title: string;
  cover_url: string | null;
  photos_count: number;
  likes_count: number;
  profiles: { username: string } | null;
};

type UserResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  catalogs_count: number;
};

type SearchTab = "catalogs" | "users";

/**
 * Render a pressable card representing a catalog search result.
 *
 * Displays the catalog thumbnail (or a fallback icon), the title, the owner's username
 * (falls back to `"unknown"`), the photo count, and a likes badge. Pressing the card
 * navigates to `/catalog/{item.id}`.
 *
 * @param item - The catalog result object to render
 * @returns The JSX element for the catalog result card
 */

function CatalogResultCard({ item }: { item: CatalogResult }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.resultCard, pressed && styles.cardPressed]}
      onPress={() => router.push(`/catalog/${item.id}`)}
    >
      {/* Thumbnail */}
      <View style={styles.catalogThumb}>
        {item.cover_url ? (
          <Image
            source={{ uri: item.cover_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="images-outline" size={20} color={COLORS.textMuted} />
        )}
      </View>

      {/* Info */}
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.resultMeta}>
          @{item.profiles?.username ?? "unknown"} · {item.photos_count} poze
        </Text>
      </View>

      {/* Likes */}
      <View style={styles.resultRight}>
        <Ionicons name="heart" size={12} color={COLORS.danger} />
        <Text style={styles.resultLikes}>{item.likes_count}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Renders a pressable search result card for a user that navigates to the user's page.
 *
 * The card shows the user's avatar (or an initial fallback), display name (falling back to username),
 * username, number of catalogs, and followers count.
 *
 * @param item - The user result object containing at least `id`, `username`, optional `display_name`, optional `avatar_url`, `catalogs_count`, and `followers_count`.
 * @returns A pressable JSX element representing the user result card.
 */
function UserResultCard({ item }: { item: UserResult }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.resultCard, pressed && styles.cardPressed]}
      onPress={() => router.push(`/user/${item.id}`)}
    >
      {/* Avatar */}
      <View style={styles.userAvatar}>
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.userAvatarInitial}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.display_name ?? item.username}
        </Text>
        <Text style={styles.resultMeta}>
          @{item.username} · {item.catalogs_count} cataloage
        </Text>
      </View>

      {/* Followers */}
      <View style={styles.resultRight}>
        <Ionicons name="people" size={12} color={COLORS.textMuted} />
        <Text style={styles.resultLikes}>{item.followers_count}</Text>
      </View>
    </Pressable>
  );
}

// Tag-uri de căutare rapidă (trending)
const TRENDING_TAGS = [
  "architecture", "food", "travel", "art",
  "nature", "urban", "fashion", "sport",
];

/**
 * Render the search screen UI that lets users search catalogs and profiles.
 *
 * Renders a debounced (400ms) search input that queries catalogs and user profiles,
 * presents results in two tabs ("catalogs" and "users") with per-tab counts,
 * shows a loading indicator and an empty-state view when appropriate, and displays
 * initial "Trending" tag chips that populate the search when selected.
 *
 * @returns A React element that renders the searchable catalog/profile interface.
 */

export default function SearchScreen() {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("catalogs");
  const [catalogResults, setCatalogResults] = useState<CatalogResult[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // a fost făcută măcar o căutare?

  // ── Debounce search ────────────────────────────────────────────────────────
  // Așteptăm 400ms după ultima tastă înainte să facem query
  useEffect(() => {
    if (query.trim().length < 2) {
      setCatalogResults([]);
      setUserResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query.trim());
    }, 400);

    // Cleanup: anulăm timer-ul dacă userul mai tastează
    return () => clearTimeout(timer);
  }, [query]);

  // ── Query Supabase ─────────────────────────────────────────────────────────
  const performSearch = useCallback(async (term: string) => {
    setLoading(true);
    setSearched(true);

    // Rulăm ambele query-uri în paralel cu Promise.all
    const [catalogsRes, usersRes] = await Promise.all([
      // ilike = case-insensitive LIKE — % = orice caractere
      supabase
        .from("catalogs")
        .select("id, title, cover_url, photos_count, likes_count, profiles(username)")
        .ilike("title", `%${term}%`)
        .eq("is_private", false)
        .order("likes_count", { ascending: false })
        .limit(20),

      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, followers_count, catalogs_count")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .eq("is_guest", false)
        .order("followers_count", { ascending: false })
        .limit(20),
    ]);

    if (!catalogsRes.error) setCatalogResults(catalogsRes.data as CatalogResult[]);
    if (!usersRes.error) setUserResults(usersRes.data as UserResult[]);

    setLoading(false);
  }, []);

  const handleTagPress = (tag: string) => {
    setQuery(tag);
    Keyboard.dismiss();
  };

  const clearSearch = () => {
    setQuery("");
    setCatalogResults([]);
    setUserResults([]);
    setSearched(false);
  };

  const totalResults =
    activeTab === "catalogs" ? catalogResults.length : userResults.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Caută cataloage, utilizatori..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs rezultate */}
      {searched && (
        <View style={styles.tabs}>
          {(["catalogs", "users"] as SearchTab[]).map((tab) => {
            const count = tab === "catalogs" ? catalogResults.length : userResults.length;
            return (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === "catalogs" ? "Cataloage" : "Utilizatori"}
                </Text>
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.accent} />
        </View>
      )}

      {/* Rezultate */}
      {searched && !loading ? (
        <FlatList
          data={activeTab === "catalogs" ? catalogResults : userResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            activeTab === "catalogs" ? (
              <CatalogResultCard item={item as CatalogResult} />
            ) : (
              <UserResultCard item={item as UserResult} />
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Niciun rezultat</Text>
              <Text style={styles.emptySubtitle}>
                Încearcă un alt termen de căutare
              </Text>
            </View>
          }
        />
      ) : (
        // Starea inițială — trending tags
        !loading && (
          <View style={styles.discoverSection}>
            <Text style={styles.discoverTitle}>Trending</Text>
            <View style={styles.tagsGrid}>
              {TRENDING_TAGS.map((tag) => (
                <Pressable
                  key={tag}
                  style={({ pressed }) => [styles.tag, pressed && { opacity: 0.7 }]}
                  onPress={() => handleTagPress(tag)}
                >
                  <Text style={styles.tagText}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      )}
    </View>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Search bar
  searchBarContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    padding: 0,
  },

  // Tabs
  tabs: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: { color: COLORS.bg },
  tabBadge: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeActive: { backgroundColor: `${COLORS.bg}30` },
  tabBadgeText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  tabBadgeTextActive: { color: COLORS.bg },

  loadingRow: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },

  // Lista rezultate
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardPressed: { opacity: 0.75 },
  catalogThumb: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentDim,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userAvatarInitial: {
    color: COLORS.bg,
    fontSize: 20,
    fontWeight: "800",
  },
  resultInfo: { flex: 1 },
  resultTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  resultMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  resultRight: {
    alignItems: "center",
    gap: 2,
  },
  resultLikes: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },

  // Discover / Trending
  discoverSection: {
    padding: SPACING.md,
  },
  discoverTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: SPACING.md,
  },
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  tag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingTop: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});