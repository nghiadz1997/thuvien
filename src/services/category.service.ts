import { addDoc, deleteDoc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { col, docRef } from "@/lib/firestore";
import type { ActiveStatus } from "@/types";

export interface CategoryInput {
  name: string;
  description: string;
  status: ActiveStatus;
}

export async function createCategory(input: CategoryInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Vui lòng nhập tên thể loại.");
  const ref = await addDoc(col(COLLECTIONS.categories), { name, description: input.description.trim(), status: input.status });
  return ref.id;
}

export async function updateCategory(id: string, input: CategoryInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Vui lòng nhập tên thể loại.");
  await updateDoc(docRef(COLLECTIONS.categories, id), { name, description: input.description.trim(), status: input.status });
}

export async function deleteCategory(id: string) {
  const used = await getDocs(query(col(COLLECTIONS.books), where("categoryId", "==", id), limit(1)));
  if (!used.empty) throw new Error("Không thể xóa: đang có sách thuộc thể loại này.");
  await deleteDoc(docRef(COLLECTIONS.categories, id));
}
