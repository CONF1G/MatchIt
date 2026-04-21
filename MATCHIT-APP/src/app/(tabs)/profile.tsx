import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/useAuth";
import { fetchUserCatalogs } from "../../services/catalog";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

/**
 * Displays a compact stat block showing a numeric value above a label.
 *
 * @returns A view containing the numeric stat value and its label.
 */

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * Renders a pressable catalog card for a single catalog item.
 *
 * Displays the item's cover image (or an images icon if absent), a lock badge when the item is private, the title (single line), and the photo count. Pressing the card navigates to `/catalog/{item.id}`.
 *
 * @param item - Catalog object containing at least `id`, `title`, and optional `cover_url`, `is_private`, and `photos_count`
 * @returns The rendered catalog card element
 */

function CatalogCard({ item }: { item: any }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.catalogCard, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/catalog/${item.id}`)}
    >
      <View style={styles.catalogThumb}>
        {item.cover_url ? (
          <Image
            source={{ uri: item.cover_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Ionicons name="images-outline" size={22} color={C.textMuted} />
        )}
        {item.is_private && (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={10} color={C.text} />
          </View>
        )}
      </View>
      <Text style={styles.catalogTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.catalogMeta}>{item.photos_count ?? 0} photos</Text>
    </Pressable>
  );
}

/**
 * Render the profile screen showing the current user's avatar, display info, stats,
 * action buttons, and a two-column grid of their catalogs with pull-to-refresh.
 *
 * Renders an avatar (image or initials), display name, username, bio, three stat pills
 * (Catalogs, Followers, Following), buttons for Friends and Sign out (with confirmation
 * and loading state), a "My Catalogs" header with a New button, and a FlatList of
 * catalog cards that supports refresh and an empty-state CTA.
 *
 * @returns A React element containing the complete profile UI including header, actions,
 * and a two-column catalog listing.
 */

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, signingOut } = useAuth();

  const [catalogs,   setCatalogs]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCatalogs = useCallback(async () => {
    if (!user) return;
    const { data } = await fetchUserCatalogs(user.id, true);
    setCatalogs(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { loadCatalogs(); }, [loadCatalogs]);

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  const displayName = profile?.display_name ?? profile?.username ?? user?.email?.split("@")[0] ?? "You";
  const username    = profile?.username ?? "";
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={catalogs}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: SPACING.sm }}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadCatalogs(); }}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Avatar + name ── */}
            <View style={styles.hero}>
              <View style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>

              <Text style={styles.displayName}>{displayName}</Text>
              {username ? <Text style={styles.username}>@{username}</Text> : null}

              {profile?.bio ? (
                <Text style={styles.bio}>{profile.bio}</Text>
              ) : null}

              {/* Stats */}
              <View style={styles.statsRow}>
                <StatPill value={profile?.catalogs_count  ?? 0} label="Catalogs"  />
                <View style={styles.statDivider} />
                <StatPill value={profile?.followers_count ?? 0} label="Followers" />
                <View style={styles.statDivider} />
                <StatPill value={profile?.following_count ?? 0} label="Following" />
              </View>

              {/* Action buttons */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.editBtn}
                  onPress={() => router.push("/user/friends" as any)}
                >
                  <Ionicons name="people-outline" size={16} color={C.text} />
                  <Text style={styles.editBtnText}>Friends</Text>
                </Pressable>

                <Pressable
                  style={[styles.editBtn, { flex: 0, paddingHorizontal: SPACING.md }]}
                  onPress={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut
                    ? <ActivityIndicator size="small" color={C.danger} />
                    : <Ionicons name="log-out-outline" size={18} color={C.danger} />
                  }
                </Pressable>
              </View>
            </View>

            {/* ── Catalogs header ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Catalogs</Text>
              <Pressable
                style={styles.newCatalogBtn}
                onPress={() => router.push("/(modals)/create-catalog" as any)}
              >
                <Ionicons name="add" size={16} color={C.accent} />
                <Text style={styles.newCatalogText}>New</Text>
              </Pressable>
            </View>

            {loading && (
              <ActivityIndicator color={C.accent} style={{ marginTop: SPACING.lg }} />
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={44} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No catalogs yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first catalog to start sharing photos.
              </Text>
              <Pressable
                style={styles.createBtn}
                onPress={() => router.push("/(modals)/create-catalog" as any)}
              >
                <Ionicons name="add" size={18} color={C.bg} />
                <Text style={styles.createBtnText}>Create Catalog</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => <CatalogCard item={item} />}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  listContent: {
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.sm,
  },

  // Hero
  hero: {
    alignItems:    "center",
    paddingTop:    SPACING.xl,
    paddingBottom: SPACING.lg,
    gap:           SPACING.sm,
    marginBottom:  SPACING.sm,
  },
  avatarWrap: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: C.accentDim,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
    marginBottom:    SPACING.sm,
  },
  avatarImg:      { width: "100%", height: "100%" },
  avatarInitials: { color: C.bg, fontSize: FONT_SIZE.xxl, fontWeight: "900" },

  displayName: {
    color:      C.text,
    fontSize:   FONT_SIZE.xxl,
    fontWeight: "800",
  },
  username: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  bio: {
    color:     C.textSecondary,
    fontSize:  FONT_SIZE.base,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },

  statsRow: {
    flexDirection: "row",
    alignItems:    "center",
    backgroundColor: C.surface,
    borderRadius:  RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderWidth:   1,
    borderColor:   C.border,
    marginTop:     SPACING.sm,
  },
  stat: { alignItems: "center", flex: 1 },
  statValue: {
    color:      C.text,
    fontSize:   FONT_SIZE.xl,
    fontWeight: "800",
  },
  statLabel: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  statDivider: {
    width:  1,
    height: 28,
    backgroundColor: C.border,
  },

  actionsRow: {
    flexDirection: "row",
    gap:           SPACING.sm,
    marginTop:     SPACING.xs,
    width:         "100%",
  },
  editBtn: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               SPACING.xs,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.lg,
    paddingVertical:   SPACING.sm + 2,
    borderWidth:       1,
    borderColor:       C.border,
  },
  editBtnText: {
    color:      C.text,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "600",
  },

  // Section header
  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   SPACING.md,
    marginTop:      SPACING.sm,
  },
  sectionTitle: {
    color:         C.text,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  newCatalogBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   C.accentSubtle,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  newCatalogText: {
    color:      C.accent,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "700",
  },

  // Catalog cards
  catalogCard: {
    flex:  1,
    gap:   SPACING.xs,
  },
  catalogThumb: {
    aspectRatio:     1,
    borderRadius:    RADIUS.lg,
    backgroundColor: C.surface,
    overflow:        "hidden",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     C.border,
    position:        "relative",
  },
  privateBadge: {
    position:        "absolute",
    top:             SPACING.xs,
    right:           SPACING.xs,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius:    RADIUS.full,
    padding:         4,
  },
  catalogTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "600",
  },
  catalogMeta: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.xs,
  },

  // Empty state
  empty: {
    alignItems:    "center",
    paddingTop:    SPACING.xxl,
    paddingBottom: SPACING.xl,
    gap:           SPACING.sm,
  },
  emptyTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.xl,
    fontWeight: "700",
  },
  emptySubtitle: {
    color:     C.textMuted,
    fontSize:  FONT_SIZE.sm,
    textAlign: "center",
    paddingHorizontal: SPACING.xl,
  },
  createBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               SPACING.xs,
    backgroundColor:   C.accent,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical:   SPACING.sm + 2,
    marginTop:         SPACING.sm,
  },
  createBtnText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.base,
    fontWeight: "800",
  },
});
