import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
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

export default function DriverScreen() {
  const { user, isLoading } = useSession();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState(todayPlusYears(1));
  const [category, setCategory] = useState<VehicleCategory>("ECONOMY");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState(String(new Date().getFullYear()));
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [color, setColor] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [documentExpiresAt, setDocumentExpiresAt] = useState(todayPlusYears(1));
  const [latitude, setLatitude] = useState("24.8607");
  const [longitude, setLongitude] = useState("67.0011");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [setupStep, setSetupStep] = useState(1);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
    else if (!isLoading && user && !user.phoneVerified) router.replace("/otp");
    else if (!isLoading && user?.role !== "DRIVER") router.replace("/home");
  }, [isLoading, user]);

  const loadDriverData = useCallback(async () => {
    if (!user || user.role !== "DRIVER") return;
    setError("");
    const [profileResult, offerResult] = await Promise.allSettled([
      apiGet<DriverProfile>("/drivers/profile"),
      apiGet<DriverOffer[]>("/drivers/offers"),
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
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadDriverData();
    }, [loadDriverData]),
  );

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
        await apiPost("/drivers/location", {
          latitude: Number(latitude),
          longitude: Number(longitude),
        });
      }
      await apiPatch("/drivers/availability", { online, available: online });
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
                  Enter a current GPS position. This starter does not collect
                  background location when the app is closed.
                </Text>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Current latitude"
                      keyboardType="decimal-pad"
                      value={latitude}
                      onChangeText={setLatitude}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Current longitude"
                      keyboardType="decimal-pad"
                      value={longitude}
                      onChangeText={setLongitude}
                    />
                  </View>
                </View>
                <Button
                  title="Go online"
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
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
