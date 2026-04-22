import { router } from "expo-router";

/**
 * Goes back if there's a previous screen, otherwise falls back to the home tab.
 * Prevents the "GO_BACK not handled" error when a screen is opened as the root.
 */
export function goBack(fallback: string = "/(tabs)") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
