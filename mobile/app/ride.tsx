import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as Location from "expo-location";
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
  apiGet,
  ApiError,
  CreatedRide,
  FareEstimate,
  Ride,
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

interface RideHistoryItem {
  id: string;
  status: string;
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
  if (!latitude.trim() || !longitude.trim()) {
    throw new Error("Set your pickup GPS and search for a destination.");
  }
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
  const [pickupLabel, setPickupLabel] = useState("");
  const [pickupLatitude, setPickupLatitude] = useState("");
  const [pickupLongitude, setPickupLongitude] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [destinationLatitude, setDestinationLatitude] = useState("");
  const [destinationLongitude, setDestinationLongitude] = useState("");
  const [category, setCategory] = useState<VehicleCategory>("ECONOMY");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [created, setCreated] = useState<CreatedRide | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [showRideModal, setShowRideModal] = useState(false);
  const [rideActionBusy, setRideActionBusy] = useState(false);
  const [busy, setBusy] = useState<
    "destination" | "estimate" | "ride" | null
  >(null);
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

  useEffect(() => {
    if (
      isLoading ||
      user?.role !== "PASSENGER" ||
      activeRide
    ) {
      return;
    }
    let cancelled = false;
    void apiGet<{ items: RideHistoryItem[] }>("/rides?page=1&limit=20")
      .then(async (history) => {
        const ride = history.items.find((item) =>
          ["SEARCHING", "ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(
            item.status,
          ),
        );
        if (!ride || cancelled) return;
        const details = await apiGet<Ride>(`/rides/${ride.id}`);
        if (!cancelled) setActiveRide(details);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your current ride.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeRide, isLoading, user]);

  useEffect(() => {
    const rideId = activeRide?.id;
    if (
      !rideId ||
      ["COMPLETED", "CANCELLED", "EXPIRED"].includes(activeRide.status)
    ) {
      return;
    }
    const timer = setInterval(() => {
      void apiGet<Ride>(`/rides/${rideId}`)
        .then((ride) => {
          setActiveRide((current) => (current?.id === rideId ? ride : current));
          setCreated((current) =>
            current?.ride.id === rideId ? { ...current, ride } : current,
          );
        })
        .catch((cause: unknown) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not refresh the ride status.",
          );
        });
    }, 5000);
    return () => clearInterval(timer);
  }, [activeRide?.id, activeRide?.status]);

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

  async function useCurrentPickup() {
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Allow location access to set your pickup point.");
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setPickupLatitude(String(latitude));
      setPickupLongitude(String(longitude));
      setEstimate(null);
      setPickupLabel(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = places[0];
      const label = [
        place?.name,
        place?.street,
        place?.district,
        place?.city,
      ]
        .filter(Boolean)
        .filter((value, index, items) => items.indexOf(value) === index)
        .join(", ");
      if (label) setPickupLabel(label);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not get your current location.",
      );
    }
  }

  async function findDestination() {
    setError("");
    if (!destinationLabel.trim()) {
      setError("Enter a destination place or address first.");
      return;
    }
    setBusy("destination");
    try {
      const results = await Location.geocodeAsync(destinationLabel.trim());
      const match = results[0];
      if (!match) {
        throw new Error("No destination matched that place or address.");
      }
      setDestinationLatitude(String(match.latitude));
      setDestinationLongitude(String(match.longitude));
      setEstimate(null);
    } catch (cause) {
      setDestinationLatitude("");
      setDestinationLongitude("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not find that destination.",
      );
    } finally {
      setBusy(null);
    }
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
    setShowRideModal(false);
    try {
      const input = getInput();
      const idempotencyKey = `mobile-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 14)}`;
      const result = await apiPost<CreatedRide>("/rides", input, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      setCreated(result);
      setActiveRide(result.ride);
      setShowRideModal(true);
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

  async function cancelRide() {
    if (!activeRide) return;
    setRideActionBusy(true);
    setError("");
    try {
      await apiPost(`/rides/${activeRide.id}/cancel`, { reason: "CHANGED_MIND" });
      const updated = await apiGet<Ride>(`/rides/${activeRide.id}`);
      setActiveRide(updated);
      setCreated((current) =>
        current?.ride.id === updated.id ? { ...current, ride: updated } : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel this ride.");
    } finally {
      setRideActionBusy(false);
    }
  }

  return (
    <Screen>
      <Modal
        animationType="fade"
        transparent
        visible={busy === "ride" || (created !== null && showRideModal)}
        onRequestClose={() => {
          if (busy !== "ride") setShowRideModal(false);
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
                  {created?.ride.status === "SEARCHING"
                    ? `Shared with ${created?.offersCreated} nearby driver${created?.offersCreated === 1 ? "" : "s"}. Waiting for a driver to accept.`
                    : `Ride status: ${created?.ride.status.replaceAll("_", " ").toLowerCase()}.`}
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
                  onPress={() => setShowRideModal(false)}
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
        {activeRide ? (
          <Card>
            <Text style={uiStyles.sectionTitle}>
              Current ride · {activeRide.status.replaceAll("_", " ")}
            </Text>
            <Text style={[uiStyles.body, { marginTop: 6 }]}>
              {activeRide.pickup.label} → {activeRide.destination.label}
            </Text>
            {activeRide.pickupPin ? (
              <Text style={[uiStyles.body, { marginTop: 6 }]}>
                Give your driver this pickup PIN: {activeRide.pickupPin}
              </Text>
            ) : null}
            {["SEARCHING", "ACCEPTED", "DRIVER_ARRIVING"].includes(
              activeRide.status,
            ) ? (
              <Button
                title="Cancel ride"
                secondary
                onPress={cancelRide}
                busy={rideActionBusy}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </Card>
        ) : null}
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
                  setDestinationLatitude("");
                  setDestinationLongitude("");
                  setEstimate(null);
                }}
              />
            </View>
          </View>
          <View style={styles.locationNote}>
            <Text style={styles.locationNoteText}>
              Use GPS for pickup, then search for your destination.
            </Text>
          </View>
          <Button
            title="Use my current location for pickup"
            secondary
            onPress={useCurrentPickup}
            style={{ marginBottom: 12 }}
          />
          <View style={uiStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[uiStyles.small, { marginBottom: 12 }]}>
                {pickupLatitude && pickupLongitude
                  ? `Pickup GPS: ${Number(pickupLatitude).toFixed(5)}, ${Number(pickupLongitude).toFixed(5)}`
                  : "Pickup location not set"}
              </Text>
            </View>
          </View>
          <Button
            title={
              destinationLatitude
                ? "Destination found · search again"
                : "Find destination by place or address"
            }
            secondary
            onPress={findDestination}
            busy={busy === "destination"}
            disabled={busy !== null}
          />
          {destinationLatitude && destinationLongitude ? (
            <Text style={[uiStyles.small, { marginBottom: 14 }]}>
              Destination pin: {Number(destinationLatitude).toFixed(5)},{" "}
              {Number(destinationLongitude).toFixed(5)}
            </Text>
          ) : null}
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
          service is configured.           Pickup GPS and destination coordinates are sent to your backend to
          calculate the estimate and match drivers.
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
