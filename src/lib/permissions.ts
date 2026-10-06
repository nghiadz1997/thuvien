import type { Role } from "@/types";

/**
 * Phân quyền phía frontend. LƯU Ý: đây chỉ là lớp UX —
 * quyền thực sự được thực thi bởi Firestore Security Rules (firestore.rules).
 */
export type Permission =
  | "view"
  | "book:write"
  | "book:delete"
  | "circulation"
  | "inventory"
  | "borrower:write"
  | "borrower:delete"
  | "category:write"
  | "category:delete"
  | "report:view"
  | "user:manage"
  | "settings:manage"
  | "transaction:delete";

const MATRIX: Record<Role, Permission[]> = {
  admin: [
    "view",
    "book:write",
    "book:delete",
    "circulation",
    "inventory",
    "borrower:write",
    "borrower:delete",
    "category:write",
    "category:delete",
    "report:view",
    "user:manage",
    "settings:manage",
    "transaction:delete",
  ],
  librarian: ["view", "book:write", "circulation", "inventory", "borrower:write", "category:write", "report:view"],
  viewer: ["view", "report:view"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}
