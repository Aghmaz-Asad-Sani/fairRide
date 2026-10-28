import { useCallback, useEffect, useState } from "react";
import { Link, router, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  apiGet,
  apiPatch,
  apiPost,
  ApiError,
  DriverOffer,
  DriverProfile,
} from "../src/api/client";
import { useSession } from "../src/auth/SessionProvider";
import {
  Button,
  Card,
  Field,
  LoadingView,
  Notice,
  Screen,
  colors,
  fontFamilies,
  uiStyles,
} from "../src/components/ui";

const todayPlusYears = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
};

type VehicleType = "CAR" | "BIKE" | "RICKSHAW";
type VehicleCategory = "ECONOMY" | "COMFORT" | "XL";
interface DriverTrip {
  id: string;
  status: string;
  pickupLabel: string;
  destinationLabel: string;
}

const vehicleTypes: {
  type: VehicleType;
  title: string;
  detail: string;
  icon: string;
}[] = [
  { type: "CAR", title: "Car", detail: "1–8 passengers", icon: "🚘" },
  { type: "BIKE", title: "Bike", detail: "Quick city rides", icon: "🏍" },
  { type: "RICKSHAW", title: "Rickshaw", detail: "Local trips", icon: "🛺" },
];

interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

async function getCurrentLocation(): Promise<DriverLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error(
      "Location permission is off. Allow FairRide location access in phone settings to go online.",
    );
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error(
      "Phone location services are off. Turn on GPS/location services and try again.",
    );
  }
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude, accuracy } = location.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Phone did not return a valid location. Check GPS and try again.",
    );
  }
  return {
    latitude,
    longitude,
    ...(accuracy !== null &&
    Number.isFinite(accuracy) &&
    accuracy >= 0 &&
    accuracy <= 1000
      ? { accuracyMeters: accuracy }
      : {}),
  };
}

function locationErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 0) {
      return "Could not reach the backend. Keep the laptop and phone on the same Wi-Fi, check the phone's API server URL, and make sure the backend is running.";
    }
    if (cause.status === 429) {
      return "Location was just updated. Wait a moment and try again.";
    }
    return cause.message;
  }
  return cause instanceof Error
    ? cause.message
    : "Could not get or save your location. Check GPS and your network, then try again.";
}

