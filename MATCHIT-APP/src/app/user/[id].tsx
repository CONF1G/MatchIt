import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/useAuth";
import {
  fetchUserProfile, fetchUserPublicCatalogs,
  checkIsFollowing, followUser, unfollowUser,
} from "../../services/social";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";
import { Profile } from "../../types/database";
import { CatalogPreview } from "../../services/social";
import { PhotoMosaic } from "../../components/catalog/CatalogThumb";

const C = COLORS;

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Catalog card ─────────────────────────────────────────────────────────────

function CatalogCard({ item }: { item: CatalogPreview }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.catalogCard, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/catalog/${item.id}` as any)}
    >
      <View style={styles.catalogThumb}>
        <PhotoMosaic photos={item.previewPhotos} />
      </View>
      <Text style={styles.catalogTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.catalogMeta}>{item.photos_count ?? 0} photos</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [catalogs,      setCatalogs]      = useState<CatalogPreview[]>([]);
  const [isFollowing,   setIsFollowing]   = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [profileRes, catalogsRes] = await Promise.all([
      fetchUserProfile(id),
      fetchUserPublicCatalogs(id),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    setCatalogs(catalogsRes.data ?? []);

    if (user) {
      const following = await checkIsFollowing(user.id, id);
      setIsFollowing(following);
    }

    setLoading(false);
    setRefreshing(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (!user || !id) return;
    setFollowLoading(true);
    if (isFollowing) {
      setIsFollowing(false);
      setProfile((p) => p ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p);
      const { error } = await unfollowUser(id);
      if (error) {
        setIsFollowing(true);
        setProfile((p) => p ? { ...p, followers_count: p.followers_count + 1 } : p);
      }
    } else {
      setIsFollowing(true);
      setProfile((p) => p ? { ...p, followers_count: p.followers_count + 1 } : p);
      const { error } = await followUser(id);
      if (error) {
        setIsFollowing(false);
        setProfile((p) => p ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p);
      }
    }
    setFollowLoading(false);
  };

  const displayName = profile?.display_name ?? profile?.username ?? "User";
  const username    = profile?.username ?? "";
  const initials    = displayName.slice(0, 2).toUpperCase();
  const isOwnProfile = user?.id === id;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Fixed back button */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </Pressable>

      {loading ? (
        <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
      ) : (
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
              onRefresh={() => { setRefreshing(true); load(); }}
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

                {/* Follow button — only shown for other users when logged in */}
                {user && !isOwnProfile && (
                  <Pressable
                    style={[styles.followBtn, isFollowing && styles.followingBtn]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isFollowing ? C.text : C.bg}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={isFollowing ? "person-remove-outline" : "person-add-outline"}
                          size={16}
                          color={isFollowing ? C.text : C.bg}
                        />
                        <Text style={[
                          styles.followBtnText,
                          isFollowing && styles.followingBtnText,
                        ]}>
                          {isFollowing ? "Following" : "Follow"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* ── Catalogs header ── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Catalogs</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={44} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No public catalogs</Text>
            </View>
          }
          renderItem={({ item }) => <CatalogCard item={item} />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  backBtn: {
    position:        "absolute",
    top:             0,
    left:            SPACING.md,
    zIndex:          10,
    padding:         SPACING.sm,
    paddingTop:      SPACING.md,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.sm,
  },

  // Hero
  hero: {
    alignItems:    "center",
    paddingTop:    SPACING.xxl + SPACING.xl,
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
    color:             C.textSecondary,
    fontSize:          FONT_SIZE.base,
    textAlign:         "center",
    lineHeight:        22,
    paddingHorizontal: SPACING.lg,
  },

  statsRow: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.xl,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderWidth:       1,
    borderColor:       C.border,
    marginTop:         SPACING.sm,
  },
  stat: { alignItems: "center", flex: 1 },
  statValue: {
    color:      C.text,
    fontSize:   FONT_SIZE.xl,
    fontWeight: "800",
  },
  statLabel: {
    color:     C.textMuted,
    fontSize:  FONT_SIZE.xs,
    marginTop: 2,
  },
  statDivider: {
    width:           1,
    height:          28,
    backgroundColor: C.border,
  },

  // Follow button
  followBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               SPACING.xs,
    backgroundColor:   C.accent,
    borderRadius:      RADIUS.full,
    paddingVertical:   SPACING.sm + 2,
    paddingHorizontal: SPACING.xxl,
    marginTop:         SPACING.xs,
    minWidth:          140,
    minHeight:         40,
  },
  followingBtn: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
  },
  followBtnText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.base,
    fontWeight: "700",
  },
  followingBtnText: {
    color: C.text,
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

  // Catalog cards
  catalogCard: {
    flex: 1,
    gap:  SPACING.xs,
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
    alignItems: "center",
    paddingTop: SPACING.xxl,
    gap:        SPACING.sm,
  },
  emptyTitle: {
    color:      C.textMuted,
    fontSize:   FONT_SIZE.base,
    fontWeight: "600",
  },
});
