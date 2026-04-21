// src/hooks/useAuth.ts
// Hook central pentru autentificare.
// Gestionează sesiunea, profilul, loading states și toate acțiunile auth.

import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  sendPasswordReset,
  updatePassword,
  updateProfile as authUpdateProfile,
  isUsernameAvailable,
} from "../services/auth";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

export type Profile = {
  id:                   string;
  username:             string;
  full_name:            string | null;
  display_name:         string | null;
  avatar_url:           string | null;
  bio:                  string | null;
  interests:            string[];
  onboarding_completed: boolean;
  followers_count:      number;
  following_count:      number;
  catalogs_count:       number;
  is_guest:             boolean;
};

type UseAuthReturn = {
  user:             User | null;
  profile:          Profile | null;
  session:          Session | null;
  loading:          boolean;
  signingIn:        boolean;
  signingUp:        boolean;
  signingOut:       boolean;
  updatingProfile:  boolean;
  authError:        string | null;
  signIn:           (email: string, password: string) => Promise<boolean>;
  signUp:           (email: string, password: string, username: string) => Promise<boolean>;
  signOut:          () => Promise<void>;
  resetPassword:    (email: string) => Promise<boolean>;
  changePassword:   (newPassword: string) => Promise<boolean>;
  updateProfile:    (updates: Partial<Profile>) => Promise<boolean>;
  checkUsername:    (username: string) => Promise<boolean>;
  clearError:       () => void;
  refreshProfile:   () => Promise<void>;
};

/**
 * Centralizes authentication state and actions for the app and exposes them to components.
 *
 * Provides current auth state (user, profile, session, loading flags, and authError) and action callbacks
 * for signing in, signing up, signing out, password reset/change, profile updates, username checks,
 * and error management.
 *
 * @returns An object containing:
 * - `user`: the authenticated `User` or `null`
 * - `profile`: the app `Profile` for the current user or `null`
 * - `session`: the current `Session` or `null`
 * - `loading`: `true` while the initial session is being loaded, `false` afterwards
 * - `signingIn`, `signingUp`, `signingOut`, `updatingProfile`: operation-specific boolean flags
 * - `authError`: an error message string or `null`
 * - `signIn(email, password)`: attempts sign-in, returns `true` on success, `false` on failure
 * - `signUp(email, password, username)`: attempts sign-up, returns `true` on success, `false` on failure
 * - `signOut()`: signs the current user out
 * - `resetPassword(email)`: sends a password reset, returns `true` on success, `false` on failure
 * - `changePassword(newPassword)`: changes the current user's password, returns `true` on success, `false` on failure
 * - `updateProfile(updates)`: updates the current user's profile and local profile state, returns `true` on success, `false` on failure
 * - `checkUsername(username)`: returns `true` if the username is available, `false` otherwise
 * - `clearError()`: clears the current `authError`
 * - `refreshProfile()`: re-fetches the profile for the current user
 */

export function useAuth(): UseAuthReturn {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [loading,          setLoading]          = useState(true);
  const [signingIn,        setSigningIn]        = useState(false);
  const [signingUp,        setSigningUp]        = useState(false);
  const [signingOut,       setSigningOut]       = useState(false);
  const [updatingProfile,  setUpdatingProfile]  = useState(false);
  const [authError,        setAuthError]        = useState<string | null>(null);

  // ── Fetch profil ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) setProfile(data as Profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Init sesiune la pornire ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id);
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id);
        else setProfile(null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (
    email: string, password: string
  ): Promise<boolean> => {
    setSigningIn(true);
    setAuthError(null);
    const { error } = await authSignIn(email, password);
    if (error) { setAuthError(error); setSigningIn(false); return false; }
    setSigningIn(false);
    return true;
  }, []);

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string, password: string, username: string
  ): Promise<boolean> => {
    setSigningUp(true);
    setAuthError(null);

    const available = await isUsernameAvailable(username);
    if (!available) {
      setAuthError("Username-ul este deja folosit");
      setSigningUp(false);
      return false;
    }
    

    const { error } = await authSignUp(email, password, username);
    if (error) { setAuthError(error); setSigningUp(false); return false; }
    setSigningUp(false);
    return true;
  }, []);

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    setSigningOut(true);
    await authSignOut();
    setSigningOut(false);
  }, []);

  // ── Reset parolă ──────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    setAuthError(null);
    const { error } = await sendPasswordReset(email);
    if (error) { setAuthError(error); return false; }
    return true;
  }, []);

  // ── Schimbare parolă ──────────────────────────────────────────────────────
  const changePassword = useCallback(async (
    newPassword: string
  ): Promise<boolean> => {
    const { error } = await updatePassword(newPassword);
    if (error) { setAuthError(error); return false; }
    return true;
  }, []);

  // ── Update profil ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (
    updates: Partial<Profile>
  ): Promise<boolean> => {
    if (!user) return false;
    setUpdatingProfile(true);
    setAuthError(null);
    const { error } = await authUpdateProfile(updates as any);
    if (error) { setAuthError(error); setUpdatingProfile(false); return false; }
    setProfile((prev) => prev ? { ...prev, ...updates } : prev);
    setUpdatingProfile(false);
    return true;
  }, [user]);

  const checkUsername = useCallback(
    async (username: string): Promise<boolean> => {
      return await isUsernameAvailable(username);
    },
    []
  );

  const clearError = useCallback(() => setAuthError(null), []);

  return {
    user, profile, session,
    loading, signingIn, signingUp, signingOut, updatingProfile,
    authError,
    signIn, signUp, signOut,
    resetPassword, changePassword,
    updateProfile, checkUsername,
    clearError, refreshProfile,
  };
}