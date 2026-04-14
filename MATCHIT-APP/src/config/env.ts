// src/config/env.ts
// Punct central de acces la variabilele de mediu.
//
// DE CE acest fișier?
// - Variabilele de mediu în Expo sunt string | undefined.
//   Dacă uiți să le setezi în .env, aplicația crapă cu erori greu de depanat.
// - Acest fișier validează la pornire că toate variabilele necesare există
//   și aruncă o eroare clară dacă lipsesc.
// - Importând din env.ts ai autocompletion și tipuri — nu mai scrii
//   process.env.EXPO_PUBLIC_... de mână.
//
// UTILIZARE:
//   import { ENV } from "../config/env";
//   const client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

// ─── Tipul variabilelor de mediu ──────────────────────────────────────────────

type EnvConfig = {
  // Supabase — OBLIGATORII
  SUPABASE_URL:      string;
  SUPABASE_ANON_KEY: string;

  // Aplicație
  APP_ENV:    "development" | "staging" | "production";
  APP_SCHEME: string;

  // Opționale — nu aruncă eroare dacă lipsesc
  SENTRY_DSN:           string | undefined;
  POSTHOG_KEY:          string | undefined;
  AI_TAGGING_API_URL:   string | undefined;
};

// ─── Funcție helper internă ───────────────────────────────────────────────────

/**
 * Read an environment variable and return its trimmed value, throwing if it is missing or empty.
 *
 * @param key - Logical variable name (without the `EXPO_PUBLIC_` prefix); used for context in error messages
 * @param envKey - Exact key to read from `process.env`
 * @returns The trimmed environment variable value
 * @throws Error if `process.env[envKey]` is missing or an empty string after trimming
 */
function requireEnv(key: string, envKey: string): string {
  const value = process.env[envKey];
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Variabila de mediu "${envKey}" lipsește sau este goală.\n` +
      `Adaug-o în fișierul .env:\n  ${envKey}=valoarea_ta\n` +
      `Vezi .env.example pentru toate variabilele necesare.`
    );
  }
  return value.trim();
}

/**
 * Reads an environment variable and returns its trimmed value or `undefined` if it is missing or empty.
 *
 * @param envKey - The name of the environment variable to read from `process.env`
 * @returns The trimmed value of the environment variable, or `undefined` when the variable is not set or is empty after trimming
 */
function optionalEnv(envKey: string): string | undefined {
  const value = process.env[envKey];
  return value?.trim() || undefined;
}

/**
 * Normalize a raw environment string into the app's canonical environment tag.
 *
 * @param value - The raw APP_ENV-like value (e.g. process.env.EXPO_PUBLIC_APP_ENV)
 * @returns One of `"development"`, `"staging"`, or `"production"`. Returns `"development"` when `value` is `undefined` or not recognized.
 */

function parseAppEnv(value: string | undefined): EnvConfig["APP_ENV"] {
  if (value === "staging")    return "staging";
  if (value === "production") return "production";
  return "development"; // fallback sigur
}

// ─── Obiectul ENV exportat ────────────────────────────────────────────────────
// Toate validările rulează O SINGURĂ DATĂ la importul modulului.
// Dacă o variabilă obligatorie lipsește, aplicația nu pornește și arată
// exact care variabilă trebuie adăugată.

export const ENV: EnvConfig = {
  // ── Supabase ───────────────────────────────────────────────────────────────
  SUPABASE_URL: requireEnv(
    "SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_URL"
  ),
  SUPABASE_ANON_KEY: requireEnv(
    "SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  ),

  // ── Aplicație ──────────────────────────────────────────────────────────────
  APP_ENV:    parseAppEnv(process.env.EXPO_PUBLIC_APP_ENV),
  APP_SCHEME: optionalEnv("EXPO_PUBLIC_APP_SCHEME") ?? "matchit",

  // ── Servicii opționale ────────────────────────────────────────────────────
  SENTRY_DSN:         optionalEnv("EXPO_PUBLIC_SENTRY_DSN"),
  POSTHOG_KEY:        optionalEnv("EXPO_PUBLIC_POSTHOG_KEY"),
  AI_TAGGING_API_URL: optionalEnv("EXPO_PUBLIC_AI_TAGGING_API_URL"),
} as const;

// ─── Helpers derivate ─────────────────────────────────────────────────────────

export const isDev        = ENV.APP_ENV === "development";
export const isStaging    = ENV.APP_ENV === "staging";
export const isProduction = ENV.APP_ENV === "production";

// ─── Log la pornire (doar în development) ────────────────────────────────────
// Util pentru a verifica rapid ce configurație e activă

if (isDev) {
  console.log(
    "[env] ✓ Variabile încărcate:",
    `\n  SUPABASE_URL      = ${ENV.SUPABASE_URL}`,
    `\n  APP_ENV           = ${ENV.APP_ENV}`,
    `\n  SENTRY_DSN        = ${ENV.SENTRY_DSN ?? "(nedefinit)"}`,
    `\n  AI_TAGGING_URL    = ${ENV.AI_TAGGING_API_URL ?? "(nedefinit)"}`,
  );
}