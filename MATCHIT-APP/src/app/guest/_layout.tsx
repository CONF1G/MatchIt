import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Layout component that provides a guest navigation stack with no header and the app's themed background.
 *
 * @returns A configured `Stack` component with `headerShown: false`, `contentStyle` background set to `COLORS.bg`, and `animation` set to `"fade_from_bottom"`.
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
