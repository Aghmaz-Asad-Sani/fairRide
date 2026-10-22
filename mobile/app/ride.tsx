import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  apiPost,
  ApiError,
  CreatedRide,
  FareEstimate,
} from "../src/api/client";
import { useSession } from "../src/auth/SessionProvider";
import {
  Button,
  Card,
  Field,
  Heading,
  LoadingView,
  Notice,
  Screen,
  colors,
  fontFamilies,
  uiStyles,
} from "../src/components/ui";

type VehicleCategory = "ECONOMY" | "COMFORT" | "XL";
type VehicleType = "CAR" | "BIKE" | "RICKSHAW";

interface RideInput {
  pickupLatitude: number;
  pickupLongitude: number;
  pickupLabel: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationLabel: string;
  vehicleCategory: VehicleCategory;
  vehicleType: VehicleType;
}

const categories: VehicleCategory[] = ["ECONOMY", "COMFORT", "XL"];
const vehicleTypes: {
  type: VehicleType;
  title: string;
  icon: string;
  detail: string;
}[] = [
  { type: "CAR", title: "Car", icon: "🚘", detail: "Everyday comfort" },
  { type: "BIKE", title: "Bike", icon: "🏍", detail: "Quick & nimble" },
  { type: "RICKSHAW", title: "Rickshaw", icon: "🛺", detail: "Local trips" },
];

function coordinates(latitude: string, longitude: string) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lon) ||
    lon < -180 ||
    lon > 180
  ) {
    throw new Error("Enter valid latitude and longitude coordinates.");
  }
  return { latitude: lat, longitude: lon };
}

