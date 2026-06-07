import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import { unfollowUser } from "../../services/social";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

type FollowedUser = {
  id:           string;
  username:     string;
  display_name: string | null;
  avatar_url:   string | null;
};

function UserRow({ user, onUnfollow }: { user: FollowedUser; onUnfollow: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const initials = (user.display_name ?? user.username).slice(0, 2).toUpperCase();

  const handleUnfollow = async () => {
    setBusy(true);
    await unfollowUser(user.id);
    onUnfollow(user.id);
    setBusy(false);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/user/${user.id}` as any)}
    >
      <View style={styles.avatar}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <Text style={styles.avatarInitials}>{initials}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {user.display_name ?? user.username}
        </Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      <Pressable style={styles.unfollowBtn} onPress={handleUnfollow} disabled={busy}>
        {busy
          ? <ActivityIndicator size="small" color={C.textMuted} />
          : <Text style={styles.unfollowText}>Unfollow</Text>
        }
      </Pressable>
    </Pressable>
  );
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const [users,      setUsers]      = useState<FollowedUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", session.user.id)
      .order("created_at", { ascending: false });

    const ids = (followRows ?? []).map((r: any) => r.following_id);
    if (!ids.length) { setUsers([]); setLoading(false); setRefreshing(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);

    const list: FollowedUser[] = (data ?? []) as FollowedUser[];

    setUsers(list);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeUser = (id: string) =>
    setUsers((prev) => prev.filter((u) => u.id !== id));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Following</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: SPACING.xxl }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={C.textMuted} />
              <Text style={styles.emptyTitle}>Not following anyone yet</Text>
              <Text style={styles.emptySubtitle}>
                Explore and follow users to see them here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <UserRow user={item} onUnfollow={removeUser} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.full,
    backgroundColor: C.surface,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "700",
  },

  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
  },

  row: {
    flexDirection: "row",
    alignItems:    "center",
    paddingVertical: SPACING.sm,
    gap:           SPACING.md,
  },
  avatar: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: C.accentDim,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },
  avatarImg:      { width: "100%", height: "100%" },
  avatarInitials: { color: C.bg, fontSize: FONT_SIZE.base, fontWeight: "800" },

  info: { flex: 1 },
  displayName: {
    color:      C.text,
    fontSize:   FONT_SIZE.base,
    fontWeight: "600",
  },
  username: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: 1,
  },

  unfollowBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.full,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
    minWidth:          80,
    alignItems:        "center",
  },
  unfollowText: {
    color:      C.textSecondary,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "600",
  },

  separator: {
    height:          1,
    backgroundColor: C.border,
  },

  empty: {
    alignItems:  "center",
    paddingTop:  SPACING.xxl * 2,
    gap:         SPACING.sm,
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
});
