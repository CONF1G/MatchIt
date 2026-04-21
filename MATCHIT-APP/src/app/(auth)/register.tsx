// src/app/(auth)/register.tsx
// Înregistrare cu email, parolă și username.
// Verificare disponibilitate username live (cu debounce).

import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth }  from "../../hooks/useAuth";
import { Input }    from "../../components/common/Input";
import { Button }   from "../../components/common/Button";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Validare ─────────────────────────────────────────────────────────────────

type FormErrors = {
  email?:           string;
  username?:        string;
  password?:        string;
  confirmPassword?: string;
};

/**
 * Validate registration form fields and return field-specific error messages.
 *
 * Performs these checks:
 * - `email` contains the `@` character
 * - `username` is at least 3 characters and matches `/^[a-z0-9_]+$/`
 * - `password` is at least 6 characters
 * - `password` equals `confirmPassword`
 *
 * @returns An object mapping field keys (`email`, `username`, `password`, `confirmPassword`) to their error message strings; empty when there are no validation failures.
 */
function validateForm(
  email: string, username: string,
  password: string, confirmPassword: string
): FormErrors {
  const e: FormErrors = {};
  if (!email.includes("@"))          e.email    = "Email invalid";
  if (username.length < 3)           e.username = "Minim 3 caractere";
  else if (!/^[a-z0-9_]+$/.test(username))
                                     e.username = "Doar litere mici, cifre și _";
  if (password.length < 6)           e.password = "Minim 6 caractere";
  if (password !== confirmPassword)  e.confirmPassword = "Parolele nu coincid";
  return e;
}

/**
 * Renders the registration screen with client-side validation, debounced live username availability checking, and submission via the app's auth hook.
 *
 * The screen manages form state (email, username, password, confirmPassword), displays field and server errors, shows username availability feedback while typing, and navigates to the login route after successful signup.
 *
 * @returns A React element that renders the registration UI.
 */

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { signUp, signingUp, authError, clearError, checkUsername } = useAuth();

  const [email,           setEmail]           = useState("");
  const [username,        setUsername]        = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors,          setErrors]          = useState<FormErrors>({});

  // Starea verificării username-ului
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Verificare username cu debounce ───────────────────────────────────────
  useEffect(() => {
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const available = await checkUsername(username);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const validationErrors = validateForm(email, username, password, confirmPassword);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (usernameAvailable === false) {
      setErrors({ username: "Username-ul este deja folosit" });
      return;
    }

    setErrors({});
    const ok = await signUp(email, password, username);

    if (ok) {
      Alert.alert(
        "Cont creat! 🎉",
        "Verifică-ți emailul pentru confirmare.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    }
  };

  const clearField = (field: keyof FormErrors) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  // ── Username hint text ────────────────────────────────────────────────────
  const getUsernameHint = () => {
    if (checkingUsername) return undefined;
    if (usernameAvailable === true)  return "✓ Username disponibil";
    if (usernameAvailable === false) return "✗ Username deja folosit";
    return undefined;
  };
  const usernameError = errors.username ||
    (usernameAvailable === false && !errors.username ? "Username deja folosit" : undefined);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
          <View>
            <Text style={styles.title}>Cont Nou</Text>
            <Text style={styles.subtitle}>Alătură-te comunității MatchIt</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>

          {/* Eroare globală */}
          {authError && (
            <View style={styles.serverError}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.serverErrorText}>{authError}</Text>
              <Pressable onPress={clearError} hitSlop={8}>
                <Ionicons name="close" size={16} color={COLORS.danger} />
              </Pressable>
            </View>
          )}

          <Input
            label="Email"
            placeholder="email@exemplu.com"
            value={email}
            onChangeText={(t) => { setEmail(t.toLowerCase()); clearField("email"); clearError(); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
            error={errors.email}
          />

          {/* Username cu indicator de disponibilitate */}
          <View>
            <Input
              label="Username"
              placeholder="ion_dev"
              value={username}
              onChangeText={(t) => {
                setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                clearField("username");
                clearError();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="at-outline"
              error={usernameError}
              hint={!usernameError ? getUsernameHint() : undefined}
              rightIcon={
                checkingUsername ? undefined :
                usernameAvailable === true ? "checkmark-circle" :
                usernameAvailable === false ? "close-circle" : undefined
              }
            />
            {checkingUsername && (
              <ActivityIndicator
                size="small"
                color={COLORS.accent}
                style={styles.usernameSpinner}
              />
            )}
          </View>

          <Input
            label="Parolă"
            placeholder="Minim 6 caractere"
            value={password}
            onChangeText={(t) => { setPassword(t); clearField("password"); }}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.password}
          />

          <Input
            label="Confirmă Parola"
            placeholder="Repetă parola"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); clearField("confirmPassword"); }}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.confirmPassword}
          />

          <Button
            label={signingUp ? "Se creează..." : "Creează Cont"}
            onPress={handleRegister}
            loading={signingUp}
            disabled={signingUp}
            fullWidth
            leftIcon="person-add-outline"
            style={{ marginTop: SPACING.sm }}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ai deja cont? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerLink}>Autentifică-te</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow:          1,
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.lg,
  },

  header: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           SPACING.md,
    paddingTop:    SPACING.sm,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems:      "center",
    justifyContent:  "center",
    marginTop:       4,
  },
  title: {
    color:      COLORS.text,
    fontSize:   FONT_SIZE.xxxl,
    fontWeight: "800",
  },
  subtitle: {
    color:    COLORS.textMuted,
    fontSize: FONT_SIZE.base,
    marginTop: 2,
  },

  form: { gap: SPACING.md },

  serverError: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.sm,
    backgroundColor: COLORS.dangerSubtle,
    borderRadius:    RADIUS.md,
    padding:         SPACING.sm + 2,
    borderWidth:     1,
    borderColor:     COLORS.danger + "40",
  },
  serverErrorText: {
    flex:     1,
    color:    COLORS.danger,
    fontSize: FONT_SIZE.sm,
  },

  usernameSpinner: {
    position:   "absolute",
    right:      SPACING.md,
    top:        "50%",
  },

  footer: {
    flexDirection:  "row",
    justifyContent: "center",
  },
  footerText: { color: COLORS.textMuted, fontSize: FONT_SIZE.base },
  footerLink: { color: COLORS.accent, fontSize: FONT_SIZE.base, fontWeight: "700" },
});