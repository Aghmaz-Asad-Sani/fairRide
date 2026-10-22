import { useEffect } from "react";
import { Link, router } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "../src/auth/SessionProvider";
import {
  Button,
  Card,
  LoadingView,
  Screen,
  colors,
  fontFamilies,
  uiStyles,
} from "../src/components/ui";

export default function HomeScreen() {
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
    else if (!isLoading && user && !user.phoneVerified) router.replace("/otp");
  }, [isLoading, user]);

  if (isLoading || !user || !user.phoneVerified) return <LoadingView />;

  const isPassenger = user.role === "PASSENGER";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text
              style={[
                styles.role,
                { color: isPassenger ? colors.teal : colors.gold },
              ]}
            >
              {isPassenger ? "PASSENGER" : "DRIVER PARTNER"}
            </Text>
            <Text style={styles.greeting}>Hi, {user.name.split(" ")[0]}.</Text>
            <Text style={styles.heroSubtitle}>
              {isPassenger
                ? "Where will today take you?"
                : "Your next trip starts here."}
            </Text>
          </View>
          <Image
            source={
              isPassenger
                ? require("../assets/images/onboarding1.png")
                : require("../assets/images/onboarding3.png")
            }
            resizeMode="contain"
            style={styles.heroImage}
            accessibilityLabel={
              isPassenger ? "Passenger ride illustration" : "Driver car"
            }
          />
        </View>
        <Card>
          <Text style={uiStyles.sectionTitle}>
            {isPassenger
              ? "Ready when you are"
              : "Get your driver profile ready"}
          </Text>
          <Text style={[uiStyles.body, { marginTop: 6, marginBottom: 14 }]}>
            {isPassenger
              ? "Get a fare estimate and request a nearby driver in a few steps."
              : "Add your driving licence and vehicle details. Once reviewed, you can go online and receive ride offers."}
          </Text>
          <Link href={isPassenger ? "/ride" : "/driver"} asChild>
            <Button
              title={isPassenger ? "Plan a ride" : "Continue driver setup"}
              onPress={() => undefined}
            />
          </Link>
        </Card>
        {!isPassenger ? (
          <Card>
            <Text style={uiStyles.sectionTitle}>Driver approval</Text>
            <Text style={[uiStyles.body, { marginTop: 6 }]}>
              FairRide reviews driver and vehicle details before enabling
              availability. This preview collects document details only; image
              uploads are not connected yet.
            </Text>
          </Card>
        ) : null}
        <Link href="/settings" asChild>
          <Button
            secondary
            title="Connection and account settings"
            onPress={() => undefined}
          />
        </Link>
        <Text style={[uiStyles.small, { textAlign: "center", marginTop: 10 }]}>
          FairRide development app · Online payments and live maps are not
          enabled yet
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 150,
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  heroCopy: { flex: 1, zIndex: 1 },
  role: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 9,
  },
  greeting: {
    color: colors.white,
    fontFamily: fontFamilies.extraBold,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#D0D8E5",
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 170,
  },
  heroImage: {
    width: 145,
    height: 125,
    marginRight: -16,
    marginLeft: -18,
  },
});
