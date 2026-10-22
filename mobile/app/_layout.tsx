import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../src/auth/SessionProvider";
import { colors, fontFamilies, LoadingView } from "../src/components/ui";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [fontFamilies.regular]: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    [fontFamilies.medium]: require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    [fontFamilies.semibold]: require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    [fontFamilies.bold]: require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    [fontFamilies.extraBold]: require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  if (!fontsLoaded) return <LoadingView label="Getting FairRide ready…" />;

  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="otp" options={{ title: "Verify your phone" }} />
        <Stack.Screen name="home" options={{ title: "FairRide" }} />
        <Stack.Screen name="ride" options={{ title: "Book a ride" }} />
        <Stack.Screen name="driver" options={{ title: "Driver space" }} />
        <Stack.Screen
          name="settings"
          options={{ title: "Connection settings" }}
        />
      </Stack>
    </SessionProvider>
  );
}
