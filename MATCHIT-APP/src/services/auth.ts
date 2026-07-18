// src/services/auth.ts
// Toate funcțiile de autentificare: email, Google, Apple, guest, resetare parolă.
// Fiecare funcție returnează { data, error } — niciodată nu aruncă excepții.
//
// Dependențe:
//   npx expo install expo-auth-session expo-crypto expo-web-browser

import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";


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
 * Înregistrare cu email și parolă.
 * Trigger-ul `handle_new_user` din DB creează profilul automat.
 *
 * @param email     Adresa de email
 * @param password  Parola (minim 6 caractere)
 * @param username  Username dorit (trimis în metadata → folosit de trigger)
 *
 * @example
 * const { data, error } = await signUp("ion@exemplu.ro", "parola123", "ion_dev");
 * if (error) Alert.alert("Eroare", error);
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
 * Autentificare cu email și parolă.
 *
 * @example
 * const { data, error } = await signIn("ion@exemplu.ro", "parola123");
 * if (error) Alert.alert("Email sau parolă incorectă");
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
 * Deconectare — șterge sesiunea locală și din Supabase.
 */
export async function signOut(): Promise<AuthResponse<null>> {
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── RESETARE PAROLĂ ──────────────────────────────────────────────────────────

/**
 * Trimite email de resetare parolă.
 * Utilizatorul va primi un link care deschide aplicația prin deep link.
 *
 * @param email Adresa de email asociată contului
 *
 * @example
 * const { error } = await sendPasswordReset("ion@exemplu.ro");
 * if (!error) Alert.alert("Email trimis!", "Verifică inbox-ul.");
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
 * Actualizează parola după ce userul a accesat link-ul din email.
 * Apelat pe ecranul reset-password după ce sesiunea temporară e activă.
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
 * Actualizează câmpurile profilului utilizatorului curent.
 *
 * @example
 * await updateProfile({ display_name: "Ion Dev", bio: "Salut!" });
 */
export async function updateProfile(updates: {
  username?:             string;
  display_name?:         string | null;
  avatar_url?:           string | null;
  bio?:                  string | null;
  interests?:            string[];
  onboarding_completed?: boolean;
}): Promise<AuthResponse<null>> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { data: null, error: "Nu ești autentificat" };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Listener pentru schimbările de autentificare.
 * Returneaza funcția de cleanup — apeleaz-o în useEffect return.
 *
 * @example
 * useEffect(() => {
 *   const unsub = onAuthStateChange((session) => setSession(session));
 *   return unsub;
 * }, []);
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}