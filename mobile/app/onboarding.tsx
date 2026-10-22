import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Button,
  LoadingView,
  Screen,
  colors,
  fontFamilies,
} from "../src/components/ui";

type Role = "PASSENGER" | "DRIVER";

const passengerSlides = [
  {
    eyebrow: "A BETTER WAY TO GET AROUND",
    title: "The city, a little closer.",
    body: "Set your pickup and destination, then see your fare before you request.",
    image: require("../assets/images/onboarding1.png"),
  },
  {
    eyebrow: "A RIDE THAT FITS",
    title: "Choose your ride.",
    body: "Request a car, bike or rickshaw, with nearby eligible drivers matched to your pickup.",
    image: require("../assets/images/onboarding2.png"),
  },
  {
    eyebrow: "READY WHEN YOU ARE",
    title: "Your next trip starts here.",
    body: "Create your passenger account, verify your phone, and plan your first ride.",
    image: require("../assets/images/onboarding3.png"),
  },
];

const driverSlides = [
  {
    eyebrow: "WELCOME, DRIVER PARTNER",
    title: "Your road. Your earning.",
    body: "Drive with FairRide and manage your availability on your schedule.",
    image: require("../assets/images/onboarding3.png"),
  },
  {
    eyebrow: "CHOOSE YOUR VEHICLE",
    title: "Car, bike or rickshaw.",
    body: "Add your vehicle details and documents so our team can review your application.",
    image: require("../assets/images/onboarding2.png"),
  },
  {
    eyebrow: "VERIFIED BEFORE RIDES",
    title: "Get approved. Go online.",
    body: "Once your driver profile and vehicle are approved, eligible ride offers can reach you nearby.",
    image: require("../assets/images/onboarding1.png"),
  },
];

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role: Role = params.role === "DRIVER" ? "DRIVER" : "PASSENGER";
  const slides = role === "DRIVER" ? driverSlides : passengerSlides;
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = slides[activeIndex];

  if (!slide) return <LoadingView />;

  function finish() {
    router.replace({
      pathname: "/auth",
      params: { role, mode: "register" },
    });
  }

  function advance() {
    if (activeIndex === slides.length - 1) finish();
    else setActiveIndex((current) => current + 1);
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to account type selection"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View
          style={[
            styles.roleBadge,
            role === "DRIVER" && styles.driverBadge,
          ]}
        >
          <Text
            style={[
              styles.roleBadgeText,
              role === "DRIVER" && styles.driverBadgeText,
            ]}
          >
            {role === "DRIVER" ? "DRIVER" : "PASSENGER"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={finish}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.artwork}>
        <View style={styles.artworkHalo} />
        <View style={styles.artworkOrbit} />
        <Image
          key={`${role}-${activeIndex}`}
          source={slide.image as ImageSourcePropType}
          resizeMode="contain"
          style={styles.artworkImage}
          accessibilityLabel={`${role.toLowerCase()} onboarding illustration`}
        />
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.eyebrow,
            role === "DRIVER" && styles.driverEyebrow,
          ]}
        >
          {slide.eyebrow}
        </Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.pagination}>
          {slides.map((item, index) => (
            <View
              key={item.eyebrow}
              style={[
                styles.paginationDot,
                index === activeIndex && styles.paginationDotActive,
                index === activeIndex &&
                  role === "DRIVER" &&
                  styles.paginationDriver,
              ]}
            />
          ))}
        </View>
        <Button
          title={
            activeIndex === slides.length - 1
              ? role === "DRIVER"
                ? "Start driver signup"
                : "Get started"
              : "Continue"
          }
          onPress={advance}
          style={[
            styles.primaryButton,
            role === "DRIVER" && styles.driverButton,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({
              pathname: "/auth",
              params: { role, mode: "login" },
            })
          }
          style={styles.loginLink}
        >
          <Text style={styles.loginText}>
            Already have an account?{" "}
            <Text style={styles.loginTextStrong}>Sign in</Text>
          </Text>
        </Pressable>
        <Text style={styles.footer}>
          {role === "DRIVER"
            ? "Vehicle and driver approval required before receiving ride offers."
            : "Your fare is estimated before you request a ride."}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 23,
    paddingTop: 10,
    paddingBottom: 15,
  },
  topBar: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  backText: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    marginTop: -3,
    fontFamily: fontFamilies.medium,
  },
  roleBadge: {
    backgroundColor: "#E8F3F8",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  driverBadge: { backgroundColor: "#FFF1D2" },
  roleBadgeText: {
    color: colors.primary,
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: fontFamilies.bold,
  },
  driverBadgeText: { color: "#8A5B06" },
  skipButton: { padding: 9 },
  skipText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
  },
  artwork: {
    flex: 1,
    minHeight: 220,
    maxHeight: 370,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkHalo: {
    position: "absolute",
    width: 244,
    height: 244,
    maxWidth: "82%",
    maxHeight: "82%",
    borderRadius: 140,
    backgroundColor: "#EAF2FF",
  },
  artworkOrbit: {
    position: "absolute",
    width: 288,
    height: 288,
    maxWidth: "96%",
    maxHeight: "96%",
    borderRadius: 160,
    borderWidth: 1,
    borderColor: "#DCE7F8",
  },
  artworkImage: { width: "100%", height: "100%" },
  copy: { alignItems: "center", paddingHorizontal: 7, paddingTop: 15 },
  eyebrow: {
    color: colors.primary,
    fontSize: 9,
    letterSpacing: 1.6,
    textAlign: "center",
    fontFamily: fontFamilies.bold,
  },
  driverEyebrow: { color: "#A36A00" },
  title: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
    marginTop: 8,
    fontFamily: fontFamilies.extraBold,
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 310,
    fontFamily: fontFamilies.regular,
  },
  bottom: { paddingTop: 18 },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginBottom: 16,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D6DEE9",
  },
  paginationDotActive: { width: 23, backgroundColor: colors.primary },
  paginationDriver: { backgroundColor: "#D2972C" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    marginBottom: 0,
  },
  driverButton: { backgroundColor: "#A36A00" },
  footer: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 10,
    fontFamily: fontFamilies.regular,
  },
  loginLink: { alignItems: "center", paddingTop: 12, paddingBottom: 5 },
  loginText: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: fontFamilies.regular,
  },
  loginTextStrong: {
    color: colors.primary,
    fontFamily: fontFamilies.bold,
  },
});
