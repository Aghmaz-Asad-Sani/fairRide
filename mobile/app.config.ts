import type { ExpoConfig } from "expo/config";

const production =
  process.env.APP_ENV === "production" ||
  process.env.EAS_BUILD_PROFILE === "production" ||
  process.env.NODE_ENV === "production";

const config = {
  name: "FairRide",
  slug: "fairride",
  version: "1.0.0",
  scheme: "fairride",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/images/icon.png",
    resizeMode: "contain",
    backgroundColor: "#F5F7FB",
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: !production,
        },
      },
    ],
    [
      "expo-secure-store",
      {
        configureAndroidBackup: true,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "pk.fairride.app",
  },
  android: {
    package: "pk.fairride.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
} satisfies ExpoConfig & {
  splash: {
    image: string;
    resizeMode: "contain";
    backgroundColor: string;
  };
};

export default config;
