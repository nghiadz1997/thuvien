import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Cấu hình Firebase được đọc từ biến môi trường (KHÔNG hardcode).
 * Xem file .env.example.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

export const isStorageEnabled =
  isFirebaseConfigured &&
  Boolean(firebaseConfig.storageBucket) &&
  process.env.NEXT_PUBLIC_ENABLE_STORAGE === "true";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function ensureConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase chưa được cấu hình. Vui lòng thiết lập biến môi trường (xem .env.example).");
  }
}

export function getFirebaseApp(): FirebaseApp {
  ensureConfigured();
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    const a = getFirebaseApp();
    if (typeof window !== "undefined") {
      try {
        db = initializeFirestore(a, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        db = getFirestore(a);
      }
    } else {
      db = getFirestore(a);
    }
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

/**
 * App phụ dùng để admin tạo tài khoản mới mà KHÔNG làm đăng xuất phiên admin hiện tại
 * (createUserWithEmailAndPassword sẽ tự đăng nhập user mới trên instance Auth được dùng).
 */
export async function withSecondaryAuth<T>(fn: (secondaryAuth: Auth) => Promise<T>): Promise<T> {
  ensureConfigured();
  const name = `secondary-${Date.now()}`;
  const secondary = initializeApp(firebaseConfig, name);
  try {
    return await fn(getAuth(secondary));
  } finally {
    await deleteApp(secondary).catch(() => undefined);
  }
}
