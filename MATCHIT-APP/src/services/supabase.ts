// src/services/supabase.ts
// Client Supabase configurat cu valorile validate din env.ts.
// Importă `supabase` din acest fișier în toată aplicația.

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { ENV } from "../config/env";

// Dacă ENV.SUPABASE_URL sau ENV.SUPABASE_ANON_KEY lipsesc,
// env.ts aruncă o eroare clară înainte să ajungem aici.
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error("Missing Supabase Env Variables. Check your .env file!");
}
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage:         AsyncStorage, // persistă sesiunea între reporniri
    autoRefreshToken: true,
    persistSession:  true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});