import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { Pressable, ScrollView, Text, View } from "react-native";
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
  Heading,
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

async function getCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Allow location access to go online and receive nearby offers.");
  }
  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
}

export default function DriverScreen() {
  const { user, isLoading } = useSession();
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
    const timer = setInterval(() => {
      void (async () => {
        try {
          const location = await getCurrentLocation();
          await apiPost("/drivers/location", {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: location.coords.accuracy ?? undefined,
          });
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not refresh your current location.",
          );
        }
      })();
    }, 60_000);
    return () => clearInterval(timer);
  }, [isOnline]);

  if (isLoading || !user || !user.phoneVerified || user.role !== "DRIVER") {
    return <LoadingView />;
  }

  const approvedVehicle = profile?.vehicles.find(
    (vehicle) => vehicle.verificationStatus === "APPROVED",
  );
  const canGoOnline =
    profile?.verificationStatus === "APPROVED" && Boolean(approvedVehicle);

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
        await apiPost("/drivers/location", {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracyMeters: location.coords.accuracy ?? undefined,
        });
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
      setError(
        cause instanceof Error ? cause.message : "Availability update failed.",
      );
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
        await apiPost(`/rides/${activeRide.id}/start`, { pin: pickupPin.trim() });
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <Text
          style={{
            color: "#A36A00",
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 1.6,
            marginBottom: 8,
          }}
        >
          DRIVER PARTNER
        </Text>
        <Heading
          title="Let’s get you on the road."
          subtitle="Complete your driver setup, get verified, then start receiving ride offers."
        />
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 18 }}>
          {["Driving details", "Your vehicle", "Go online"].map(
            (label, index) => {
              const number = index + 1;
              const complete =
                number < setupStep || (number === 3 && canGoOnline);
              const active = number === setupStep;
              return (
                <View
                  key={label}
                  style={{
                    flex: 1,
                    minHeight: 54,
                    borderRadius: 13,
                    paddingHorizontal: 8,
                    paddingVertical: 9,
                    backgroundColor: active ? "#111B2E" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: active ? "#111B2E" : "#E2E7EF",
                  }}
                >
                  <Text
                    style={{
                      color: active
                        ? "#FFC65A"
                        : complete
                          ? "#138C7D"
                          : "#929CAE",
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    {complete ? "DONE" : `STEP 0${number}`}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? "#FFFFFF" : "#111B2E",
                      fontSize: 10,
                      fontWeight: "700",
                      marginTop: 4,
                    }}
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
            <Text style={uiStyles.sectionTitle}>1. Your driving details</Text>
            <Text style={[uiStyles.body, { marginTop: 5, marginBottom: 12 }]}>
              Enter your valid driving licence details. You can review them
              before submission.
            </Text>
            {profile?.verificationStatus === "REJECTED" ? (
              <Notice
                message="Your driver details were rejected. Update your licence information and submit it again for review."
                error
              />
            ) : null}
            <Field
              label="Driver license number"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              autoCapitalize="characters"
            />
            <Field
              label="License expiry (YYYY-MM-DD)"
              value={licenseExpiry}
              onChangeText={setLicenseExpiry}
            />
            <Button
              title="Save and continue"
              onPress={submitProfile}
              busy={busy}
            />
          </Card>
        ) : (
          <Card>
            <Text style={uiStyles.sectionTitle}>Driving details added</Text>
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
            <Text style={uiStyles.sectionTitle}>2. Add your vehicle</Text>
            <Text style={[uiStyles.body, { marginTop: 5, marginBottom: 12 }]}>
              Add the vehicle you’ll use for FairRide trips.
            </Text>
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
                      borderColor: selected ? colors.primary : colors.line,
                      backgroundColor: selected ? "#EEF3FA" : colors.white,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 11,
                    }}
                  >
                    <Text style={{ fontSize: 23 }}>{option.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={uiStyles.sectionTitle}>{option.title}</Text>
                      <Text style={uiStyles.small}>{option.detail}</Text>
                    </View>
                    <Text
                      style={{
                        color: selected ? colors.primary : colors.muted,
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
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Make" value={make} onChangeText={setMake} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Model" value={model} onChangeText={setModel} />
              </View>
            </View>
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Model year"
                  keyboardType="number-pad"
                  value={modelYear}
                  onChangeText={setModelYear}
                />
              </View>
              <View style={{ flex: 1 }}>
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
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Color" value={color} onChangeText={setColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Documents expiry (YYYY-MM-DD)"
                  value={documentExpiresAt}
                  onChangeText={setDocumentExpiresAt}
                />
              </View>
            </View>
            <Button title="Submit vehicle" onPress={addVehicle} busy={busy} />
          </Card>
        ) : null}
        {setupStep >= 3 ? (
          <>
            <Card>
              <Text style={uiStyles.sectionTitle}>3. Verification review</Text>
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
                  FairRide uses your current GPS location while the app is open.
                  Location sharing stops when you go offline or close the app.
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
                <Text style={uiStyles.body}>No active offers right now.</Text>
              </Card>
            ) : (
              offers.map((offer) => (
                <Card key={offer.rideId}>
                  <Text style={uiStyles.sectionTitle}>
                    {offer.pickupLabel} → {offer.destinationLabel}
                  </Text>
                  <Text style={[uiStyles.body, { marginTop: 5 }]}>
                    {offer.vehicleType} · Pickup {offer.pickupDistanceMeters} m
                    away · Estimated fare
                    PKR {(offer.estimatedFarePaisa / 100).toFixed(2)}
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
      </ScrollView>
    </Screen>
  );
}
