"use client";

import { useSyncExternalStore } from "react";
import { doc, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { COLLECTIONS, DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import { col, snapToData } from "@/lib/firestore";
import type { Book, Borrower, Category, Loan, Settings } from "@/types";
import { errorMessage } from "@/utils/errors";

export interface StoreState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function getLocalCache<T>(key: string, fallback: T): { data: T; hasCached: boolean } {
  if (typeof window === "undefined") return { data: fallback, hasCached: false };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: fallback, hasCached: false };
    const parsed = JSON.parse(raw);
    return { data: parsed, hasCached: true };
  } catch {
    return { data: fallback, hasCached: false };
  }
}

function setLocalCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota limits
  }
}

/**
 * Store realtime dùng chung (onSnapshot) với Fast Cache (0ms latency).
 * Giữ dữ liệu trong localStorage để nạp tức thì ngay khi mở trang,
 * sau đó tự động cập nhật thời gian thực từ Firestore trong nền.
 */
class RealtimeStore<T> {
  private state: StoreState<T>;
  private listeners = new Set<() => void>();
  private unsub: Unsubscribe | null = null;

  constructor(
    private readonly cacheKey: string,
    private readonly initial: T,
    private readonly start: (set: (data: T) => void, fail: (err: unknown) => void) => Unsubscribe,
  ) {
    const cached = getLocalCache(cacheKey, initial);
    this.state = {
      data: cached.data,
      loading: !cached.hasCached,
      error: null,
    };
  }

  private emit(next: StoreState<T>) {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  private ensureStarted() {
    if (this.unsub) return;
    try {
      this.unsub = this.start(
        (data) => {
          setLocalCache(this.cacheKey, data);
          this.emit({ data, loading: false, error: null });
        },
        (err) => {
          console.warn(`RealtimeStore [${this.cacheKey}] notice:`, err);
          // Vẫn giữ lại dữ liệu trong cache nếu có
          this.emit({ ...this.state, loading: false, error: null });
          this.unsub?.();
          this.unsub = null;
        },
      );
    } catch (err) {
      console.warn(`RealtimeStore [${this.cacheKey}] start error:`, err);
      this.emit({ ...this.state, loading: false, error: null });
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.ensureStarted();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  retry = () => {
    this.unsub?.();
    this.unsub = null;
    this.emit({ ...this.state, loading: true, error: null });
    this.ensureStarted();
  };

  reset() {
    this.unsub?.();
    this.unsub = null;
    const cached = getLocalCache(this.cacheKey, this.initial);
    this.state = { data: cached.data, loading: !cached.hasCached, error: null };
    this.listeners.forEach((l) => l());
  }
}

const SERVER_SNAPSHOT_CACHE = new WeakMap<object, StoreState<unknown>>();

function useStore<T>(store: RealtimeStore<T>): StoreState<T> & { retry: () => void } {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, () => {
    let s = SERVER_SNAPSHOT_CACHE.get(store);
    if (!s) {
      s = store.getSnapshot();
      SERVER_SNAPSHOT_CACHE.set(store, s);
    }
    return s as StoreState<T>;
  });
  return { ...state, retry: store.retry };
}

const booksStore = new RealtimeStore<Book[]>("thuvien_cache_books", [], (set, fail) =>
  onSnapshot(col(COLLECTIONS.books), (snap) => set(snap.docs.map((d) => snapToData<Book>(d))), fail),
);

const categoriesStore = new RealtimeStore<Category[]>("thuvien_cache_cats", [], (set, fail) =>
  onSnapshot(
    col(COLLECTIONS.categories),
    (snap) => set(snap.docs.map((d) => snapToData<Category>(d)).sort((a, b) => a.name.localeCompare(b.name, "vi"))),
    fail,
  ),
);

const borrowersStore = new RealtimeStore<Borrower[]>("thuvien_cache_borrowers", [], (set, fail) =>
  onSnapshot(
    col(COLLECTIONS.borrowers),
    (snap) => set(snap.docs.map((d) => snapToData<Borrower>(d)).sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))),
    fail,
  ),
);

const activeLoansStore = new RealtimeStore<Loan[]>("thuvien_cache_loans", [], (set, fail) =>
  onSnapshot(
    query(col(COLLECTIONS.loans), where("status", "==", "borrowing")),
    (snap) => set(snap.docs.map((d) => snapToData<Loan>(d)).sort((a, b) => (a.dueDate?.toMillis() ?? 0) - (b.dueDate?.toMillis() ?? 0))),
    fail,
  ),
);

const settingsStore = new RealtimeStore<Settings>("thuvien_cache_settings", DEFAULT_SETTINGS, (set, fail) =>
  onSnapshot(
    doc(getDb(), COLLECTIONS.settings, "general"),
    (snap) => set({ ...DEFAULT_SETTINGS, ...(snap.exists() ? (snap.data() as Partial<Settings>) : {}) }),
    fail,
  ),
);

export const useBooks = () => useStore(booksStore);
export const useCategories = () => useStore(categoriesStore);
export const useBorrowers = () => useStore(borrowersStore);
export const useActiveLoans = () => useStore(activeLoansStore);
export const useSettings = () => useStore(settingsStore);

export function resetAllStores() {
  [booksStore, categoriesStore, borrowersStore, activeLoansStore, settingsStore].forEach((s) => s.reset());
}
