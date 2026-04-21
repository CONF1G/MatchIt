import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Layout that presents nested routes as modal screens with a vertical slide-up transition.
 *
 * The stack hides the header, uses `COLORS.bg` for the content background, sets `presentation` to `"modal"`,
 * uses the `"slide_from_bottom"` animation, and enables vertical gesture interactions.
 *
 * @returns A React element rendering an Expo Router `Stack` configured for modal presentation.
 */
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:      false,
        contentStyle:     { backgroundColor: COLORS.bg },
        presentation:     "modal",
        animation:        "slide_from_bottom",
        gestureEnabled:   true,
        gestureDirection: "vertical",
      }}
    />
  );
}
