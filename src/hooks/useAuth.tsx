"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { COLLECTIONS, DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import type { Actor } from "@/lib/firestore";
import { can, type Permission } from "@/lib/permissions";
import type { AppUser } from "@/types";
import { resetAllStores } from "./useRealtime";

export type AuthStatus =
  | "loading"
  | "unconfigured" // chưa cấu hình Firebase
  | "signed-out"
  | "disabled" // tài khoản bị khóa
  | "ready";

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: AppUser | null;
  error: string | null;
  actor: Actor | null;
  can: (p: Permission) => boolean;
}

const AUTH_CACHE_KEY = "thuvien_auth_cache";

interface CachedAuth {
  user: { uid: string; email: string | null; displayName: string | null };
  profile: AppUser;
}

function getCachedAuth(): CachedAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedAuth(user: User, profile: AppUser) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedAuth = {
      user: { uid: user.uid, email: user.email, displayName: user.displayName },
      profile,
    };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedAuth() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // Ignore
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cached] = useState<CachedAuth | null>(() => getCachedAuth());
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!isFirebaseConfigured) return "unconfigured";
    if (cached) return "ready";
    return "loading";
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => {
    return (cached?.user as unknown as User) ?? null;
  });
  const [profile, setProfile] = useState<AppUser | null>(() => {
    return cached?.profile ?? null;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsubProfile: (() => void) | null = null;
    let autoInitDone = false;

    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubProfile?.();
      unsubProfile = null;
      setError(null);

      if (!user) {
        clearCachedAuth();
        setFirebaseUser(null);
        setProfile(null);
        setStatus("signed-out");
        resetAllStores();
        return;
      }

      const defaultName = user.displayName || (user.email ? user.email.split("@")[0] : "Quản trị viên");
      const initialProfile: AppUser = {
        id: user.uid,
        fullName: defaultName,
        email: user.email || "",
        role: "admin",
        status: "active",
        createdAt: null,
      };

      setFirebaseUser(user);
      setProfile((prev) => prev || initialProfile);
      setStatus("ready");
      setCachedAuth(user, initialProfile);

      const userDocRef = doc(getDb(), COLLECTIONS.users, user.uid);

      unsubProfile = onSnapshot(
        userDocRef,
        async (snap) => {
          if (!snap.exists()) {
            if (!autoInitDone) {
              autoInitDone = true;
              try {
                await setDoc(
                  userDocRef,
                  {
                    fullName: defaultName,
                    email: user.email || "",
                    role: "admin",
                    status: "active",
                    createdAt: serverTimestamp(),
                  },
                  { merge: true },
                );
                await setDoc(doc(getDb(), COLLECTIONS.settings, "general"), DEFAULT_SETTINGS, { merge: true }).catch(() => undefined);
              } catch (initErr) {
                console.warn("Auto init user profile:", initErr);
              }
            }
            return;
          }

          const p = { id: snap.id, ...snap.data() } as AppUser;
          setProfile(p);
          setCachedAuth(user, p);
          if (p.status === "disabled") {
            setStatus("disabled");
          } else {
            setStatus("ready");
          }
        },
        (err) => {
          console.warn("Firestore user snapshot:", err);
          setStatus("ready");
        },
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.role || "admin";
    return {
      status,
      firebaseUser,
      profile,
      error,
      actor: firebaseUser && profile ? { uid: firebaseUser.uid, name: profile.fullName || profile.email } : null,
      can: (p: Permission) => can(role, p),
    };
  }, [status, firebaseUser, profile, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return ctx;
}

/** Trả về actor (bắt buộc đã đăng nhập) — dùng khi gọi service ghi dữ liệu */
export function useActor(): Actor {
  const { actor } = useAuth();
  return actor ?? { uid: "", name: "" };
}
