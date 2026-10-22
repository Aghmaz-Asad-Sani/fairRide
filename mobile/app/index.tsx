import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSession } from "../src/auth/SessionProvider";
import {
  fontFamilies,
  LoadingView,
  Screen,
  colors,
} from "../src/components/ui";

export default function WelcomeScreen() {
  const { user, isLoading } = useSession();
  const [showSplash, setShowSplash] = useState(true);
  const [splashScale] = useState(() => new Animated.Value(0.92));
  const [splashOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(
        user.phoneVerified
          ? user.role === "DRIVER"
            ? "/driver"
            : "/home"
          : "/otp",
      );
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (isLoading || user || !showSplash) return;

    const entrance = Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(splashScale, {
        toValue: 1,
        damping: 13,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    const timer = setTimeout(() => setShowSplash(false), 1500);

    return () => {
      entrance.stop();
      clearTimeout(timer);
    };
  }, [isLoading, user, showSplash, splashOpacity, splashScale]);

  if (isLoading) return <LoadingView />;
  if (user) return <LoadingView label="Opening your FairRide account…" />;

  if (showSplash) {
    return (
      <Screen style={styles.splashScreen}>
        <View style={styles.splashHalo} />
        <Animated.View
          style={[
            styles.splashContent,
            {
              opacity: splashOpacity,
              transform: [{ scale: splashScale }],
            },
          ]}
        >
          <View style={styles.splashLogoWrap}>
            <Image
              source={require("../assets/images/icon.png")}
              resizeMode="contain"
              style={styles.splashLogo}
              accessibilityLabel="FairRide car logo"
            />
          </View>
          <Text style={styles.splashBrand}>FairRide</Text>
          <Text style={styles.splashTagline}>A better way to move.</Text>
        </Animated.View>
        <View style={styles.splashFooter}>
          <View style={styles.routeDot} />
          <View style={styles.routeDash} />
          <View style={styles.routePin}>
            <Text style={styles.routePinText}>↗</Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandIconWrap}>
            <Image
              source={require("../assets/images/icon.png")}
              resizeMode="contain"
              style={styles.brandIcon}
            />
          </View>
          <View>
            <Text style={styles.brandName}>FairRide</Text>
            <Text style={styles.brandCaption}>PAKISTAN</Text>
          </View>
          <View style={styles.brandStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>YOUR CITY, YOUR WAY</Text>
          </View>
        </View>

        <View style={styles.artwork}>
          <View style={styles.artworkHalo} />
          <View style={styles.artworkOrbit} />
          <View style={styles.artworkBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.artworkBadgeText}>A RIDE THAT FITS</Text>
          </View>
          <Image
            source={require("../assets/images/onboarding3.png")}
            resizeMode="contain"
            style={styles.artworkImage}
            accessibilityLabel="FairRide car illustration"
          />
          <View style={styles.artworkPin}>
            <Image
              source={require("../assets/icons/point.png")}
              resizeMode="contain"
              style={styles.artworkPinIcon}
            />
          </View>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>GOOD TO GO?</Text>
          <Text style={styles.title}>
            Move through your day,{"\n"}your way.
          </Text>
          <Text style={styles.subtitle}>
            A smoother ride for you, and a fairer road for every driver.
          </Text>
        </View>

        <View style={styles.choices}>
          <RoleChoice
            title="I’m a passenger"
            detail="Find a ride around you"
            icon={require("../assets/icons/person.png")}
            passenger
            onPress={() =>
              router.push({
                pathname: "/onboarding",
                params: { role: "PASSENGER" },
              })
            }
          />
          <RoleChoice
            title="I’m a driver"
            detail="Drive, earn, and grow"
            icon={require("../assets/icons/target.png")}
            onPress={() =>
              router.push({
                pathname: "/onboarding",
                params: { role: "DRIVER" },
              })
            }
          />
        </View>

        <Text style={styles.footerText}>
          Choose your journey to get started
        </Text>
      </ScrollView>
    </Screen>
  );
}

function RoleChoice({
  title,
  detail,
  icon,
  passenger = false,
  onPress,
}: {
  title: string;
  detail: string;
  icon: number;
  passenger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        pressed && styles.choicePressed,
      ]}
    >
      <View
        style={[
          styles.choiceIconWrap,
          passenger ? styles.passengerIconWrap : styles.driverIconWrap,
        ]}
      >
        <Image source={icon} resizeMode="contain" style={styles.choiceIcon} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceDetail}>{detail}</Text>
      </View>
      <View
        style={[
          styles.choiceArrowWrap,
          passenger && styles.passengerArrowWrap,
        ]}
      >
        <Text
          style={[
            styles.choiceArrow,
            passenger && styles.passengerArrow,
          ]}
        >
          →
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 6,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  splashScreen: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  splashHalo: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#E8F3F8",
  },
  splashContent: { alignItems: "center" },
  splashLogoWrap: {
    width: 132,
    height: 132,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  splashLogo: { width: 112, height: 112 },
  splashBrand: {
    color: colors.ink,
    fontSize: 31,
    marginTop: 17,
    fontFamily: fontFamilies.extraBold,
  },
  splashTagline: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
    fontFamily: fontFamilies.medium,
  },
  splashFooter: {
    position: "absolute",
    bottom: 42,
    flexDirection: "row",
    alignItems: "center",
  },
  brandRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  brandIcon: { width: 30, height: 30 },
  brandName: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fontFamilies.extraBold,
  },
  brandCaption: {
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 1,
    fontFamily: fontFamilies.bold,
  },
  brandStatus: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  statusText: {
    color: colors.primary,
    fontSize: 8,
    letterSpacing: 0.7,
    fontFamily: fontFamilies.bold,
  },
  artwork: {
    height: 280,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkHalo: {
    position: "absolute",
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: "#EAF2FF",
  },
  artworkOrbit: {
    position: "absolute",
    width: 268,
    height: 268,
    borderRadius: 134,
    borderWidth: 1,
    borderColor: "#DCE7F8",
  },
  artworkImage: { width: "100%", height: "100%" },
  artworkBadge: {
    position: "absolute",
    zIndex: 2,
    top: 19,
    right: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  artworkBadgeText: {
    color: colors.ink,
    fontSize: 8,
    letterSpacing: 0.7,
    fontFamily: fontFamilies.bold,
  },
  artworkPin: {
    position: "absolute",
    left: 10,
    bottom: 27,
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  artworkPinIcon: {
    width: 19,
    height: 19,
    tintColor: colors.primary,
  },
  intro: {
    alignItems: "center",
    paddingHorizontal: 7,
    marginTop: -2,
    marginBottom: 16,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 9,
    letterSpacing: 1.8,
    fontFamily: fontFamilies.bold,
  },
  title: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 25,
    lineHeight: 31,
    marginTop: 6,
    fontFamily: fontFamilies.extraBold,
  },
  subtitle: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    maxWidth: 310,
    fontFamily: fontFamilies.regular,
  },
  choices: { gap: 9 },
  choice: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  choicePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  choiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  passengerIconWrap: { backgroundColor: "#D9F4EF" },
  driverIconWrap: { backgroundColor: "#FFF1D2" },
  choiceIcon: { width: 23, height: 23, tintColor: colors.ink },
  choiceCopy: { flex: 1, marginLeft: 11 },
  choiceTitle: {
    color: colors.ink,
    fontSize: 13,
    fontFamily: fontFamilies.bold,
  },
  choiceDetail: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
    fontFamily: fontFamilies.regular,
  },
  choiceArrowWrap: {
    width: 31,
    height: 31,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF6E3",
  },
  passengerArrowWrap: { backgroundColor: "#E8F3F8" },
  choiceArrow: {
    color: "#9A6409",
    fontSize: 17,
    fontFamily: fontFamilies.bold,
  },
  passengerArrow: { color: colors.primary },
  footerText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 9,
    marginTop: 13,
    fontFamily: fontFamilies.medium,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  routeDash: {
    width: 29,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: "#AAB5C4",
  },
  routePin: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  routePinText: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fontFamilies.bold,
  },
});
