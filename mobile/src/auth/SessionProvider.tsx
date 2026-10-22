import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  apiGet,
  apiPost,
  ApiError,
  clearSession,
  AuthSession,
  readSession,
  SafeUser,
  saveSession,
} from "../api/client";

interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: "PASSENGER" | "DRIVER";
}

interface LoginInput {
  identifier: string;
  password: string;
}

interface SessionContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  signIn(input: LoginInput): Promise<SafeUser>;
  signUp(input: RegisterInput): Promise<void>;
  reloadUser(): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reloadUser = useCallback(async () => {
    const current = await readSession();
    if (!current) {
      setUser(null);
      return;
    }
    try {
      const account = await apiGet<SafeUser>("/auth/me");
      setUser(account);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        setUser(null);
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    readSession()
      .then(async (current) => {
        if (!current) return null;
        try {
          return await apiGet<SafeUser>("/auth/me");
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await clearSession();
            return null;
          }
          throw error;
        }
      })
      .then((account) => {
        if (mounted) setUser(account);
      })
      .catch((error: unknown) => {
        console.error("Unable to restore FairRide session", error);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [reloadUser]);

  const signIn = useCallback(async (input: LoginInput) => {
    const session = await apiPost<AuthSession>("/auth/login", input, {
      authenticated: false,
    });
    await saveSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  const signUp = useCallback(async (input: RegisterInput) => {
    const session = await apiPost<AuthSession>("/auth/register", input, {
      authenticated: false,
    });
    await saveSession(session);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiPost<void>("/auth/logout", {});
    } finally {
      await clearSession();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signUp, reloadUser, signOut }),
    [user, isLoading, signIn, signUp, reloadUser, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
