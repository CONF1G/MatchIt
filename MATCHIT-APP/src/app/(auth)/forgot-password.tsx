// src/app/(auth)/forgot-password.tsx
// Trimite email de resetare parolă.

import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { goBack } from "../../services/navigation";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth }  from "../../hooks/useAuth";
import { Input }    from "../../components/common/Input";
import { Button }   from "../../components/common/Button";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSend = async () => {
    if (!email.includes("@")) { setError("Email invalid"); return; }
    setError(null);
    setLoading(true);

    const ok = await resetPassword(email);
    setLoading(false);

    if (ok) setSent(true);
    else    setError("Nu s-a putut trimite emailul. Verifică adresa.");
  };

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
      >
        {/* Back */}
        <Pressable onPress={() => goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        {!sent ? (
          <>
            {/* Header */}
            <View style={styles.section}>
              <View style={styles.iconBox}>
                <Ionicons name="key-outline" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.title}>Resetare Parolă</Text>
              <Text style={styles.subtitle}>
                Introdu emailul contului tău și îți trimitem un link de resetare.
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Input
                label="Email"
                placeholder="email@exemplu.com"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />

              <Button
                label="Trimite Link"
                onPress={handleSend}
                loading={loading}
                disabled={loading || !email.trim()}
                fullWidth
                leftIcon="paper-plane-outline"
              />
            </View>
          </>
        ) : (
          // Stare de succes
          <View style={styles.successState}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={40} color={COLORS.bg} />
            </View>
            <Text style={styles.successTitle}>Email trimis!</Text>
            <Text style={styles.successText}>
              Verifică inbox-ul pentru {email}.{"\n"}
              Link-ul expiră în 24 de ore.
            </Text>
            <Button
              label="Înapoi la Login"
              onPress={() => router.replace("/(auth)/login")}
              variant="secondary"
              fullWidth
              style={{ marginTop: SPACING.lg }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow:          1,
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.lg,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems:      "center",
    justifyContent:  "center",
  },
  section:  { gap: SPACING.sm },
  iconBox: {
    width:           60,
    height:          60,
    borderRadius:    RADIUS.xl,
    backgroundColor: COLORS.accentSubtle,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    SPACING.sm,
  },
  title: {
    color:      COLORS.text,
    fontSize:   FONT_SIZE.xxxl,
    fontWeight: "800",
  },
  subtitle: {
    color:      COLORS.textMuted,
    fontSize:   FONT_SIZE.base,
    lineHeight: 22,
  },
  form:       { gap: SPACING.md },
  errorBanner: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.sm,
    backgroundColor: COLORS.dangerSubtle,
    borderRadius:    RADIUS.md,
    padding:         SPACING.sm + 2,
    borderWidth:     1,
    borderColor:     COLORS.danger + "40",
  },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.sm, flex: 1 },

  // Succes
  successState: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingTop:     SPACING.xxl,
    gap:            SPACING.md,
  },
  successIcon: {
    width:           80,
    height:          80,
    borderRadius:    RADIUS.full,
    backgroundColor: COLORS.accent,
    alignItems:      "center",
    justifyContent:  "center",
  },
  successTitle: {
    color:      COLORS.text,
    fontSize:   FONT_SIZE.xxl,
    fontWeight: "800",
  },
  successText: {
    color:     COLORS.textMuted,
    fontSize:  FONT_SIZE.base,
    textAlign: "center",
    lineHeight: 22,
  },
});