// src/config/constants.ts
// Constante globale ale aplicației.
// Orice valoare care apare în mai multe locuri sau care s-ar putea schimba
// cu lansarea unei noi versiuni aparține aici.

import { Dimensions, Platform } from "react-native";

// ─── DIMENSIUNI ECRAN ────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const SCREEN = {
  WIDTH:  SCREEN_WIDTH,
  HEIGHT: SCREEN_HEIGHT,
  IS_SMALL: SCREEN_WIDTH < 375,   // iPhone SE și telefoane mici
  IS_LARGE: SCREEN_WIDTH >= 414,  // iPhone Plus / Pro Max
} as const;

// ─── APLICAȚIE ───────────────────────────────────────────────────────────────

export const APP = {
  NAME:        "MatchIt",
  VERSION:     "1.0.0",
  BUNDLE_ID:   "com.matchit.app",
  SCHEME:      "matchit",          // deep link: matchit://lobby/abc123
  WEBSITE_URL: "https://matchit.app",
  SUPPORT_EMAIL: "support@matchit.app",
} as const;

// ─── SUPABASE / API ───────────────────────────────────────────────────────────

export const API = {
  // Număr de rezultate returnate per pagină (paginare)
  PAGE_SIZE:           20,
  PAGE_SIZE_SEARCH:    20,
  PAGE_SIZE_FEED:      30,
  PAGE_SIZE_NOTIF:     50,

  // Timeout pentru request-uri (ms)
  TIMEOUT_MS:         10_000,

  // Storage buckets (numele trebuie să coincidă cu cele create în Supabase)
  BUCKET_AVATARS:      "avatars",
  BUCKET_CATALOG:      "catalog-photos",
  BUCKET_THUMBNAILS:   "thumbnails",
} as const;

// ─── LOBBY / JOC ─────────────────────────────────────────────────────────────

export const LOBBY = {
  MIN_PLAYERS:          2,
  MAX_PLAYERS:          8,
  DEFAULT_MAX_PLAYERS:  8,

  // Cât timp (ms) așteptăm înainte să marcăm un jucător ca inactiv
  INACTIVITY_TIMEOUT_MS: 30_000,

  // Moduri de joc disponibile — trebuie să coincidă cu enum-ul din DB
  MODES: ["first_match", "deck", "tournament"] as const,
  DEFAULT_MODE: "first_match" as const,

  // Statusuri lobby — coincid cu enum-ul `lobby_status` din DB
  STATUS: {
    WAITING:     "waiting",
    IN_PROGRESS: "in_progress",
    FINISHED:    "finished",
    CANCELLED:   "cancelled",
  } as const,
} as const;

// ─── SWIPE ────────────────────────────────────────────────────────────────────

export const SWIPE = {
  // Distanța minimă (px) pentru a înregistra un swipe
  THRESHOLD:           SCREEN_WIDTH * 0.25,

  // Viteza minimă (px/ms) pentru a înregistra un swipe rapid
  VELOCITY_THRESHOLD:  0.3,

  // Câte carduri sunt pre-randate în stack deasupra celui curent
  PREFETCH_COUNT:      3,

  // Rotația maximă (grade) a cardului în timp ce e tras
  MAX_ROTATION_DEG:    15,

  // Acțiuni posibile — trebuie să coincidă cu enum-ul `swipe_action` din DB
  ACTIONS: {
    LIKE:       "like",
    DISLIKE:    "dislike",
    SUPER_LIKE: "super_like",
  } as const,
} as const;

// ─── VALIDĂRI ────────────────────────────────────────────────────────────────

export const VALIDATION = {
  USERNAME_MIN:    3,
  USERNAME_MAX:    30,
  USERNAME_REGEX:  /^[a-z0-9_]+$/,  // doar litere mici, cifre și underscore

  PASSWORD_MIN:    6,
  PASSWORD_MAX:   72,                // limita bcrypt

  BIO_MAX:        160,
  CATALOG_TITLE_MIN:  2,
  CATALOG_TITLE_MAX: 60,
  COMMENT_MAX:    1_000,

  // Dimensiuni maxime fișiere upload
  AVATAR_MAX_BYTES:        2 * 1024 * 1024,    // 2 MB
  CATALOG_PHOTO_MAX_BYTES: 10 * 1024 * 1024,   // 10 MB

  // Tipuri de fișier acceptate pentru upload
  ACCEPTED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

// ─── NAVIGAȚIE ───────────────────────────────────────────────────────────────

export const ROUTES = {
  // Auth
  LOGIN:            "/(auth)/login",
  REGISTER:         "/(auth)/register",
  FORGOT_PASSWORD:  "/(auth)/forgot-password",
  ONBOARDING:       "/(auth)/onboarding",

  // Tabs
  HOME:             "/(tabs)",
  SEARCH:           "/(tabs)/search",
  CREATE:           "/(tabs)/create",
  NOTIFICATIONS:    "/(tabs)/notifications",
  PROFILE:          "/(tabs)/profile",

  // Modals
  CREATE_CATALOG:   "/(modals)/create-catalog",
  CREATE_LOBBY:     "/(modals)/create-lobby",
  INVITE_FRIENDS:   "/(modals)/invite-friends",

  // Dinamice — folosite cu router.push({ pathname, params })
  CATALOG:          "/catalog/[id]",
  LOBBY:            "/lobby/[id]",
  LOBBY_SWIPE:      "/lobby/swipe",
  LOBBY_RESULTS:    "/lobby/results",
  USER_PROFILE:     "/user/[id]",
  GUEST_JOIN:       "/guest/join/[code]",
} as const;

// ─── NOTIFICĂRI ──────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
  LOBBY_INVITE:  "lobby_invite",
  LOBBY_STARTED: "lobby_started",
  MATCH_RESULT:  "match_result",
  NEW_FOLLOWER:  "new_follower",
  CATALOG_LIKE:  "catalog_like",
  COMMENT:       "comment",
  SYSTEM:        "system",
} as const;

// ─── STORAGE KEYS (AsyncStorage) ─────────────────────────────────────────────
// Chei pentru datele stocate local pe dispozitiv

export const STORAGE_KEYS = {
  // Supabase gestionează sesiunea intern, dar poți adăuga chei custom
  ONBOARDING_DONE:  "@matchit/onboarding_done",
  LAST_SEEN_NOTIF:  "@matchit/last_seen_notif",
  PREFERRED_MODE:   "@matchit/preferred_lobby_mode",
  DRAFT_CATALOG:    "@matchit/draft_catalog",
} as const;

// ─── PLATFORMĂ ───────────────────────────────────────────────────────────────

export const IS_IOS     = Platform.OS === "ios";
export const IS_ANDROID = Platform.OS === "android";
export const IS_WEB     = Platform.OS === "web";