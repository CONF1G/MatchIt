// src/services/auth.ts
// Toate funcțiile de autentificare: email, Google, Apple, guest, resetare parolă.
// Fiecare funcție returnează { data, error } — niciodată nu aruncă excepții.
//
// Dependențe:
//   npx expo install expo-auth-session expo-crypto expo-web-browser

import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";


/**
 * Checks whether a username is available in the `profiles` table.
 *
 * The input `username` is normalized by trimming whitespace and converting to lowercase before lookup.
 *
 * @param username - The username to check (will be normalized with `trim()` and `toLowerCase()`)
 * @returns `true` if the normalized username does not exist in the `profiles` table, `false` otherwise.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();

  return data === null; // null înseamnă că nu există → disponibil
}

// ─── Tipuri ───────────────────────────────────────────────────────────────────

export type AuthResponse<T = { user: User; session: Session }> = {
  data:  T | null;
  error: string | null;
};

// ─── EMAIL / PAROLĂ ───────────────────────────────────────────────────────────

/**
 * Create a new user account using an email and password.
 *
 * A database trigger (`handle_new_user`) will create the corresponding profile using the provided metadata.
 *
 * @param email - Email address; will be normalized with `trim()` and `toLowerCase()`
 * @param password - Password (minimum 6 characters)
 * @param username - Desired username; will be normalized and stored in the user's metadata (`username` and `full_name`) for the profile trigger
 * @returns An AuthResponse whose `data` contains `{ user, session }` on success, or `null` with an error message in `error`
 */
export async function signUp(
  email:    string,
  password: string,
  username: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({
    email:    email.trim().toLowerCase(),
    password,
    options: {
      data: {
        // Aceste câmpuri ajung în raw_user_meta_data
        // și sunt citite de trigger-ul handle_new_user
        username:  username.trim().toLowerCase(),
        full_name: username.trim(),
      },
    },
  });

  if (error) return { data: null, error: error.message };
  if (!data.user) return { data: null, error: "Nu s-a putut crea contul" };

  return {
    data: { user: data.user, session: data.session! },
    error: null,
  };
}

/**
 * Sign in using an email and password.
 *
 * @returns An AuthResponse where `data` contains `{ user, session }` on success and `null` on failure; `error` contains an error message or `null`.
 */
export async function signIn(
  email:    string,
  password: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email:    email.trim().toLowerCase(),
    password,
  });

  if (error) {
    // Mesaj prietenos pentru eroarea comună
    const msg = error.message.includes("Invalid login credentials")
      ? "Email sau parolă incorectă"
      : error.message;
    return { data: null, error: msg };
  }

  return {
    data: { user: data.user, session: data.session },
    error: null,
  };
}

/**
 * Signs the current user out by ending the local session and the Supabase session.
 *
 * @returns An AuthResponse with `data` set to `null` and `error` containing the Supabase error message if sign-out failed, or `null` on success.
 */
export async function signOut(): Promise<AuthResponse<null>> {
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── RESETARE PAROLĂ ──────────────────────────────────────────────────────────

/**
 * Send a password reset email that includes a deep link to open the app.
 *
 * @param email - The account email address
 * @returns An object with `data: null` and `error` set to the error message if sending failed, or `error: null` on success
 */
export async function sendPasswordReset(
  email: string
): Promise<AuthResponse<null>> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      // Deep link-ul la care redirecționează emailul
      // Trebuie configurat în Supabase Dashboard → Authentication → URL Configuration
      redirectTo: "matchit://auth/reset-password",
    }
  );

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Update the authenticated user's password after the temporary session from a password-reset email is active.
 *
 * @param newPassword - The new password to set for the current user
 * @returns An AuthResponse with `data` set to `null`; `error` contains the error message if the update failed, or `null` on success
 */
export async function updatePassword(
  newPassword: string
): Promise<AuthResponse<null>> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── SESIUNE CURENTĂ ─────────────────────────────────────────────────────────

/**
 * Retrieves the locally persisted authentication session.
 *
 * @returns The current `Session` if one is stored, `null` otherwise.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Retrieve the currently authenticated user.
 *
 * @returns The authenticated `User`, or `null` if no user is signed in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── VERIFICARE USERNAME ──────────────────────────────────────────────────────

/**
 * Verifică dacă un username este disponibil (nu există deja în DB).
 * Apelat live în formularul de înregistrare.
 *
 * @example
 * const available = await isUsernameAvailable("ion_dev");
 * if (!available) setError("Username deja folosit");
 */

// ─── ACTUALIZARE PROFIL ───────────────────────────────────────────────────────

/**
 * Updates the current authenticated user's profile fields.
 *
 * @param updates - Partial profile fields to update; may include `username`, `display_name`, `avatar_url`, and `bio`
 * @returns An AuthResponse with `data` set to `null` and `error` containing an error message if the update failed, or `null` on success
 */
export async function updateProfile(updates: {
  username?:     string;
  display_name?: string;
  avatar_url?:   string;
  bio?:          string;
}): Promise<AuthResponse<null>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Nu ești autentificat" };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Subscribe to authentication state changes and invoke `callback` with the updated session.
 *
 * @param callback - Called with the current `Session` or `null` whenever the auth state changes
 * @returns A function that unsubscribes the listener when called
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}