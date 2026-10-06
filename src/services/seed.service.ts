import { getDocs, limit, query } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { col, type Actor } from "@/lib/firestore";
import type { BorrowerType } from "@/types";
import { addDays } from "@/utils/format";
import { createBook } from "./book.service";
import { createBorrower } from "./borrower.service";
import { createCategory } from "./category.service";
import { borrowBook, returnBook } from "./loan.service";

/**
 * Tạo dữ liệu mẫu VÀO FIRESTORE THẬT (chỉ admin, dùng để chạy thử).
 * Mọi thao tác đi qua service thật nên đều có transaction log.
 */
export async function seedDemoData(actor: Actor, prefix: string, onProgress?: (msg: string) => void) {
  const existing = await getDocs(query(col(COLLECTIONS.books), limit(1)));
  if (!existing.empty) throw new Error("Đã có dữ liệu sách. Chỉ tạo dữ liệu mẫu khi hệ thống còn trống.");

  onProgress?.("Đang tạo thể loại...");
  const catNames = ["Công nghệ thông tin", "Điện - Điện tử", "Cơ khí", "Kinh tế", "Ngoại ngữ", "Văn học"];
  const catIds: string[] = [];
  for (const name of catNames) catIds.push(await createCategory({ name, description: "", status: "active" }));

  onProgress?.("Đang tạo sách...");
  const books: [string, string, number, string, number, number][] = [
    ["Lập trình C căn bản", "Phạm Văn Ất", 0, "NXB Giáo dục", 2021, 8],
    ["Cấu trúc dữ liệu và giải thuật", "Đỗ Xuân Lôi", 0, "NXB ĐHQG Hà Nội", 2020, 6],
    ["Mạng máy tính", "Nguyễn Thúc Hải", 0, "NXB Giáo dục", 2019, 5],
    ["Kỹ thuật điện tử", "Đỗ Xuân Thụ", 1, "NXB Giáo dục", 2018, 7],
    ["Mạch điện cơ bản", "Phạm Thị Cư", 1, "NXB Giáo dục", 2022, 4],
    ["Vẽ kỹ thuật cơ khí", "Trần Hữu Quế", 2, "NXB Giáo dục", 2017, 6],
    ["Nguyên lý máy", "Đinh Gia Tường", 2, "NXB KH&KT", 2016, 3],
    ["Kinh tế vi mô", "N. Gregory Mankiw", 3, "NXB Kinh tế TP.HCM", 2023, 10],
    ["Nguyên lý kế toán", "Võ Văn Nhị", 3, "NXB Tài chính", 2021, 5],
    ["English Grammar in Use", "Raymond Murphy", 4, "Cambridge", 2019, 12],
    ["Tiếng Anh chuyên ngành CNTT", "Nhiều tác giả", 4, "NXB Lao động", 2020, 2],
    ["Dế mèn phiêu lưu ký", "Tô Hoài", 5, "NXB Kim Đồng", 2020, 4],
  ];
  const bookIds: string[] = [];
  let shelf = 1;
  const facultyMap = [
    "CNTT-KTĐ",
    "CNTT-KTĐ",
    "Cơ khí",
    "KT-DL",
    "GDDC",
    "Khác",
  ];

  for (const [title, author, cat, publisher, year, qty] of books) {
    const r = await createBook(
      {
        title,
        author,
        categoryId: catIds[cat],
        faculty: facultyMap[cat] || "Khác",
        publisher,
        publishYear: year,
        isbn: "",
        dateAdded: new Date(),
        quantity: qty,
        shelfLocation: `K${Math.ceil(shelf / 3)}-T${((shelf - 1) % 3) + 1}`,
        notes: "Dữ liệu mẫu",
      },
      actor,
      prefix,
    );
    bookIds.push(r.id);
    shelf++;
  }

  onProgress?.("Đang tạo người mượn...");
  const people: [string, BorrowerType, string, string, string][] = [
    ["Nguyễn Văn An", "student", "SV24001", "CNTT24A", "CNTT-KTĐ"],
    ["Trần Thị Bình", "student", "SV24002", "CNTT24A", "CNTT-KTĐ"],
    ["Lê Hoàng Cường", "student", "SV24003", "DDT24B", "CNTT-KTĐ"],
    ["Phạm Minh Đức", "student", "SV24004", "CK24A", "Cơ khí"],
    ["Võ Thị Hạnh", "student", "SV24005", "KT24A", "KT-DL"],
    ["Đặng Quốc Huy", "lecturer", "GV0012", "", "CNTT-KTĐ"],
    ["Bùi Thu Trang", "lecturer", "GV0027", "", "GDDC"],
    ["Hồ Văn Tâm", "staff", "NV0005", "", "Y Dược"],
  ];
  const borrowerIds: string[] = [];
  for (const [fullName, type, code, className, faculty] of people) {
    borrowerIds.push(
      await createBorrower({ fullName, type, studentCode: code, className, faculty, email: "", phone: "", status: "active" }),
    );
  }

  onProgress?.("Đang tạo phiếu mượn mẫu...");
  const today = new Date();
  const loanPlan: [number, number, number, number][] = [
    // [book, borrower, mượn cách đây (ngày), số ngày mượn]
    [0, 0, 3, 14],
    [1, 1, 5, 14],
    [7, 4, 20, 14], // quá hạn
    [9, 6, 2, 30],
    [3, 2, 25, 14], // quá hạn
    [0, 5, 1, 30],
  ];
  const loanIds: string[] = [];
  for (const [bi, ri, ago, days] of loanPlan) {
    const borrowDate = addDays(today, -ago);
    loanIds.push(
      await borrowBook({ bookId: bookIds[bi], borrowerId: borrowerIds[ri], borrowDate, dueDate: addDays(borrowDate, days), note: "Dữ liệu mẫu" }, actor),
    );
  }
  onProgress?.("Đang tạo lượt trả mẫu...");
  await returnBook({ loanId: loanIds[3], condition: "normal", returnDate: today, note: "Dữ liệu mẫu" }, actor);
  onProgress?.("Hoàn tất!");
}
