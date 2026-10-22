import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "fairride.session.v1";
const API_ORIGIN_KEY = "fairride.api-origin.v1";
const DEFAULT_API_ORIGIN =
  process.env.EXPO_PUBLIC_API_ORIGIN?.trim() || "http://10.0.2.2:3000";

export interface SafeUser {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  email: string | null;
  role: "PASSENGER" | "DRIVER" | "ADMIN" | "SUPER_ADMIN";
  status: string;
  preferredLanguage: string;
  profileImageUrl: string | null;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: SafeUser;
}

export interface FareEstimate {
  currency: "PKR";
  distanceMeters: number;
  durationSeconds: number;
  baseFarePaisa: number;
  distanceFarePaisa: number;
  timeFarePaisa: number;
  categoryMultiplierBasisPoints: number;
  passengerTotalPaisa: number;
  calculationType: "estimate";
  routeSource: string;
  estimateExpiresInSeconds: number;
}

export interface Ride {
  id: string;
  status: string;
  vehicleCategory: "ECONOMY" | "COMFORT" | "XL";
  vehicleType: "CAR" | "BIKE" | "RICKSHAW";
  pickup: {
    latitude: number;
    longitude: number;
    label: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    label: string;
  };
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
  estimatedFarePaisa: number;
  finalFarePaisa: number | null;
  currency: string;
  pickupPin?: string;
}

export interface CreatedRide {
  ride: Ride;
  pickupPin: string;
  fare: FareEstimate;
  routeSource: string;
  offersCreated: number;
  noDriversAvailable: boolean;
}

export interface DriverOffer {
  rideId: string;
  pickupDistanceMeters: number;
  expiresAt: string;
  pickupLabel: string;
  destinationLabel: string;
  estimatedFarePaisa: number;
  currency: string;
  vehicleCategory: "ECONOMY" | "COMFORT" | "XL";
  vehicleType: "CAR" | "BIKE" | "RICKSHAW";
}

export interface DriverProfile {
  userId: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  licenseNumber: string;
  licenseExpiry: string;
  identityVerified: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  vehicles: Vehicle[];
}

export interface Vehicle {
  id: string;
  category: "ECONOMY" | "COMFORT" | "XL";
  vehicleType: "CAR" | "BIKE" | "RICKSHAW";
  make: string;
  model: string;
  modelYear: number;
  registrationNumber: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  color: string;
  passengerCapacity: number;
  documentExpiresAt: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  authenticated?: boolean;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshInFlight: Promise<StoredSession | null> | null = null;

function apiBaseUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "").replace(/\/api\/v1$/, "")}/api/v1`;
}

export function validateApiOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(
      "Enter a valid server URL, for example http://10.0.2.2:3000",
    );
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "/api/v1")
  ) {
    throw new Error(
      "Use a server origin only, such as http://192.168.1.10:3000",
    );
  }
  return apiBaseUrl(parsed.origin);
}

export async function getApiOrigin(): Promise<string> {
  const stored = await SecureStore.getItemAsync(API_ORIGIN_KEY);
  const configured = stored || DEFAULT_API_ORIGIN;
  return validateApiOrigin(configured);
}

export async function setApiOrigin(value: string): Promise<string> {
  const normalized = validateApiOrigin(value);
  const origin = normalized.slice(0, -"/api/v1".length);
  await SecureStore.setItemAsync(API_ORIGIN_KEY, origin);
  return origin;
}

export async function readSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "accessToken" in parsed &&
      "refreshToken" in parsed &&
      "user" in parsed &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.user === "object" &&
      parsed.user !== null
    ) {
      return parsed as StoredSession;
    }
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
  return null;
}

export async function saveSession(
  session: AuthSession,
): Promise<StoredSession> {
  const stored: StoredSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
  };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(stored));
  return stored;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function refreshSession(
  current: StoredSession,
): Promise<StoredSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await send<AuthSession>("/auth/refresh", {
          method: "POST",
          body: { refreshToken: current.refreshToken },
          authenticated: false,
        });
        return await saveSession(response);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession();
          return null;
        }
        throw error;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function send<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const origin = await getApiOrigin();
  const url = `${apiBaseUrl(origin)}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body === undefined
      ? {}
      : { "Content-Type": "application/json" }),
    ...options.headers,
  };
  const authenticated = options.authenticated !== false;
  const session = authenticated ? await readSession() : null;
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "AbortError"
        ? "The server took too long to respond"
        : "Could not reach the API. Check the server URL, Wi-Fi and backend";
    throw new ApiError(detail, 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && session && !path.endsWith("/auth/refresh")) {
    const refreshed = await refreshSession(session);
    if (refreshed) {
      return send<T>(path, options);
    }
  }

  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? Array.isArray(payload.message)
          ? payload.message.join(", ")
          : String(payload.message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return send<T>(path);
}

export function apiPost<T>(
  path: string,
  body: unknown,
  options: Pick<ApiOptions, "authenticated" | "headers"> = {},
): Promise<T> {
  return send<T>(path, { ...options, method: "POST", body });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return send<T>(path, { method: "PATCH", body });
}

export function apiHealth(): Promise<{ status: string }> {
  return send<{ status: string }>("/health/live", { authenticated: false });
}
