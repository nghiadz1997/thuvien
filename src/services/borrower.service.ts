import {
  deleteDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS, DEFAULT_FACULTIES } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import { col, docRef, newDocRef } from "@/lib/firestore";
import type { ActiveStatus, Borrower, BorrowerType } from "@/types";
import { buildSearchText, padNumber } from "@/utils/text";

export interface BorrowerInput {
  fullName: string;
  type: BorrowerType;
  studentCode: string;
  className: string;
  faculty: string;
  email: string;
  phone: string;
  gender?: string;
  dob?: string;
  birthPlace?: string;
  address?: string;
  citizenId?: string;
  status: ActiveStatus;
}

export function normalizeFacultyName(name: string): string {
  const raw = (name || "").trim();
  if (!raw) return "";
  const norm = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\s\-_]/g, "");

  if (norm.includes("cntt") || norm.includes("ktd") || norm.includes("tinhoc") || norm.includes("maytinh") || norm.includes("dohoa") || norm.includes("dien")) {
    return "CNTT-KTD";
  }
  if (norm.includes("cokhi") || norm.includes("oto") || norm.includes("btscoto") || norm.includes("dongluc")) {
    return "Cơ khí";
  }
  if (norm.includes("yduoc") || norm.includes("dieuduong") || norm.includes("duoc") || norm.includes("hosinh")) {
    return "Y Dược";
  }
  if (norm.includes("cssd") || norm.includes("ndt") || norm.includes("sacdep") || norm.includes("thammy") || norm.includes("nguoigia")) {
    return "CSSĐ-NDT";
  }
  if (norm.includes("ktdl") || norm.includes("kinhte") || norm.includes("dulich") || norm.includes("qtkd") || norm.includes("khachsan") || norm.includes("monan")) {
    return "KT-DL";
  }
  if (norm.includes("gddc") || norm.includes("daicuong") || norm.includes("tienganh") || norm.includes("ngoaingu") || norm.includes("vanhoa")) {
    return "GDDC";
  }
  return raw;
}

export function determineFacultyFromClass(className: string): string {
  const c = (className || "").toUpperCase().replace(/[\s\-_]/g, "");

  // 1. Cơ khí
  if (
    c.includes("CNKTCK") ||
    c.includes("CNKTOTO") ||
    c.includes("BTSCOTO") ||
    c.includes("COKHI") ||
    c.includes("OTO") ||
    /CK\d/.test(c) ||
    /CK$/.test(c)
  ) {
    return "Cơ khí";
  }

  // 2. CNTT-KTD (Tin học, Máy tính, Đồ họa, Điện, Cơ điện tử)
  if (
    c.includes("THUD") ||
    c.includes("CNKTMT") ||
    c.includes("TKĐH") ||
    c.includes("TKDH") ||
    c.includes("ĐCN") ||
    c.includes("DCN") ||
    c.includes("ĐCNDD") ||
    c.includes("DCNDD") ||
    c.includes("CNKTCĐT") ||
    c.includes("CNKTCDT") ||
    c.includes("DIEN") ||
    c.includes("IT")
  ) {
    return "CNTT-KTD";
  }

  // 3. Y Dược (Điều dưỡng, Dược, Hộ sinh)
  if (
    c.includes("ĐD") ||
    c.includes("DD") ||
    c.includes("DIEUDUONG") ||
    c.includes("DUOC") ||
    c.includes("HOSINH") ||
    c.includes("HS") ||
    /CĐ\d*A?D\d*/.test(c) ||
    /CD\d*A?D\d*/.test(c) ||
    /TSCĐD\d*/.test(c) ||
    /TSCDD\d*/.test(c)
  ) {
    return "Y Dược";
  }

  // 4. CSSĐ-NDT (Chăm sóc sắc đẹp, Chăm sóc người lớn tuổi, Thẩm mỹ)
  if (
    c.includes("CSSĐ") ||
    c.includes("CSSD") ||
    c.includes("TMCSSĐ") ||
    c.includes("TMCSSD") ||
    c.includes("CSNDT") ||
    c.includes("SACDEP") ||
    c.includes("THAMMY")
  ) {
    return "CSSĐ-NDT";
  }

  // 5. KT-DL (Kinh tế, QTKD, Du lịch, Khách sạn, Bếp món ăn)
  if (
    c.includes("QTKD") ||
    c.includes("KT") ||
    c.includes("HDDL") ||
    c.includes("NVNHKS") ||
    c.includes("QTNHDVAU") ||
    c.includes("KTCBMA") ||
    c.includes("KTDN") ||
    c.includes("DULICH") ||
    c.includes("KHACHSAN")
  ) {
    return "KT-DL";
  }

  // 6. GDDC (Giáo dục đại cương, Tiếng Anh, Ngoại ngữ)
  if (
    c.includes("GDDC") ||
    c.includes("TA") ||
    c.includes("TIENGANH") ||
    c.includes("NGOAINGU") ||
    c.includes("VANHOA") ||
    c.includes("VH")
  ) {
    return "GDDC";
  }

  return "Khác";
}

function searchOf(b: BorrowerInput & { borrowerCode: string }) {
  return buildSearchText(
    b.borrowerCode,
    b.fullName,
    b.studentCode,
    b.className,
    b.faculty,
    b.email,
    b.phone,
    b.gender,
    b.dob,
    b.birthPlace,
    b.address,
    b.citizenId
  );
}

