import { useEffect, useState } from "react";
import { Slot, useRouter, Href } from "expo-router";
import {
  View, Text, Pressable, ScrollView,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "../../config/theme";
import { supabase } from "../../services/supabase";
import { fetchUserCatalogs } from "../../services/catalog";
import LogoImg from "../../../assets/logo2.png";

const C = COLORS;

type CatalogItem = { id: string; title: string; cover_url?: string | null };

export default function WebLayout() {
  const router = useRouter();

  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [catalogs,       setCatalogs]       = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [userName,       setUserName]       = useState("");
  const [userInitials,   setUserInitials]   = useState("?");
  const [activeNav,      setActiveNav]      = useState<string>("/");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setCatalogLoading(false); return; }

      const display =
        user.user_metadata?.display_name ??
        user.user_metadata?.username ??
        user.email?.split("@")[0] ?? "User";
      setUserName(display);
      setUserInitials(display.slice(0, 2).toUpperCase());

      const { data } = await fetchUserCatalogs(user.id, true);
      setCatalogs(
        (data ?? []).map((c: any) => ({
          id:        c.id,
          title:     c.title ?? "Untitled",
          cover_url: c.cover_url ?? null,
        }))
      );
      setCatalogLoading(false);
    })();
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.replace("/(auth)/login" as Href);
  };

  const navTo = (href: string) => {
    setActiveNav(href);
    router.push(href as Href);
  };

  return (
    <View style={styles.root}>

      {/* ── TOP NAV ─────────────────────────────────────────────────────── */}
      <View style={styles.navbar}>

        {/* Logo */}
        <Pressable
          onPress={() => navTo("/")}
          style={({ pressed }) => [styles.logoBtn, pressed && { opacity: 0.7 }]}
        >
          <Image source={LogoImg} style={styles.logo} contentFit="contain" />
          <Text style={styles.logoText}>MatchIt</Text>
        </Pressable>

        {/* Spacer pushes actions to the right */}
        <View style={{ flex: 1 }} />

        {/* Right: quick actions + profile */}
        <View style={styles.navRight}>
          <Pressable
            style={({ pressed }) => [styles.navActionBtn, pressed && { opacity: 0.7 }]}
            onPress={() => navTo("/(modals)/create-catalog")}
          >
            <Ionicons name="add" size={16} color={C.text} />
            <Text style={styles.navActionText}>New Catalog</Text>
          </Pressable>

          {/* Profile */}
          <View style={styles.profileArea}>
            <Pressable
              onPress={() => setDropdownOpen((v) => !v)}
              style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
            </Pressable>

            {dropdownOpen && (
              <View style={styles.dropdown}>
                <Text style={styles.dropdownName} numberOfLines={1}>{userName}</Text>
                <View style={styles.dropdownDivider} />
                <DropdownItem icon="person-outline"          label="View Profile"   onPress={() => { setDropdownOpen(false); navTo("/(tabs)/profile"); }} />
                <DropdownItem icon="albums-outline"          label="My Catalogs"    onPress={() => { setDropdownOpen(false); navTo("/(tabs)/profile"); }} />
                <DropdownItem icon="game-controller-outline" label="Create Match"   onPress={() => { setDropdownOpen(false); navTo("/(modals)/create-lobby"); }} />
                <View style={styles.dropdownDivider} />
                <DropdownItem icon="log-out-outline"         label="Sign Out" danger onPress={handleSignOut} />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <View style={styles.body}>

        {/* Sidebar */}
        <View style={styles.sidebar}>
          <View style={{ gap: 2, padding: 8 }}>
            <SidebarItem icon="home-outline"            label="Home"   href="/"           active={activeNav === "/"}           onPress={() => navTo("/")} />
            <SidebarItem icon="search-outline"          label="Search" href="/search"     active={activeNav === "/search"}     onPress={() => navTo("/(tabs)/search")} />
            <SidebarItem icon="game-controller-outline" label="Match"  href="/matchLobby" active={activeNav === "/matchLobby"} onPress={() => navTo("/(tabs)/matchLobby")} />
            <SidebarItem icon="cloud-upload-outline"    label="Upload" href="/post"       active={activeNav === "/post"}       onPress={() => navTo("/post")} />
          </View>

          <View style={styles.sidebarDivider} />

          <Text style={styles.sidebarLabel}>MY CATALOGS</Text>

          {catalogLoading ? (
            <ActivityIndicator size="small" color={C.accent} style={{ margin: SPACING.md }} />
          ) : catalogs.length === 0 ? (
            <Text style={styles.sidebarEmpty}>No catalogs yet</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {catalogs.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => router.push(`/catalog/${cat.id}` as Href)}
                  style={({ pressed }) => [styles.catalogRow, pressed && { backgroundColor: C.surfaceHigh }]}
                >
                  <View style={styles.catalogThumb}>
                    {cat.cover_url ? (
                      <Image source={{ uri: cat.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Ionicons name="images-outline" size={12} color={C.textMuted} />
                    )}
                  </View>
                  <Text style={styles.catalogName} numberOfLines={1}>{cat.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Main content — centered with max-width */}
        <View style={styles.contentOuter}>
          {dropdownOpen && (
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setDropdownOpen(false)} />
          )}
          <View style={styles.contentInner}>
            <Slot />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DropdownItem({ icon, label, onPress, danger = false }: {
  icon: any; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: C.surfaceHigh }]}
    >
      <Ionicons name={icon} size={14} color={danger ? C.danger : C.textSecondary} />
      <Text style={[styles.dropdownLabel, danger && { color: C.danger }]}>{label}</Text>
    </Pressable>
  );
}

function SidebarItem({ icon, label, active, onPress }: {
  icon: any; label: string; href: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sidebarItem,
        active && styles.sidebarItemActive,
        pressed && !active && { backgroundColor: C.surfaceHigh },
      ]}
    >
      <Ionicons name={icon} size={17} color={active ? C.accent : C.textSecondary} />
      <Text style={[styles.sidebarItemLabel, active && { color: C.accent, fontWeight: "700" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SIDEBAR_W = 200;
const NAV_H     = 46;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Navbar
  navbar: {
    height:            NAV_H,
    backgroundColor:   C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 20,
    gap:               12,
    zIndex:            100,
  },
  logoBtn: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           7,
    marginRight:   4,
    flexShrink:    0,
  },
  logo:     { width: 22, height: 22 },
  logoText: { color: C.text, fontSize: FONT_SIZE.md, fontWeight: "900", letterSpacing: -0.3 },

  navRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    flexShrink:    0,
  },
  navActionBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       C.border,
    backgroundColor:   C.surfaceHigh,
  },
  navActionText: { color: C.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: "600" },

  // Profile
  profileArea: { position: "relative" },
  profileBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius:    RADIUS.md,
    backgroundColor: C.surfaceHigh,
    borderWidth:     1,
    borderColor:     C.border,
  },
  avatar: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: C.accentDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarText: { color: C.textInverse, fontSize: 10, fontWeight: "800" },

  dropdown: {
    position:        "absolute",
    top:             36,
    right:           0,
    width:           188,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     C.border,
    paddingVertical: SPACING.xs,
    zIndex:          200,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.35,
    shadowRadius:    12,
    elevation:       12,
  },
  dropdownName: {
    color:             C.textMuted,
    fontSize:          FONT_SIZE.xs,
    fontWeight:        "600",
    paddingHorizontal: 12,
    paddingVertical:   6,
    letterSpacing:     0.3,
  },
  dropdownItem: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  dropdownLabel:   { color: C.text, fontSize: FONT_SIZE.sm },
  dropdownDivider: { height: 1, backgroundColor: C.border, marginVertical: 2 },

  // Body
  body: { flex: 1, flexDirection: "row", overflow: "hidden" },

  // Sidebar
  sidebar: {
    width:            SIDEBAR_W,
    backgroundColor:  C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingTop:       SPACING.sm,
    flexShrink:       0,
  },
  sidebarItem: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius:    RADIUS.md,
  },
  sidebarItemActive: {
    backgroundColor: C.accentSubtle,
  },
  sidebarItemLabel: {
    color:     C.textSecondary,
    fontSize:  FONT_SIZE.sm,
    fontWeight: "500",
  },
  sidebarDivider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  SPACING.sm,
    marginHorizontal: 8,
  },
  sidebarLabel: {
    color:             C.textMuted,
    fontSize:          10,
    fontWeight:        "700",
    letterSpacing:     1.1,
    paddingHorizontal: 12,
    marginBottom:      4,
    textTransform:     "uppercase",
  } as any,
  sidebarEmpty: {
    color:             C.textMuted,
    fontSize:          FONT_SIZE.xs,
    paddingHorizontal: 12,
    fontStyle:         "italic",
  },
  catalogRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 8,
    paddingVertical:   5,
    borderRadius:      RADIUS.sm,
    marginHorizontal:  4,
    marginBottom:      1,
  },
  catalogThumb: {
    width:           26,
    height:          26,
    borderRadius:    4,
    backgroundColor: C.surfaceHigh,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
    flexShrink:      0,
  },
  catalogName: {
    flex:       1,
    color:      C.textSecondary,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "500",
  },

  // Content
  contentOuter: {
    flex:            1,
    backgroundColor: C.bg,
    overflow:        "hidden",
  },
  contentInner: {
    flex: 1,
  },
});
