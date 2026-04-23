// src/services/supabase.ts
// Client Supabase configurat cu valorile validate din env.ts.
// Importă `supabase` din acest fișier în toată aplicația.

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, AppState } from "react-native";

import { ENV } from "../config/env";

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error("Missing Supabase Env Variables. Check your .env file!");
}

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    // Web uses the browser's native localStorage (supports Web Locks API).
    // Native uses AsyncStorage since there's no localStorage.
    storage:            Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// AppState listener is only relevant on native — the browser handles visibility itself.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