export default function DriverScreen() {
  const { user, isLoading } = useSession();
  const { width } = useWindowDimensions();
  const compactFields = width < 390;
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [activeRide, setActiveRide] = useState<DriverTrip | null>(null);
  const [pickupPin, setPickupPin] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState(todayPlusYears(1));
  const [category, setCategory] = useState<VehicleCategory>("ECONOMY");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState(String(new Date().getFullYear()));
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [color, setColor] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [documentExpiresAt, setDocumentExpiresAt] = useState(todayPlusYears(1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [setupStep, setSetupStep] = useState(1);
  const isOnline = profile?.isOnline ?? false;
  const activeRideId = activeRide?.id;

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
    else if (!isLoading && user && !user.phoneVerified) router.replace("/otp");
    else if (!isLoading && user?.role !== "DRIVER") router.replace("/home");
  }, [isLoading, user]);

  const loadDriverData = useCallback(async () => {
    if (!user || user.role !== "DRIVER") return;
    setError("");
    const [profileResult, offerResult, ridesResult] = await Promise.allSettled([
      apiGet<DriverProfile>("/drivers/profile"),
      apiGet<DriverOffer[]>("/drivers/offers"),
      apiGet<{ items: DriverTrip[] }>("/rides?page=1&limit=20"),
    ]);
    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value);
      setLicenseNumber(profileResult.value.licenseNumber);
      setLicenseExpiry(profileResult.value.licenseExpiry);
      setSetupStep(
        profileResult.value.verificationStatus === "REJECTED" ||
          !profileResult.value.licenseNumber.trim()
          ? 1
          : profileResult.value.vehicles.length === 0 ||
              profileResult.value.vehicles.every(
                (vehicle) => vehicle.verificationStatus === "REJECTED",
              )
            ? 2
            : 3,
      );
    } else if (
      !(profileResult.reason instanceof ApiError) ||
      profileResult.reason.status !== 404
    ) {
      setError(
        profileResult.reason instanceof Error
          ? profileResult.reason.message
          : "Could not load your driver profile.",
      );
    }
    if (offerResult.status === "fulfilled") {
      setOffers(offerResult.value);
    } else if (
      !(offerResult.reason instanceof ApiError) ||
      offerResult.reason.status !== 403
    ) {
      setError(
        offerResult.reason instanceof Error
          ? offerResult.reason.message
          : "Could not load driver offers.",
      );
    }
    if (ridesResult.status === "fulfilled") {
      setActiveRide(
        ridesResult.value.items.find((ride) =>
          ["ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(ride.status),
        ) ?? null,
      );
    } else {
      setError(
        ridesResult.reason instanceof Error
          ? ridesResult.reason.message
          : "Could not load your active trip.",
      );
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadDriverData();
      const timer = setInterval(() => void loadDriverData(), 15_000);
      return () => clearInterval(timer);
    }, [loadDriverData]),
  );

  useEffect(() => {
    if (!isOnline) return;
    const updateInterval = activeRideId ? 5_000 : 60_000;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const location = await getCurrentLocation();
          await apiPost("/drivers/location", location);
        } catch (cause) {
          setError(locationErrorMessage(cause));
        }
      })();
    }, updateInterval);
    return () => clearInterval(timer);
  }, [activeRideId, isOnline]);

  if (isLoading || !user || !user.phoneVerified || user.role !== "DRIVER") {
    return <LoadingView />;
  }

  const approvedVehicle = profile?.vehicles.find(
    (vehicle) => vehicle.verificationStatus === "APPROVED",
  );
  const canGoOnline =
    profile?.verificationStatus === "APPROVED" && Boolean(approvedVehicle);
  const fieldRowStyle = [uiStyles.row, compactFields && styles.stackedFields];
  const fieldColumnStyle = compactFields
    ? styles.stackedFieldColumn
    : styles.fieldColumn;

  async function submitProfile() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiPost<DriverProfile>("/drivers/profile", {
        licenseNumber: licenseNumber.trim(),
        licenseExpiry,
      });
      setProfile(updated);
      setSetupStep(
        updated.vehicles.some(
          (vehicle) => vehicle.verificationStatus !== "REJECTED",
        )
          ? 3
          : 2,
      );
      setMessage("Driver details submitted for administrator review.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Profile submission failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addVehicle() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiPost("/drivers/vehicles", {
        category,
        vehicleType,
        make: make.trim(),
        model: model.trim(),
        modelYear: Number(modelYear),
        registrationNumber: registrationNumber.trim(),
        chassisNumber: chassisNumber.trim(),
        engineNumber: engineNumber.trim(),
        color: color.trim(),
        passengerCapacity: Number(capacity),
        documentExpiresAt,
      });
      setMessage("Vehicle submitted for administrator review.");
      await loadDriverData();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Vehicle submission failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setAvailability(online: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (online) {
        const location = await getCurrentLocation();
        await apiPost("/drivers/location", location);
      }
      await apiPatch("/drivers/availability", { online, available: online });
      setProfile((current) =>
        current
          ? { ...current, isOnline: online, isAvailable: online }
          : current,
      );
      setMessage(
        online
          ? "Driver account is online and available."
          : "Driver account is offline.",
      );
    } catch (cause) {
      setError(locationErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function answerOffer(rideId: string, accept: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (accept) await apiPost(`/drivers/offers/${rideId}/accept`, {});
      else await apiPost(`/drivers/offers/${rideId}/reject`, {});
      setMessage(accept ? "Ride offer accepted." : "Ride offer declined.");
      await loadDriverData();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update the offer.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateActiveRide(action: "arrived" | "start" | "complete") {
    if (!activeRide) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "start") {
        await apiPost(`/rides/${activeRide.id}/start`, {
          pin: pickupPin.trim(),
        });
        setPickupPin("");
      } else {
        await apiPost(`/rides/${activeRide.id}/${action}`, {});
      }
      setMessage(
        action === "arrived"
          ? "Pickup arrival recorded."
          : action === "start"
            ? "Ride started."
            : "Ride completed.",
      );
      await loadDriverData();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this ride.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.setupHero}>
            <View style={styles.heroOrb} />
            <Text style={styles.heroEyebrow}>DRIVER PARTNER · APPLICATION</Text>
            <Text style={styles.heroTitle}>
              {setupStep === 1
                ? "Your journey starts here."
                : setupStep === 2
                  ? "Add your ride vehicle."
                  : "You’re nearly on the road."}
            </Text>
            <Text style={styles.heroBody}>
              {setupStep === 1
                ? "Add your licence and vehicle details. Our team will review everything before you go online."
                : setupStep === 2
                  ? "Tell us about the vehicle you’ll use for FairRide trips."
                  : "Track your approval here. Once approved, you can start receiving nearby ride offers."}
            </Text>
            <View style={styles.heroFooter}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>✦ DRIVER SETUP</Text>
              </View>
              <Text style={styles.heroTiming}>About 3 minutes</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            {["Driving details", "Your vehicle", "Go online"].map(
              (label, index) => {
                const number = index + 1;
                const complete =
                  number < setupStep || (number === 3 && canGoOnline);
                const active = number === setupStep;
                return (
                  <View
                    key={label}
                    style={[
                      styles.progressStep,
                      active && styles.progressStepActive,
                      complete && styles.progressStepComplete,
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressEyebrow,
                        active && styles.progressEyebrowActive,
                        complete && styles.progressEyebrowComplete,
                      ]}
                    >
                      {complete ? "✓ DONE" : `STEP 0${number}`}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.progressLabel,
                        active && styles.progressLabelActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              },
            )}
          </View>
          {error ? <Notice message={error} error /> : null}
          {message ? <Notice message={message} /> : null}
          {setupStep === 1 ? (
            <Card>
              <View style={styles.formTitleRow}>
                <View style={styles.formStepBadge}>
                  <Text style={styles.formStepNumber}>01</Text>
                </View>
                <View style={styles.formTitleCopy}>
                  <Text style={uiStyles.sectionTitle}>Driving licence</Text>
                  <Text style={styles.formSubtitle}>
                    Your licence details for verification
                  </Text>
                </View>
              </View>
              {profile?.verificationStatus === "REJECTED" ? (
                <Notice
                  message="Your driver details were rejected. Update your licence information and submit it again for review."
                  error
                />
              ) : null}
              <Field
                label="Driving licence number"
                placeholder="Enter your licence number"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                autoCapitalize="characters"
              />
              <Field
                label="Licence expiry date (YYYY-MM-DD)"
                placeholder="YYYY-MM-DD"
                value={licenseExpiry}
                onChangeText={setLicenseExpiry}
              />
              <Button
                title="Save licence details"
                onPress={submitProfile}
                busy={busy}
                style={styles.formButton}
              />
            </Card>
          ) : (
            <Card>
              <View style={styles.formTitleRow}>
                <View style={[styles.formStepBadge, styles.formStepBadgeDone]}>
                  <Text
                    style={[styles.formStepNumber, styles.formStepNumberDone]}
                  >
                    ✓
                  </Text>
                </View>
                <View style={styles.formTitleCopy}>
                  <Text style={uiStyles.sectionTitle}>
                    Licence details added
                  </Text>
                  <Text style={styles.formSubtitle}>Ready for review</Text>
                </View>
              </View>
              <Text style={[uiStyles.body, { marginTop: 5 }]}>
                Licence ending {licenseNumber.slice(-4) || "—"} · Review{" "}
                {profile?.verificationStatus?.toLowerCase() ?? "pending"}
              </Text>
              {setupStep === 2 ? (
                <Button
                  title="Edit driving details"
                  secondary
                  onPress={() => setSetupStep(1)}
                  style={{ marginTop: 12 }}
                />
              ) : null}
            </Card>
          )}
          {setupStep === 2 ? (
            <Card>
              <View style={styles.formTitleRow}>
                <View style={styles.formStepBadge}>
                  <Text style={styles.formStepNumber}>02</Text>
                </View>
                <View style={styles.formTitleCopy}>
                  <Text style={uiStyles.sectionTitle}>Your vehicle</Text>
                  <Text style={styles.formSubtitle}>
                    Choose a type, then add its details
                  </Text>
                </View>
              </View>
              {profile?.vehicles.some(
                (vehicle) => vehicle.verificationStatus === "REJECTED",
              ) ? (
                <Notice
                  message="A previously submitted vehicle was rejected. Correct the details and submit an eligible vehicle again."
                  error
                />
              ) : null}
              <View style={{ gap: 8, marginBottom: 14 }}>
                {vehicleTypes.map((option) => {
                  const selected = vehicleType === option.type;
                  return (
                    <Pressable
                      key={option.type}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setVehicleType(option.type);
                        setCategory("ECONOMY");
                        setCapacity(
                          option.type === "BIKE"
                            ? "1"
                            : option.type === "RICKSHAW"
                              ? "3"
                              : "4",
                        );
                      }}
                      style={{
                        minHeight: 62,
                        borderWidth: 1,
                        borderColor: selected ? "#D2972C" : colors.line,
                        backgroundColor: selected ? "#FFF9EC" : colors.white,
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 11,
                      }}
                    >
                      <Text style={{ fontSize: 23 }}>{option.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={uiStyles.sectionTitle}>
                          {option.title}
                        </Text>
                        <Text style={uiStyles.small}>{option.detail}</Text>
                      </View>
                      <Text
                        style={{
                          color: selected ? "#94600A" : colors.muted,
                          fontFamily: fontFamilies.bold,
                        }}
                      >
                        {selected ? "Selected" : "Choose"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {vehicleType === "CAR" ? (
                <>
                  <Text style={[uiStyles.sectionTitle, { marginBottom: 8 }]}>
                    Car class
                  </Text>
                  <View style={[uiStyles.row, { marginBottom: 8 }]}>
                    {(["ECONOMY", "COMFORT", "XL"] as const).map((item) => (
                      <Button
                        key={item}
                        title={item}
                        secondary={category !== item}
                        onPress={() => setCategory(item)}
                        style={{ flex: 1, paddingHorizontal: 5 }}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[uiStyles.small, { marginBottom: 12 }]}>
                  {vehicleType === "BIKE"
                    ? "Bike rides use the standard fare class."
                    : "Rickshaw rides use the standard fare class."}
                </Text>
              )}
              <View style={fieldRowStyle}>
                <View style={fieldColumnStyle}>
                  <Field label="Make" value={make} onChangeText={setMake} />
                </View>
                <View style={fieldColumnStyle}>
                  <Field label="Model" value={model} onChangeText={setModel} />
                </View>
              </View>
              <View style={fieldRowStyle}>
                <View style={fieldColumnStyle}>
                  <Field
                    label="Model year"
                    keyboardType="number-pad"
                    value={modelYear}
                    onChangeText={setModelYear}
                  />
                </View>
                <View style={fieldColumnStyle}>
                  <Field
                    label="Passenger capacity"
                    keyboardType="number-pad"
                    value={capacity}
                    onChangeText={setCapacity}
                  />
                </View>
              </View>
              <Field
                label="Registration number"
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                autoCapitalize="characters"
              />
              <Field
                label="Chassis number"
                value={chassisNumber}
                onChangeText={setChassisNumber}
                autoCapitalize="characters"
              />
              <Field
                label="Engine number"
                value={engineNumber}
                onChangeText={setEngineNumber}
                autoCapitalize="characters"
              />
              <Notice message="Private document photo uploads (profile photo, CNIC and licence images) are not enabled yet. Do not send these documents through chat or an unprotected link." />
              <View style={fieldRowStyle}>
                <View style={fieldColumnStyle}>
                  <Field label="Color" value={color} onChangeText={setColor} />
                </View>
                <View style={fieldColumnStyle}>
                  <Field
                    label="Documents expiry date (YYYY-MM-DD)"
                    placeholder="YYYY-MM-DD"
                    value={documentExpiresAt}
                    onChangeText={setDocumentExpiresAt}
                  />
                </View>
              </View>
              <Button
                title="Submit vehicle for review"
                onPress={addVehicle}
                busy={busy}
                style={styles.formButton}
              />
            </Card>
          ) : null}
          {setupStep >= 3 ? (
            <>
              <Card>
                <Text style={uiStyles.sectionTitle}>
                  3. Verification review
                </Text>
                {profile?.vehicles.map((vehicle) => (
                  <Text
                    key={vehicle.id}
                    style={[uiStyles.body, { marginTop: 7 }]}
                  >
                    {vehicle.make} {vehicle.model} · {vehicle.vehicleType} ·{" "}
                    {vehicle.category} ·{" "}
                    {vehicle.verificationStatus.toLowerCase()}
                  </Text>
                ))}
                <Text style={[uiStyles.body, { marginTop: 7 }]}>
                  Driver profile:{" "}
                  {profile?.verificationStatus.toLowerCase() ?? "pending"}.
                </Text>
                {!canGoOnline ? (
                  <Text style={[uiStyles.body, { marginTop: 9 }]}>
                    {profile?.verificationStatus === "REJECTED"
                      ? "Your driver profile was rejected. Update your driving details and resubmit them for review."
                      : profile?.vehicles.some(
                            (vehicle) =>
                              vehicle.verificationStatus === "REJECTED",
                          )
                        ? "A vehicle was rejected. Submit a corrected or different vehicle for review before going online."
                        : "Your details are in review. Going online will unlock once both your driver profile and vehicle are approved."}
                  </Text>
                ) : null}
              </Card>
              {canGoOnline ? (
                <Card>
                  <Text style={uiStyles.sectionTitle}>
                    You’re approved to drive
                  </Text>
                  <Text
                    style={[uiStyles.body, { marginTop: 5, marginBottom: 10 }]}
                  >
                    FairRide uses your current GPS location while the app is
                    open. Location sharing stops when you go offline or close
                    the app.
                  </Text>
                  <Button
                    title="Go online with current location"
                    onPress={() => setAvailability(true)}
                    busy={busy}
                  />
                  <Button
                    title="Go offline"
                    secondary
                    onPress={() => setAvailability(false)}
                    busy={busy}
                  />
                </Card>
              ) : null}
              <View style={{ marginBottom: 8 }}>
                <Text style={uiStyles.sectionTitle}>Available ride offers</Text>
              </View>
              {offers.length === 0 ? (
                <Card>
                  <Text style={uiStyles.sectionTitle}>
                    {isOnline
                      ? "You’re ready for nearby rides"
                      : "No active offers"}
                  </Text>
                  <Text style={[uiStyles.body, { marginTop: 6 }]}>
                    {isOnline
                      ? "Passengers are not shown as a list. When a nearby passenger requests a matching ride, their pickup, destination and FairRide fare appear here as an offer. Review it and tap Accept to pick up the ride."
                      : "Go online with your current location to receive nearby ride offers. You must be approved and have a current approved vehicle."}
                  </Text>
                  <Text style={[uiStyles.small, { marginTop: 8 }]}>
                    FairRide sets the estimated fare shown on each offer;
                    drivers cannot bid or change the fare. Passenger ratings are
                    not available in this development version yet.
                  </Text>
                </Card>
              ) : (
                offers.map((offer) => (
                  <Card key={offer.rideId}>
                    <Text style={uiStyles.sectionTitle}>
                      {offer.pickupLabel} → {offer.destinationLabel}
                    </Text>
                    <Text style={[uiStyles.body, { marginTop: 5 }]}>
                      {offer.vehicleType} · Pickup {offer.pickupDistanceMeters}{" "}
                      m away · Estimated fare PKR{" "}
                      {(offer.estimatedFarePaisa / 100).toFixed(2)}
                    </Text>
                    <View style={[uiStyles.row, { marginTop: 12 }]}>
                      <Button
                        title="Accept"
                        onPress={() => answerOffer(offer.rideId, true)}
                        busy={busy}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Decline"
                        secondary
                        onPress={() => answerOffer(offer.rideId, false)}
                        busy={busy}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </Card>
                ))
              )}
              {activeRide ? (
                <Card>
                  <Text style={uiStyles.sectionTitle}>
                    Active trip · {activeRide.status.replaceAll("_", " ")}
                  </Text>
                  <Text style={[uiStyles.body, { marginTop: 6 }]}>
                    {activeRide.pickupLabel} → {activeRide.destinationLabel}
                  </Text>
                  {activeRide.status === "ACCEPTED" ? (
                    <Button
                      title="I’ve arrived at pickup"
                      onPress={() => updateActiveRide("arrived")}
                      busy={busy}
                      style={{ marginTop: 12 }}
                    />
                  ) : null}
                  {activeRide.status === "DRIVER_ARRIVING" ? (
                    <>
                      <Field
                        label="Passenger pickup PIN"
                        keyboardType="number-pad"
                        value={pickupPin}
                        onChangeText={setPickupPin}
                      />
                      <Button
                        title="Verify PIN and start ride"
                        onPress={() => updateActiveRide("start")}
                        busy={busy}
                      />
                    </>
                  ) : null}
                  {activeRide.status === "IN_PROGRESS" ? (
                    <Button
                      title="Complete ride"
                      onPress={() => updateActiveRide("complete")}
                      busy={busy}
                      style={{ marginTop: 12 }}
                    />
                  ) : null}
                </Card>
              ) : null}
            </>
          ) : null}
          <Link href="/settings" asChild>
            <Button
              title="Account settings and sign out"
              secondary
              onPress={() => undefined}
              style={{ marginTop: 8, marginBottom: 12 }}
            />
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  setupHero: {
    overflow: "hidden",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "#14233C",
  },
  heroOrb: {
    position: "absolute",
    top: -48,
    right: -28,
    width: 158,
    height: 158,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(255,198,90,0.18)",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  heroEyebrow: {
    color: "#FFC65A",
    fontSize: 9,
    letterSpacing: 1.35,
    fontFamily: fontFamilies.bold,
  },
  heroTitle: {
    maxWidth: 285,
    color: colors.white,
    fontSize: 24,
    lineHeight: 30,
    marginTop: 11,
    fontFamily: fontFamilies.extraBold,
  },
  heroBody: {
    maxWidth: 300,
    color: "#D1D9E7",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    fontFamily: fontFamilies.regular,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 17,
  },
  heroPill: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,198,90,0.14)",
  },
  heroPillText: {
    color: "#FFD47E",
    fontSize: 8,
    letterSpacing: 0.6,
    fontFamily: fontFamilies.bold,
  },
  heroTiming: {
    color: "#C1CAD8",
    fontSize: 10,
    fontFamily: fontFamilies.medium,
  },
  progressRow: { flexDirection: "row", gap: 7, marginBottom: 16 },
  progressStep: {
    flex: 1,
    minHeight: 58,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 9,
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  progressStepActive: {
    borderColor: "#14233C",
    backgroundColor: "#14233C",
  },
  progressStepComplete: {
    borderColor: "#E8D5AC",
    backgroundColor: "#FFFCF5",
  },
  progressEyebrow: {
    color: "#929CAE",
    fontSize: 9,
    letterSpacing: 0.45,
    fontFamily: fontFamilies.bold,
  },
  progressEyebrowActive: { color: "#FFC65A" },
  progressEyebrowComplete: { color: "#94600A" },
  progressLabel: {
    color: colors.ink,
    fontSize: 9,
    marginTop: 5,
    fontFamily: fontFamilies.semibold,
  },
  progressLabelActive: { color: colors.white },
  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 17,
  },
  formStepBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3D7",
  },
  formStepBadgeDone: { backgroundColor: "#E8F3F8" },
  formStepNumber: {
    color: "#94600A",
    fontSize: 13,
    fontFamily: fontFamilies.extraBold,
  },
  formStepNumberDone: { color: colors.primary },
  formTitleCopy: { flex: 1 },
  formSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
    fontFamily: fontFamilies.regular,
  },
  formButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#A36A00",
    marginTop: 3,
  },
  stackedFields: { flexDirection: "column", gap: 0 },
  fieldColumn: { flex: 1, minWidth: 0 },
  stackedFieldColumn: { width: "100%" },
});
