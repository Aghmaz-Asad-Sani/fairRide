import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ScrollView, Text } from "react-native";
import {
  ApiError,
  apiHealth,
  getApiOrigin,
  setApiOrigin,
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
  uiStyles,
} from "../src/components/ui";

export default function SettingsScreen() {
  const { user, isLoading, signOut } = useSession();
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getApiOrigin()
      .then(setOrigin)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load API URL",
        ),
      );
  }, []);

  if (isLoading) return <LoadingView />;

  async function saveAndCheck() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await setApiOrigin(origin);
      setOrigin(saved);
      const health = await apiHealth();
      setMessage(`Connected to FairRide API (${health.status}).`);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Could not connect to the API.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await signOut();
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Sign out could not complete.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Heading
          title="Connection settings"
          subtitle="Choose how this development app reaches your backend."
        />
        <Card>
          {message ? <Notice message={message} /> : null}
          {error ? <Notice message={error} error /> : null}
          <Field
            label="Backend server URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://10.0.2.2:3000"
            value={origin}
            onChangeText={setOrigin}
          />
          <Button
            title="Save and test connection"
            onPress={saveAndCheck}
            busy={busy}
          />
          <Text style={uiStyles.body}>
            Android emulator:{" "}
            <Text style={uiStyles.link}>http://10.0.2.2:3000</Text>
          </Text>
          <Text style={[uiStyles.body, { marginTop: 8 }]}>
            Physical phone: use your computer’s Wi-Fi/LAN IPv4, for example{" "}
            <Text style={uiStyles.link}>http://192.168.1.20:3000</Text>. Find it
            with <Text style={uiStyles.link}>ipconfig</Text>; allow Node through
            Windows Firewall for private networks.
          </Text>
          <Text style={[uiStyles.small, { marginTop: 10 }]}>
            Keep phone and computer on the same Wi-Fi. Plain HTTP is only for
            local development—production must use HTTPS.
          </Text>
        </Card>
        {user ? (
          <Card>
            <Text style={uiStyles.sectionTitle}>Signed in</Text>
            <Text style={[uiStyles.body, { marginTop: 5, marginBottom: 12 }]}>
              {user.name} · {user.role.toLowerCase()}
            </Text>
            <Button title="Sign out" secondary onPress={logout} busy={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
