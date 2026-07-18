import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LogoImg from "../../../assets/logo2.png";
import { COLORS, FONT_SIZE, RADIUS } from "../../config/theme";

const C = COLORS;

function MatchButton({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.matchBtn, focused && styles.matchBtnActive]}>
      <Image
        source={LogoImg}
        style={styles.matchLogo}
        contentFit="contain"
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // ── Tab bar ──────────────────────────────────────────────────────
        tabBarStyle: {
          backgroundColor:  C.surface,
          borderTopWidth:   1,
          borderTopColor:   C.border,
          height:           56 + insets.bottom,
          paddingBottom:    insets.bottom,
          paddingTop:       8,
          elevation:        0,
          shadowOpacity:    0,
        },
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarShowLabel:         false,

        // ── Header ───────────────────────────────────────────────────────
        headerStyle: {
          backgroundColor: C.bg,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor:  C.text,
        headerTitleStyle: {
          color:      C.text,
          fontSize:   FONT_SIZE.lg,
          fontWeight: "800",
          letterSpacing: -0.3,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "MatchIt",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="matchLobby"
        options={{
          title: "Match Lobby",
          tabBarIcon: ({ focused }: { focused: boolean }) => <MatchButton focused={focused} />,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: "Upload",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "add-circle" : "add-circle-outline"}
              size={26}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={23}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  matchBtn: {
    width:           80,
    height:          80,
    borderRadius:    RADIUS.full,
    backgroundColor: C.surfaceHigh,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1.5,
    borderColor:     C.border,
    marginBottom:    12,
    overflow:        "hidden",
  },
  matchBtnActive: {
    backgroundColor: C.accentSubtle,
    borderColor:     C.borderAccent,
  },
  matchLogo: {
    width:  1204,
    height: 120,
  },
});
