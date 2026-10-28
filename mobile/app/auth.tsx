import { useEffect, useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError } from "../src/api/client";
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

type Role = "PASSENGER" | "DRIVER";

export default function AuthScreen() {
  const params = useLocalSearchParams<{ role?: string; mode?: string }>();
  const role: Role = params.role === "DRIVER" ? "DRIVER" : "PASSENGER";
  const { user, isLoading, signIn, signUp } = useSession();
  const [mode, setMode] = useState<"login" | "register">(
    params.mode === "login" ? "login" : "register",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  if (isLoading || user) return <LoadingView />;

  async function submit() {
    setError("");
    if (!identifier.trim() && mode === "login") {
      setError("Enter your phone number or email.");
      return;
    }
    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }
    if (mode === "register" && (!name.trim() || !phone.trim())) {
      setError("Enter your name and phone number.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const account = await signIn({
          identifier: identifier.trim(),
          password,
        });
        router.replace(
          account.phoneVerified
            ? account.role === "DRIVER"
              ? "/driver"
              : "/home"
            : "/otp",
        );
      } else {
        await signUp({
          name: name.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          password,
          role,
        });
        router.replace("/otp");
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not complete the request. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isDriver = role === "DRIVER";
  return (
    <Screen
      style={styles.screen}
      safeAreaEdges={["top", "right", "bottom", "left"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
          <View style={styles.topRow}>
            <Text
              style={[
                styles.roleLabel,
                { color: isDriver ? "#A36A00" : colors.primary },
              ]}
            >
              {isDriver ? "DRIVER PARTNER" : "PASSENGER"}
            </Text>
            <Text
              style={[
                styles.rolePill,
                { backgroundColor: isDriver ? "#FFF1D2" : "#E8F3F8" },
              ]}
            >
              {isDriver ? "Drive & earn" : "Book a ride"}
            </Text>
          </View>
          <Heading
            title={
              mode === "login"
                ? "Welcome back"
                : isDriver
                  ? "Become a driver"
                  : "Create your account"
            }
            subtitle={
              mode === "login"
                ? "Use the phone number or email linked to your account."
                : isDriver
                  ? "Set up your profile, then add your licence and vehicle."
                  : "A few details and you’ll be ready to ride."
            }
          />
          <Card>
            {mode === "register" ? (
              <>
                <Field
                  label="Full name"
                  autoComplete="name"
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                />
                <Field
                  label="Pakistan phone number"
                  placeholder="+923001234567"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={32}
                />
                <Field
                  label="Email (optional)"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  maxLength={254}
                />
              </>
            ) : (
              <>
                <Field
                  label="Phone number or email"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={identifier}
                  onChangeText={setIdentifier}
                />
              </>
            )}
            <Field
              label="Password (at least 12 characters)"
              secureTextEntry
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChangeText={setPassword}
              maxLength={128}
            />
            {error ? <Notice message={error} error /> : null}
            <Button
              title={mode === "login" ? "Sign in" : "Create account"}
              onPress={submit}
              busy={busy}
            />
            <Button
              title={
                mode === "login"
                  ? "New to FairRide? Create account"
                  : "Already have an account? Sign in"
              }
              secondary
              onPress={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            />
          </Card>
          <Link href="/settings" asChild>
            <Text
              style={{
                textAlign: "center",
                color: colors.primary,
                fontWeight: "700",
                padding: 12,
              }}
            >
              API connection settings
            </Text>
          </Link>
          <Text style={[uiStyles.small, { textAlign: "center", marginTop: 8 }]}>
            <Link
              href="/"
              style={{
                color: colors.primary,
                fontWeight: "700",
                fontFamily: fontFamilies.semibold,
              }}
            >
              ← Change account type
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 12 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  topRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    fontFamily: fontFamilies.bold,
  },
  rolePill: {
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: fontFamilies.semibold,
  },
});
