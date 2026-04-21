// src/app/(auth)/login.tsx
// Ecran de autentificare cu email și parolă.
// Folosește hook-ul useAuth care centralizează toată logica.

import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth }  from "../../hooks/useAuth";
import { Input }    from "../../components/common/Input";
import { Button }   from "../../components/common/Button";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Validare locală ──────────────────────────────────────────────────────────

type FormErrors = { email?: string; password?: string };

function validate(email: string, password: string): FormErrors {
  const e: FormErrors = {};
  if (!email.trim())            e.email    = "Emailul este obligatoriu";
  else if (!email.includes("@")) e.email   = "Email invalid";
  if (!password)                 e.password = "Parola este obligatorie";
  else if (password.length < 6)  e.password = "Minim 6 caractere";
  return e;
}

// ─── Ecran ────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signingIn, authError, clearError } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [errors,   setErrors]   = useState<FormErrors>({});

  const handleLogin = async () => {
    const validationErrors = validate(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const ok = await signIn(email, password);
    // Dacă ok === true, AuthGuard din _layout.tsx navighează automat la (tabs)
    // Dacă ok === false, authError e setat în hook și apare în UI
  };

  const clearFieldError = (field: keyof FormErrors) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons name="heart" size={28} color={COLORS.bg} />
          </View>
          <Text style={styles.brandName}>MatchIt</Text>
          <Text style={styles.brandTagline}>Swipe. Match. Decide.</Text>
        </View>

        {/* Formular */}
        <View style={styles.form}>
          {/* Eroare globală de la server */}
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
            onChangeText={(t) => { setEmail(t); clearFieldError("email"); clearError(); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
            error={errors.email}
            returnKeyType="next"
          />

          <Input
            label="Parolă"
            placeholder="••••••••"
            value={password}
            onChangeText={(t) => { setPassword(t); clearFieldError("password"); clearError(); }}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.password}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* Forgot password */}
          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Ai uitat parola?</Text>
          </Pressable>

          <Button
            label="Autentifică-te"
            onPress={handleLogin}
            loading={signingIn}
            disabled={signingIn}
            fullWidth
            leftIcon="log-in-outline"
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>sau</Text>
          <View style={styles.divider} />
        </View>

        {/* Link spre register */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Nu ai cont? </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.footerLink}>Creează-ți cont</Text>
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
    justifyContent:    "center",
    gap:               SPACING.md,
  },

  // Brand
  brand: {
    alignItems:   "center",
    marginBottom: SPACING.xl,
    gap:          SPACING.sm,
  },
  brandIcon: {
    width:           64,
    height:          64,
    borderRadius:    RADIUS.xl,
    backgroundColor: COLORS.accent,
    alignItems:      "center",
    justifyContent:  "center",
  },
  brandName: {
    color:         COLORS.accent,
    fontSize:      FONT_SIZE.huge,
    fontWeight:    "900",
    letterSpacing: -1,
  },
  brandTagline: {
    color:    COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },

  // Form
  form: { gap: SPACING.md },

  // Server error banner
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

  // Forgot
  forgotBtn:  { alignSelf: "flex-end" },
  forgotText: { color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: "600" },

  // Divider
  dividerRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.md,
    marginVertical: SPACING.sm,
  },
  divider:     { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  // Footer
  footer: {
    flexDirection:  "row",
    justifyContent: "center",
    marginTop:      SPACING.sm,
  },
  footerText: { color: COLORS.textMuted, fontSize: FONT_SIZE.base },
  footerLink: { color: COLORS.accent, fontSize: FONT_SIZE.base, fontWeight: "700" },
});