// src/services/auth.ts
// Toate funcțiile de autentificare: email, Google, Apple, guest, resetare parolă.
// Fiecare funcție returnează { data, error } — niciodată nu aruncă excepții.
//
// Dependențe:
//   npx expo install expo-auth-session expo-crypto expo-web-browser

import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";


/**
 * Checks whether a username is available.
 *
 * The provided `username` is trimmed and lowercased before checking the `profiles` table.
 *
 * @param username - The username to check (will be normalized by trimming and converting to lowercase)
 * @returns `true` if no profile exists with the normalized username, `false` otherwise
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
 * Creates a new user account with the given email, password, and username and returns the authentication result.
 *
 * The username and a trimmed `full_name` are stored in the user's metadata (lowercased/trimmed) so a database trigger can create the corresponding profile.
 *
 * @param email - The user's email (will be trimmed and lowercased)
 * @param password - The user's password (minimum 6 characters)
 * @param username - Desired username (trimmed and lowercased; also stored in user metadata)
 * @returns An AuthResponse containing `{ user, session }` on success, or an error message string on failure.
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
 * Authenticate a user using email and password.
 *
 * @param email - The user's email; it will be trimmed and converted to lowercase before sending.
 * @returns An AuthResponse containing `{ user, session }` on success; otherwise `data` is `null` and `error` contains a message.
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
 * Signs out the current user and clears the local Supabase session.
 *
 * @returns An AuthResponse where `data` is `null`. `error` is `null` on success, or contains an error message on failure.
 */
export async function signOut(): Promise<AuthResponse<null>> {
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── RESETARE PAROLĂ ──────────────────────────────────────────────────────────

/**
 * Sends a password reset email that deep-links back into the app.
 *
 * The provided email is normalized (trimmed and lowercased) before sending.
 *
 * @param email - The account email to send the reset link to
 * @returns An object with `data` set to `null` and `error` containing an error message if the request failed, or `null` on success
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
 * Update the authenticated user's password as part of a password-reset flow (after the temporary session from the reset link is active).
 *
 * @param newPassword - The new password to set for the current user
 * @returns An AuthResponse with `data` set to `null` and `error` containing an error message if the update failed, or `null` if successful
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
 * Retrieve the current authenticated session, if any.
 *
 * @returns The current `Session`, or `null` if no session exists.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Retrieve the currently authenticated user.
 *
 * @returns `User` if a user is authenticated, `null` otherwise.
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
 * Update the current user's profile fields.
 *
 * @param updates - Object with optional profile fields to update: `username`, `display_name`, `avatar_url`, and `bio`
 * @returns An AuthResponse where `data` is `null` and `error` is an error message if the user is not authenticated or the update failed, or `null` on success
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
 * Registers an authentication state change listener and returns a cleanup function to unsubscribe it.
 *
 * @param callback - Called with the current `Session` or `null` when the authentication state changes.
 * @returns A function that unsubscribes the registered listener when invoked.
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}