function clean(input: BorrowerInput): BorrowerInput {
  const fac = normalizeFacultyName(input.faculty?.trim() || "") || determineFacultyFromClass(input.className);
  return {
    fullName: input.fullName.trim(),
    type: input.type,
    studentCode: input.studentCode?.trim() || "",
    className: input.className?.trim() || "",
    faculty: fac || "Khác",
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    gender: input.gender?.trim() || "",
    dob: input.dob?.trim() || "",
    birthPlace: input.birthPlace?.trim() || "",
    address: input.address?.trim() || "",
    citizenId: input.citizenId?.trim() || "",
    status: input.status || "active",
  };
}

async function ensureUniqueStudentCode(studentCode: string, exceptId?: string) {
  if (!studentCode) return;
  const snap = await getDocs(query(col(COLLECTIONS.borrowers), where("studentCode", "==", studentCode), limit(2)));
  if (snap.docs.some((d) => d.id !== exceptId)) throw new Error(`MSSV / mã cán bộ "${studentCode}" đã tồn tại.`);
}

/** Tạo người mượn, tự sinh mã NM-000001 bằng bộ đếm (transaction) */
export async function createBorrower(input: BorrowerInput): Promise<string> {
  const data = clean(input);
  if (!data.fullName) throw new Error("Vui lòng nhập họ tên.");
  await ensureUniqueStudentCode(data.studentCode);
  const counterRef = docRef(COLLECTIONS.counters, "borrowers");
  const ref = newDocRef(COLLECTIONS.borrowers);
  await runTransaction(getDb(), async (tx) => {
    const c = await tx.get(counterRef);
    const seq = (c.exists() ? Number(c.data().seq) || 0 : 0) + 1;
    const borrowerCode = `NM-${padNumber(seq, 6)}`;
    if (c.exists()) tx.update(counterRef, { seq });
    else tx.set(counterRef, { seq });
    tx.set(ref, {
      ...data,
      borrowerCode,
      currentBorrowCount: 0,
      searchText: searchOf({ ...data, borrowerCode }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return ref.id;
}

export async function updateBorrower(id: string, borrowerCode: string, input: BorrowerInput) {
  const data = clean(input);
  if (!data.fullName) throw new Error("Vui lòng nhập họ tên.");
  await ensureUniqueStudentCode(data.studentCode, id);
  await updateDoc(docRef(COLLECTIONS.borrowers, id), {
    ...data,
    searchText: searchOf({ ...data, borrowerCode }),
    updatedAt: serverTimestamp(),
  });
}

/** Nhập hàng loạt người mượn (Import danh sách) */
export async function batchImportBorrowers(
  list: BorrowerInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ imported: number; updated: number; skipped: number }> {
  if (!list.length) return { imported: 0, updated: 0, skipped: 0 };

  // 1. Lấy toàn bộ người mượn hiện có để check trùng MSSV
  const snap = await getDocs(col(COLLECTIONS.borrowers));
  const existingByStudentCode = new Map<string, { id: string; borrowerCode: string }>();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.studentCode) {
      existingByStudentCode.set(String(d.studentCode).trim().toLowerCase(), {
        id: doc.id,
        borrowerCode: d.borrowerCode,
      });
    }
  }

  // 2. Lấy seq hiện tại
  const counterRef = docRef(COLLECTIONS.counters, "borrowers");
  let currentSeq = 0;
  await runTransaction(getDb(), async (tx) => {
    const c = await tx.get(counterRef);
    currentSeq = c.exists() ? Number(c.data().seq) || 0 : 0;
  });

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const BATCH_SIZE = 300;
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const chunk = list.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(getDb());

    for (const item of chunk) {
      const data = clean(item);
      if (!data.fullName) {
        skipped++;
        continue;
      }

      const stCodeLower = data.studentCode ? data.studentCode.toLowerCase() : "";
      if (stCodeLower && existingByStudentCode.has(stCodeLower)) {
        // Cập nhật người mượn đã có
        const exist = existingByStudentCode.get(stCodeLower)!;
        const bRef = docRef(COLLECTIONS.borrowers, exist.id);
        batch.update(bRef, {
          ...data,
          searchText: searchOf({ ...data, borrowerCode: exist.borrowerCode }),
          updatedAt: serverTimestamp(),
        });
        updated++;
      } else {
        // Tạo mới
        currentSeq++;
        const borrowerCode = `NM-${padNumber(currentSeq, 6)}`;
        const bRef = newDocRef(COLLECTIONS.borrowers);
        batch.set(bRef, {
          ...data,
          borrowerCode,
          currentBorrowCount: 0,
          searchText: searchOf({ ...data, borrowerCode }),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (stCodeLower) {
          existingByStudentCode.set(stCodeLower, { id: bRef.id, borrowerCode });
        }
        imported++;
      }
    }

    // Cập nhật counter
    batch.set(counterRef, { seq: currentSeq }, { merge: true });
    await batch.commit();
    onProgress?.(Math.min(i + BATCH_SIZE, list.length), list.length);
  }

  return { imported, updated, skipped };
}

/** Chỉ admin; không xóa nếu đang mượn sách */
export async function deleteBorrower(b: Borrower) {
  if ((b.currentBorrowCount ?? 0) > 0) throw new Error("Không thể xóa: người này đang mượn sách.");
  const active = await getDocs(
    query(col(COLLECTIONS.loans), where("borrowerId", "==", b.id), where("status", "==", "borrowing"), limit(1)),
  );
  if (!active.empty) throw new Error("Không thể xóa: người này còn phiếu mượn chưa trả.");
  await deleteDoc(docRef(COLLECTIONS.borrowers, b.id));
}

