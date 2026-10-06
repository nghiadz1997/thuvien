import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getDb, getFirebaseAuth, withSecondaryAuth } from "@/lib/firebase";
import type { ActiveStatus, Role } from "@/types";

export async function login(email: string, password: string, rememberMe = true) {
  const auth = getFirebaseAuth();
  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  } catch {
    // Ignore if persistence unsupported in current environment
  }
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout() {
  await signOut(getFirebaseAuth());
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/** Đổi mật khẩu: xác thực lại bằng mật khẩu cũ rồi cập nhật */
export async function changePassword(currentPassword: string, newPassword: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user || !user.email) throw new Error("Bạn chưa đăng nhập.");
  if (newPassword.length < 6) throw new Error("Mật khẩu mới tối thiểu 6 ký tự.");
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}

/** User tự đổi tên hiển thị (Security Rules chỉ cho phép sửa fullName) */
export async function updateMyName(uid: string, fullName: string) {
  const name = fullName.trim();
  if (!name) throw new Error("Vui lòng nhập họ tên.");
  await updateDoc(doc(getDb(), COLLECTIONS.users, uid), { fullName: name });
  const u = getFirebaseAuth().currentUser;
  if (u) await updateProfile(u, { displayName: name }).catch(() => undefined);
}

export interface NewUserInput {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}

/**
 * Admin tạo tài khoản: dùng Firebase App phụ để tạo Auth user (không đăng xuất admin),
 * sau đó admin ghi users/{uid} (Security Rules: chỉ admin được tạo).
 */
export async function createUserAccount(input: NewUserInput): Promise<string> {
  if (input.password.length < 6) throw new Error("Mật khẩu tối thiểu 6 ký tự.");
  const uid = await withSecondaryAuth(async (secondaryAuth) => {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password);
    await updateProfile(cred.user, { displayName: input.fullName.trim() }).catch(() => undefined);
    await signOut(secondaryAuth);
    return cred.user.uid;
  });
  await setDoc(doc(getDb(), COLLECTIONS.users, uid), {
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: "active",
    createdAt: serverTimestamp(),
  });
  return uid;
}

export async function updateUserAccount(uid: string, data: { fullName: string; role: Role; status: ActiveStatus }) {
  await updateDoc(doc(getDb(), COLLECTIONS.users, uid), {
    fullName: data.fullName.trim(),
    role: data.role,
    status: data.status,
  });
}
// TODO: Xóa hẳn tài khoản Firebase Auth cần Firebase Admin SDK (Cloud Function / server route có service account).
// Hiện tại admin "Khóa" tài khoản (status = disabled) → Security Rules chặn toàn bộ truy cập dữ liệu.