export default function RideScreen() {
  const { user, isLoading } = useSession();
  const [pickupLabel, setPickupLabel] = useState("Karachi pickup");
  const [pickupLatitude, setPickupLatitude] = useState("24.8607");
  const [pickupLongitude, setPickupLongitude] = useState("67.0011");
  const [destinationLabel, setDestinationLabel] = useState(
    "Karachi destination",
  );
  const [destinationLatitude, setDestinationLatitude] = useState("24.8733");
  const [destinationLongitude, setDestinationLongitude] = useState("67.0290");
  const [category, setCategory] = useState<VehicleCategory>("ECONOMY");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [created, setCreated] = useState<CreatedRide | null>(null);
  const [busy, setBusy] = useState<"estimate" | "ride" | null>(null);
  const [error, setError] = useState("");
  const [matchingPulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
    else if (!isLoading && user && !user.phoneVerified) router.replace("/otp");
    else if (!isLoading && user?.role !== "PASSENGER") router.replace("/home");
  }, [isLoading, user]);

  useEffect(() => {
    if (busy !== "ride") {
      matchingPulse.stopAnimation();
      matchingPulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(matchingPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(matchingPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [busy, matchingPulse]);

  if (isLoading || !user || !user.phoneVerified || user.role !== "PASSENGER") {
    return <LoadingView />;
  }

  function getInput(): RideInput {
    const pickup = coordinates(pickupLatitude, pickupLongitude);
    const destination = coordinates(destinationLatitude, destinationLongitude);
    if (!pickupLabel.trim() || !destinationLabel.trim()) {
      throw new Error("Enter a label for both pickup and destination.");
    }
    return {
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      pickupLabel: pickupLabel.trim(),
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
      destinationLabel: destinationLabel.trim(),
      vehicleCategory: vehicleType === "CAR" ? category : "ECONOMY",
      vehicleType,
    };
  }

  async function requestEstimate() {
    setError("");
    setCreated(null);
    setEstimate(null);
    setBusy("estimate");
    try {
      const input = getInput();
      const result = await apiPost<FareEstimate>("/pricing/estimate", {
        pickupLatitude: input.pickupLatitude,
        pickupLongitude: input.pickupLongitude,
        destinationLatitude: input.destinationLatitude,
        destinationLongitude: input.destinationLongitude,
        vehicleCategory: input.vehicleCategory,
        vehicleType: input.vehicleType,
      });
      setEstimate(result);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Could not calculate a fare estimate.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function requestRide() {
    setError("");
    setCreated(null);
    setBusy("ride");
    try {
      const input = getInput();
      const idempotencyKey = `mobile-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 14)}`;
      const result = await apiPost<CreatedRide>("/rides", input, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      setCreated(result);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Could not request your ride.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Modal
        animationType="fade"
        transparent
        visible={busy === "ride" || created !== null}
        onRequestClose={() => {
          if (busy !== "ride") setCreated(null);
        }}
      >
        <View style={styles.modalScrim}>
          <View style={styles.matchCard}>
            {busy === "ride" ? (
              <>
                <View style={styles.matchGraphic}>
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        opacity: matchingPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.42, 0],
                        }),
                        transform: [
                          {
                            scale: matchingPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.72, 1.9],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <View style={styles.matchMarker}>
                    <Image
                      source={require("../assets/icons/point.png")}
                      style={styles.matchMarkerIcon}
                    />
                  </View>
                  <View style={styles.matchCar}>
                    <Image
                      source={require("../assets/images/onboarding3.png")}
                      resizeMode="contain"
                      style={styles.matchCarImage}
                    />
                  </View>
                </View>
                <Text style={styles.matchEyebrow}>FAIRRIDE MATCHING</Text>
                <Text style={styles.matchTitle}>Finding your ride</Text>
                <Text style={styles.matchBody}>
                  Sending your request to nearby drivers. Keep this screen open
                  while we check availability.
                </Text>
                <View style={styles.matchProgress}>
                  <View style={styles.matchProgressFill} />
                </View>
                <Text style={styles.matchFootnote}>
                  Your request is being sent securely
                </Text>
              </>
            ) : created?.noDriversAvailable ? (
              <>
                <View style={[styles.resultIcon, styles.resultIconWarning]}>
                  <Text style={styles.resultIconText}>!</Text>
                </View>
                <Text style={styles.matchEyebrow}>RIDE UPDATE</Text>
                <Text style={styles.matchTitle}>No nearby drivers yet</Text>
                <Text style={styles.matchBody}>
                  We couldn’t find an eligible driver for this request. Your
                  ride request has expired; adjust your pickup or try again
                  later.
                </Text>
                <RouteSummary
                  pickup={pickupLabel}
                  destination={destinationLabel}
                />
                <Button
                  title="Back to ride details"
                  onPress={() => setCreated(null)}
                  style={styles.modalButton}
                />
              </>
            ) : (
              <>
                <View style={styles.resultIcon}>
                  <Text style={styles.resultIconText}>✓</Text>
                </View>
                <Text style={styles.matchEyebrow}>REQUEST SENT</Text>
                <Text style={styles.matchTitle}>Request sent to drivers</Text>
                <Text style={styles.matchBody}>
                  Your request has been shared with {created?.offersCreated}{" "}
                  nearby driver
                  {created?.offersCreated === 1 ? "" : "s"}. Driver acceptance
                  and live tracking are not shown in this preview yet.
                </Text>
                <RouteSummary
                  pickup={pickupLabel}
                  destination={destinationLabel}
                />
                <View style={styles.pinCard}>
                  <Text style={styles.pinLabel}>PICKUP PIN</Text>
                  <Text style={styles.pinValue}>{created?.pickupPin}</Text>
                  <Text style={styles.pinHint}>
                    Share this with your driver at pickup.
                  </Text>
                </View>
                <Button
                  title="Done"
                  onPress={() => setCreated(null)}
                  style={styles.modalButton}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 26 }}
      >
        <Heading
          title="Where to?"
          subtitle="Choose a vehicle and route. We’ll look for approved drivers within 4 km."
        />
        {error ? <Notice message={error} error /> : null}
        <Card>
          <View style={styles.routeTimeline}>
            <View style={styles.timelineMarkers}>
              <View style={styles.pickupMarker} />
              <View style={styles.timelineDash} />
              <View style={styles.destinationMarker}>
                <Image
                  source={require("../assets/icons/to.png")}
                  style={styles.destinationMarkerIcon}
                />
              </View>
            </View>
            <View style={styles.routeFields}>
              <Field
                label="PICK-UP"
                value={pickupLabel}
                onChangeText={(value) => {
                  setPickupLabel(value);
                  setEstimate(null);
                }}
              />
              <View style={styles.fieldDivider} />
              <Field
                label="DESTINATION"
                value={destinationLabel}
                onChangeText={(value) => {
                  setDestinationLabel(value);
                  setEstimate(null);
                }}
              />
            </View>
          </View>
          <View style={styles.locationNote}>
            <Text style={styles.locationNoteText}>
              Location pins are currently entered as coordinates below.
            </Text>
          </View>
          <View style={uiStyles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label="Latitude"
                keyboardType="decimal-pad"
                value={pickupLatitude}
                onChangeText={(value) => {
                  setPickupLatitude(value);
                  setEstimate(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Longitude"
                keyboardType="decimal-pad"
                value={pickupLongitude}
                onChangeText={(value) => {
                  setPickupLongitude(value);
                  setEstimate(null);
                }}
              />
            </View>
          </View>
          <View style={uiStyles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label="Latitude"
                keyboardType="decimal-pad"
                value={destinationLatitude}
                onChangeText={(value) => {
                  setDestinationLatitude(value);
                  setEstimate(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Longitude"
                keyboardType="decimal-pad"
                value={destinationLongitude}
                onChangeText={(value) => {
                  setDestinationLongitude(value);
                  setEstimate(null);
                }}
              />
            </View>
          </View>
          <Text style={[uiStyles.sectionTitle, { marginBottom: 9 }]}>
            Choose a vehicle
          </Text>
          <View style={styles.categoryRow}>
            {vehicleTypes.map((item) => {
              const selected = vehicleType === item.type;
              return (
                <Pressable
                  key={item.type}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setVehicleType(item.type);
                    setEstimate(null);
                  }}
                  style={[
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                  ]}
                >
                  <Text style={styles.vehicleTypeIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.categoryText,
                      selected && styles.categoryTextSelected,
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.categoryMeta,
                      selected && styles.categoryTextSelected,
                    ]}
                  >
                    {item.detail}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {vehicleType === "CAR" ? (
            <>
              <Text style={[uiStyles.sectionTitle, { marginTop: 12, marginBottom: 9 }]}>
                Car class
              </Text>
          <View style={styles.categoryRow}>
            {categories.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
                onPress={() => {
                  setCategory(item);
                  setEstimate(null);
                }}
                style={[
                  styles.categoryChip,
                  category === item && styles.categoryChipSelected,
                ]}
              >
                <Image
                  source={require("../assets/images/onboarding3.png")}
                  resizeMode="contain"
                  style={styles.categoryCar}
                />
                <Text
                  style={[
                    styles.categoryText,
                    category === item && styles.categoryTextSelected,
                  ]}
                >
                  {item}
                </Text>
                <Text
                  style={[
                    styles.categoryMeta,
                    category === item && styles.categoryTextSelected,
                  ]}
                >
                  {item === "ECONOMY"
                    ? "Everyday"
                    : item === "COMFORT"
                      ? "Extra comfort"
                      : "More space"}
                </Text>
              </Pressable>
            ))}
          </View>
            </>
          ) : (
            <Text style={[uiStyles.small, { marginTop: 10, marginBottom: 4 }]}>
              {vehicleType === "BIKE"
                ? "Bike rides use the standard fare class."
                : "Rickshaw rides use the standard fare class."}
            </Text>
          )}
        </Card>
        {estimate ? (
          <Card>
            <Text style={uiStyles.sectionTitle}>Server fare estimate</Text>
            <Text style={[uiStyles.amount, { marginTop: 5 }]}>
              PKR {(estimate.passengerTotalPaisa / 100).toFixed(2)}
            </Text>
            <Text style={[uiStyles.body, { marginTop: 5 }]}>
              {(estimate.distanceMeters / 1000).toFixed(1)} km ·{" "}
              {Math.max(1, Math.round(estimate.durationSeconds / 60))} min ·{" "}
              {estimate.routeSource}
            </Text>
            <Text style={[uiStyles.small, { marginTop: 5 }]}>
              Estimate only; current rides are cash-only.
            </Text>
          </Card>
        ) : null}
        <Button
          title="Get fare estimate"
          secondary
          onPress={requestEstimate}
          busy={busy === "estimate"}
          disabled={busy !== null}
        />
        <Button
          title="Request ride"
          onPress={requestRide}
          busy={busy === "ride"}
          disabled={Boolean(!estimate || busy)}
        />
        <Text style={[uiStyles.small, { color: colors.muted }]}>
          Routing may use a development approximation until a production OSRM
          service is configured. Coordinates entered here are sent to your
          backend to calculate the estimate and match drivers.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function RouteSummary({
  pickup,
  destination,
}: {
  pickup: string;
  destination: string;
}) {
  return (
    <View style={styles.routeSummary}>
      <View style={styles.summaryMarkers}>
        <View style={styles.summaryPickupMarker} />
        <View style={styles.summaryDash} />
        <View style={styles.summaryDestinationMarker} />
      </View>
      <View style={styles.summaryLabels}>
        <Text numberOfLines={1} style={styles.summaryLabel}>
          {pickup}
        </Text>
        <View style={styles.summaryDivider} />
        <Text numberOfLines={1} style={styles.summaryLabel}>
          {destination}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(11, 20, 36, 0.62)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  matchCard: {
    backgroundColor: colors.white,
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
  },
  matchGraphic: {
    height: 138,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  pulseRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#74B9FF",
  },
  matchMarker: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F3F8",
    borderWidth: 1,
    borderColor: "#D6EAF3",
  },
  matchMarkerIcon: {
    width: 34,
    height: 34,
    resizeMode: "contain",
    tintColor: colors.primary,
  },
  matchCar: {
    position: "absolute",
    width: 80,
    height: 52,
    right: "13%",
    bottom: 2,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  matchCarImage: { width: 72, height: 48 },
  matchEyebrow: {
    color: colors.primary,
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  matchTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 7,
  },
  matchBody: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 15,
  },
  matchProgress: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E8EDF4",
    overflow: "hidden",
  },
  matchProgressFill: {
    width: "64%",
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  matchFootnote: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    marginTop: 10,
  },
  resultIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#DDF7EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  resultIconWarning: { backgroundColor: "#FFF1D2" },
  resultIconText: {
    color: colors.greenDark,
    fontSize: 27,
    fontWeight: "800",
    fontFamily: fontFamilies.bold,
  },
  routeSummary: {
    width: "100%",
    borderRadius: 15,
    backgroundColor: colors.paper,
    padding: 13,
    flexDirection: "row",
    marginBottom: 13,
  },
  summaryMarkers: {
    width: 20,
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 5,
  },
  summaryPickupMarker: {
    width: 9,
    height: 9,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  summaryDash: {
    flex: 1,
    borderLeftWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9AA6B7",
    marginVertical: 3,
  },
  summaryDestinationMarker: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  summaryLabels: { flex: 1, marginLeft: 8 },
  summaryLabel: {
    color: colors.ink,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    paddingVertical: 3,
  },
  summaryDivider: { height: 9 },
  pinCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 12,
    alignItems: "center",
    marginBottom: 13,
  },
  pinLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  pinValue: {
    color: colors.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 27,
    letterSpacing: 5,
    marginTop: 4,
  },
  pinHint: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 3,
  },
  modalButton: { width: "100%", marginTop: 2, marginBottom: 0 },
  routeTimeline: { flexDirection: "row", gap: 12 },
  timelineMarkers: { width: 16, alignItems: "center", paddingTop: 21 },
  pickupMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  timelineDash: {
    height: 30,
    borderLeftWidth: 1,
    borderStyle: "dashed",
    borderColor: "#AAB5C4",
  },
  destinationMarker: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationMarkerIcon: {
    width: 8,
    height: 8,
    resizeMode: "contain",
    tintColor: colors.ink,
  },
  routeFields: { flex: 1 },
  fieldDivider: {
    borderTopWidth: 1,
    borderColor: colors.line,
    marginTop: -2,
    marginBottom: 10,
  },
  locationNote: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
    marginTop: 1,
  },
  locationNoteText: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: 10,
  },
  categoryRow: { flexDirection: "row", gap: 8 },
  categoryChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: 9,
    paddingHorizontal: 3,
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EEF3FA",
  },
  categoryCar: { width: 53, height: 34 },
  vehicleTypeIcon: { fontSize: 25, marginBottom: 3 },
  categoryText: {
    color: colors.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
  },
  categoryTextSelected: { color: colors.primary },
  categoryMeta: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: 8,
    marginTop: 3,
  },
});
