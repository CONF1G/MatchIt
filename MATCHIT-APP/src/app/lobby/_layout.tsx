import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Layout component that provides a navigation stack for lobby screens with the app background and slide-from-right transitions.
 *
 * @returns A `Stack` navigator with the header hidden, `contentStyle` background set to `COLORS.bg`, and the `slide_from_right` transition animation.
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
