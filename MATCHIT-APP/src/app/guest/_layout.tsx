import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Layout component for guest routes that configures navigation appearance and transitions.
 *
 * Renders an Expo Router `Stack` configured to hide the header, set the screen background to `COLORS.bg`, and use the "fade_from_bottom" transition.
 *
 * @returns A React element representing the configured `Stack` layout for guest screens.
 */
export default function GuestLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation:    "fade_from_bottom",
      }}
    />
  );
}
