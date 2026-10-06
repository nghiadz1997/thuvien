/** Chuyển lỗi Firebase/JS thành thông báo tiếng Việt dễ hiểu */
export function errorMessage(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  const map: Record<string, string> = {
    "permission-denied": "Không đủ quyền thực hiện thao tác này.",
    "firestore/permission-denied": "Không đủ quyền thực hiện thao tác này.",
    unavailable: "Lỗi kết nối tới máy chủ. Vui lòng kiểm tra mạng.",
    "firestore/unavailable": "Lỗi kết nối tới máy chủ. Vui lòng kiểm tra mạng.",
    "deadline-exceeded": "Hết thời gian chờ kết nối.",
    "failed-precondition": "Thiếu index hoặc điều kiện truy vấn không hợp lệ.",
    aborted: "Dữ liệu vừa bị thay đổi bởi người khác, vui lòng thử lại.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/wrong-password": "Mật khẩu không đúng.",
    "auth/user-not-found": "Không tìm thấy tài khoản.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/too-many-requests": "Thử quá nhiều lần. Vui lòng đợi rồi thử lại.",
    "auth/network-request-failed": "Lỗi kết nối mạng.",
    "auth/email-already-in-use": "Email đã được sử dụng.",
    "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
    "auth/requires-recent-login": "Vui lòng đăng nhập lại để thực hiện thao tác này.",
    "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa.",
    "storage/unauthorized": "Không đủ quyền tải ảnh lên.",
  };
  if (code && map[code]) return map[code];
  if (err instanceof Error && err.message) return err.message;
  return "Đã xảy ra lỗi không xác định.";
}

export function isPermissionError(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  return code.includes("permission-denied");
}
