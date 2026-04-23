import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, Share, Alert, ActivityIndicator,
  TextInput, Clipboard,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "../../utils/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

type Params = {
  matchId?:    string;
  inviteCode?: string;
};

type Friend = {
  id:           string;
  username:     string;
  display_name: string | null;
  avatar_url:   string | null;
};

export default function InviteFriendsModal() {
  const insets = useSafeAreaInsets();
  const { matchId, inviteCode } = useLocalSearchParams<Params>();

  const [friends,   setFriends]   = useState<Friend[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState("");
  const [copied,    setCopied]    = useState(false);
  const [matchCode, setMatchCode] = useState(inviteCode ?? "");

  // Load invite code if only matchId provided
  useEffect(() => {
    (async () => {
      if (!matchCode && matchId) {
        const { data } = await supabase
          .from("lobbies")
          .select("invite_code")
          .eq("id", matchId)
          .single();
        if (data?.invite_code) setMatchCode(data.invite_code);
      }
    })();
  }, [matchId]);

  // Load friends (users the current user follows)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("follows")
        .select("following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
        .eq("follower_id", user.id)
        .limit(50);

      if (data) {
        setFriends(
          data
            .map((row: any) => row.profiles)
            .filter(Boolean) as Friend[]
        );
      }
      setLoading(false);
    })();
  }, []);

  const filteredFriends = query.trim()
    ? friends.filter((f) =>
        f.username.toLowerCase().includes(query.toLowerCase()) ||
        (f.display_name ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : friends;

  const handleCopyCode = () => {
    if (!matchCode) return;
    Clipboard.setString(matchCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (!matchCode) return;
    try {
      await Share.share({
        message: `Join my MatchIt session!\nCode: ${matchCode}\nmatchit://guest/join/${matchCode}`,
        title:   "Join MatchIt",
      });
    } catch { /* ignore */ }
  };

  const shareToFriend = async (friend: Friend) => {
    if (!matchCode) {
      Alert.alert("No active match", "Start a match first to invite friends.");
      return;
    }
    try {
      await Share.share({
        message: `Hey @${friend.username}, join my MatchIt session!\nCode: ${matchCode}\nmatchit://guest/join/${matchCode}`,
        title:   `Invite ${friend.display_name ?? friend.username}`,
      });
    } catch { /* ignore */ }
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable style={styles.closeBtn} onPress={() => goBack()}>
          <Ionicons name="close" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Invite code card */}
      {matchCode ? (
        <View style={styles.codeCard}>
          <View style={styles.codeCardLeft}>
            <Text style={styles.codeLabel}>Invite Code</Text>
            <Text style={styles.codeValue}>{matchCode}</Text>
          </View>
          <View style={styles.codeActions}>
            <Pressable
              style={[styles.codeBtn, copied && styles.codeBtnCopied]}
              onPress={handleCopyCode}
            >
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={16}
                color={copied ? C.success : C.accent}
              />
              <Text style={[styles.codeBtnText, copied && { color: C.success }]}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </Pressable>

            <Pressable style={[styles.codeBtn, styles.codeBtnShare]} onPress={handleShareLink}>
              <Ionicons name="share-outline" size={16} color={C.bg} />
              <Text style={[styles.codeBtnText, { color: C.bg }]}>Share</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.noCodeBanner}>
          <Ionicons name="information-circle-outline" size={16} color={C.info} />
          <Text style={styles.noCodeText}>
            Start a match first to generate an invite code.
          </Text>
        </View>
      )}

      {/* Friends list */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Your Friends</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={C.textMuted} />
            <Text style={styles.emptyTitle}>
              {query ? "No results" : "No friends yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? "Try a different search"
                : "Follow people to see them here"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: SPACING.sm, paddingTop: SPACING.sm }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.friendRow}>
                <View style={styles.avatar}>
                  {item.avatar_url ? (
                    <Image
                      source={{ uri: item.avatar_url }}
                      style={styles.avatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {item.username.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>
                    {item.display_name ?? item.username}
                  </Text>
                  <Text style={styles.friendUsername}>@{item.username}</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.inviteBtn,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => shareToFriend(item)}
                >
                  <Ionicons name="paper-plane-outline" size={14} color={C.accent} />
                  <Text style={styles.inviteBtnText}>Invite</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { paddingVertical: SPACING.xl, alignItems: "center" },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom:     SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
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

  // Invite code
  codeCard: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    margin:            SPACING.lg,
    padding:           SPACING.lg,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.xl,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  codeCardLeft: { gap: 4 },
  codeLabel: {
    color:         C.textMuted,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  codeValue: {
    color:         C.accent,
    fontSize:      FONT_SIZE.xxl,
    fontWeight:    "900",
    letterSpacing: 6,
  },
  codeActions: { flexDirection: "column", gap: SPACING.sm },
  codeBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   C.accentSubtle,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  codeBtnCopied: {
    backgroundColor: C.successSubtle,
    borderColor:     C.success + "40",
  },
  codeBtnShare: {
    backgroundColor: C.accent,
    borderColor:     C.accent,
  },
  codeBtnText: {
    color:      C.accent,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "700",
  },

  noCodeBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               SPACING.sm,
    margin:            SPACING.lg,
    padding:           SPACING.md,
    backgroundColor:   C.infoSubtle,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       C.info + "40",
  },
  noCodeText: {
    flex:     1,
    color:    C.info,
    fontSize: FONT_SIZE.sm,
  },

  listSection: {
    flex:              1,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.sm,
  },
  sectionTitle: {
    color:         C.text,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom:  SPACING.sm,
  },

  searchBar: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               SPACING.sm,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    marginBottom:      SPACING.xs,
  },
  searchInput: {
    flex:     1,
    color:    C.text,
    fontSize: FONT_SIZE.base,
    padding:  0,
  },

  friendRow: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     C.border,
    gap:             SPACING.md,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.accentDim,
    overflow:        "hidden",
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarImg:      { width: "100%", height: "100%" },
  avatarInitials: { color: C.bg, fontSize: FONT_SIZE.md, fontWeight: "800" },
  friendInfo:  { flex: 1 },
  friendName:  { color: C.text,    fontSize: FONT_SIZE.base, fontWeight: "600" },
  friendUsername: { color: C.textMuted, fontSize: FONT_SIZE.xs, marginTop: 1 },

  inviteBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   C.accentSubtle,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  inviteBtnText: {
    color:      C.accent,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "700",
  },

  empty: {
    alignItems:     "center",
    paddingVertical: SPACING.xxl,
    gap:            SPACING.sm,
  },
  emptyTitle:    { color: C.text,    fontSize: FONT_SIZE.lg,  fontWeight: "700" },
  emptySubtitle: { color: C.textMuted, fontSize: FONT_SIZE.sm, textAlign: "center" },
});
