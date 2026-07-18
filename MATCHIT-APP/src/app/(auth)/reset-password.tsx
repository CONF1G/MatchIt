import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth }  from "../../hooks/useAuth";
import { Input }    from "../../components/common/Input";
import { Button }   from "../../components/common/Button";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { changePassword, authError, clearError } = useAuth();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = () => {
    if (password.length < 6) return "Parola trebuie să aibă minim 6 caractere";
    if (password !== confirm) return "Parolele nu se potrivesc";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    clearError();
    setLoading(true);
    const ok = await changePassword(password);
    setLoading(false);
    if (ok) setDone(true);
  };

  const error = localError ?? authError;

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
        {/* Back button — only shown when coming from profile */}
        {from === "profile" && (
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
        )}

        {!done ? (
          <>
            <View style={styles.section}>
              <View style={styles.iconBox}>
                <Ionicons name="lock-closed-outline" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.title}>Parolă Nouă</Text>
              <Text style={styles.subtitle}>
                Alege o parolă nouă sigură pentru contul tău.
              </Text>
            </View>

            <View style={styles.form}>
              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Input
                label="Parolă Nouă"
                placeholder="minim 6 caractere"
                value={password}
                onChangeText={(t) => { setPassword(t); setLocalError(null); }}
                secureTextEntry
                leftIcon="lock-closed-outline"
              />

              <Input
                label="Confirmă Parola"
                placeholder="repetă parola"
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setLocalError(null); }}
                secureTextEntry
                leftIcon="lock-closed-outline"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <Button
                label="Salvează Parola"
                onPress={handleSave}
                loading={loading}
                disabled={loading || !password || !confirm}
                fullWidth
                leftIcon="checkmark-outline"
              />
            </View>
          </>
        ) : (
          <View style={styles.successState}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={40} color={COLORS.bg} />
            </View>
            <Text style={styles.successTitle}>Parolă actualizată!</Text>
            <Text style={styles.successText}>
              Parola ta a fost schimbată cu succes.
            </Text>
            <Button
              label={from === "profile" ? "Înapoi la Profil" : "Înapoi la Login"}
              onPress={() =>
                from === "profile"
                  ? router.replace("/(tabs)/profile" as any)
                  : router.replace("/(auth)/login")
              }
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
  form:        { gap: SPACING.md },
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
    color:      COLORS.textMuted,
    fontSize:   FONT_SIZE.base,
    textAlign:  "center",
    lineHeight: 22,
  },
});
