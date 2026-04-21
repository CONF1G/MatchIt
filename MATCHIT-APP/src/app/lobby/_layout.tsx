import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Provides the lobby navigation layout as an Expo Router `Stack` configured for the lobby screens.
 *
 * The stack hides the native header, applies the app background color to screen content, and uses a slide-from-right transition.
 *
 * @returns A React element rendering the configured `Stack` for lobby routes.
 */
export default function LobbyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation:    "slide_from_right",
      }}
    />
  );
}
