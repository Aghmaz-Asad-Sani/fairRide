import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ScrollView, Text } from "react-native";
import { ApiError, apiPost } from "../src/api/client";
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
} from "../src/components/ui";

interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
  developmentCode?: string;
}

export default function PhoneVerificationScreen() {
  const { user, isLoading, reloadUser } = useSession();
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
    else if (!isLoading && user?.phoneVerified) {
      router.replace(user.role === "DRIVER" ? "/driver" : "/home");
    }
  }, [isLoading, user]);

  if (isLoading || !user) return <LoadingView />;

  async function requestCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiPost<OtpChallenge>("/auth/phone/otp/request", {});
      setChallenge(result);
      setMessage(
        result.developmentCode
          ? `Development OTP: ${result.developmentCode}`
          : `Code requested. Expires at ${new Date(result.expiresAt).toLocaleTimeString()}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not request a verification code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!user) {
      setError("Sign in again to verify your phone.");
      return;
    }
    if (!challenge) {
      setError("Request a verification code first.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPost("/auth/phone/otp/verify", {
        challengeId: challenge.challengeId,
        code,
      });
      await reloadUser();
      router.replace(user.role === "DRIVER" ? "/driver" : "/home");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not verify the code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Heading
          title="Verify your phone"
          subtitle={`We need to confirm ${user.phone} before you can ${
            user.role === "DRIVER"
              ? "set up your driver account"
              : "request a ride"
          }.`}
        />
        <Card>
          {message ? <Notice message={message} /> : null}
          {error ? <Notice message={error} error /> : null}
          <Button
            title={
              challenge ? "Send another code" : "Request verification code"
            }
            onPress={requestCode}
            busy={busy}
          />
          <Field
            label="Six-digit verification code"
            keyboardType="number-pad"
            value={code}
            onChangeText={(value) =>
              setCode(value.replace(/\D/g, "").slice(0, 6))
            }
            maxLength={6}
          />
          <Button title="Verify phone" onPress={verifyCode} busy={busy} />
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
            Real SMS delivery is not connected yet. In development, the backend
            returns a code only when its development OTP setting is enabled.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
