import {
  collection,
  doc,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "./firebase";

/** Người thực hiện thao tác — được ghi vào createdBy của transaction */
export interface Actor {
  uid: string;
  name: string;
}

export function col(name: string) {
  return collection(getDb(), name);
}

export function docRef(name: string, id: string) {
  return doc(getDb(), name, id);
}

export function newDocRef(name: string) {
  return doc(collection(getDb(), name));
}

export function snapToData<T extends { id: string }>(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): T {
  return { id: snap.id, ...(snap.data() ?? {}) } as T;
}
