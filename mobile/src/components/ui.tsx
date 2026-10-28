import { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export const colors = {
  ink: "#111B2E",
  blue: "#263B67",
  primary: "#263B67",
  teal: "#43D6C2",
  gold: "#FFC65A",
  green: "#263B67",
  greenDark: "#14233C",
  mint: "#E8F3F8",
  paper: "#F5F7FB",
  white: "#FFFFFF",
  muted: "#687487",
  line: "#E2E7EF",
  danger: "#B9373A",
  warning: "#9A6409",
};

export const fontFamilies = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  extraBold: "PlusJakartaSans-ExtraBold",
};

export function Screen({
  children,
  style,
  safeAreaEdges = ["left", "right", "bottom"],
  ...props
}: PropsWithChildren<ViewProps & { safeAreaEdges?: Edge[] }>) {
  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.screen, style]}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
}

export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#929CAE"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  secondary = false,
  busy = false,
  icon,
  style: customStyle,
  ...props
}: Omit<PressableProps, "style"> & {
  title: string;
  secondary?: boolean;
  busy?: boolean;
  icon?: ReactNode;
} & { style?: StyleProp<ViewStyle> }) {
  const disabled = props.disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        customStyle,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.green : colors.white} />
      ) : (
        <>
          {icon}
          <Text
            style={[styles.buttonText, secondary && styles.buttonTextSecondary]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <View style={[styles.notice, error && styles.noticeError]}>
      <Text style={[styles.noticeText, error && styles.noticeErrorText]}>
        {message}
      </Text>
    </View>
  );
}

export function LoadingView({
  label = "Loading FairRide…",
}: {
  label?: string;
}) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  spacer: { height: 10 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: fontFamilies.bold,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamilies.regular,
  },
  link: {
    color: colors.green,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: fontFamilies.semibold,
  },
  small: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fontFamilies.regular,
  },
  amount: {
    color: colors.greenDark,
    fontSize: 24,
    fontWeight: "800",
    fontFamily: fontFamilies.extraBold,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  heading: { marginBottom: 20 },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    fontFamily: fontFamilies.extraBold,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
    fontFamily: fontFamilies.regular,
  },
  fieldWrap: { marginBottom: 13 },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    fontFamily: fontFamilies.semibold,
  },
  input: {
    minHeight: 48,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fontFamilies.regular,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: colors.mint,
    borderColor: "#D3E2EF",
    borderWidth: 1,
  },
  buttonDisabled: { opacity: 0.58 },
  buttonPressed: { opacity: 0.82 },
  buttonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    fontFamily: fontFamilies.bold,
  },
  buttonTextSecondary: { color: colors.greenDark },
  card: {
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 15,
    backgroundColor: colors.white,
    padding: 15,
    marginBottom: 14,
  },
  notice: {
    backgroundColor: colors.mint,
    borderRadius: 11,
    padding: 12,
    marginBottom: 13,
  },
  noticeError: { backgroundColor: "#FCEAE8" },
  noticeText: { color: colors.greenDark, fontSize: 14, lineHeight: 20 },
  noticeErrorText: { color: colors.danger },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.paper,
  },
});
