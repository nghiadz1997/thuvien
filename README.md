# Hệ Thống Quản Lý Thư Viện Nội Bộ - Cao Đẳng Bách Khoa Nam Sài Gòn

Hệ thống quản lý thư viện hiện đại, giao diện tiếng Việt thân thiện, tối ưu cho máy tính và máy tính bảng (tablet), hỗ trợ máy quét mã vạch USB (Keyboard HID) và in tem mã vạch Code 128.

---

## 🌟 Tính Năng Nổi Bật

1. **Dashboard Tổng Quan Thời Gian Thực:**
   - 8 Thẻ chỉ số: Tổng đầu sách, Tổng số cuốn, Sách hiện còn, Đang mượn, Quá hạn, Hư, Mất, Mới nhập trong tháng.
   - 5 Biểu đồ tương tác: Lưu thông theo tháng, Phân bố thể loại, Top 10 sách mượn nhiều nhất.
   - Bảng tổng hợp giao dịch gần nhất, sách quá hạn, sách sắp hết kho.
2. **Quản Lý Sách & Tồn Kho Toàn Diện:**
   - Tìm kiếm tiếng Việt thông minh, lọc theo thể loại, kệ, trạng thái.
   - In tem mã vạch Code 128 chuẩn trường học kích thước 60mm x 35mm.
   - Điều chỉnh kho linh hoạt (báo hư, mất, phục hồi, thanh lý).
   - Kiểm tra ràng buộc mượn/trả trước khi xóa.
3. **Nhập Sách Đa Phương Thức:**
   - Thêm đầu sách mới tự động sinh mã `NSG-BK-YYYY-XXXXXX` và barcode Code 128.
   - Nhập bổ sung số lượng cho sách cũ qua máy quét Barcode.
   - Import hàng loạt từ file Excel có kiểm tra lỗi và bản xem trước (Preview).
4. **Hỗ Trợ Máy Quét Barcode USB (Keyboard HID):**
   - Nhận diện máy quét cắm cổng USB, tự động focus và xử lý khi quét xong.
   - Hiệu ứng âm thanh (Web Audio API) Beep báo thành công / lỗi / cảnh báo.
   - Chống quét trùng lặp và debounce tối ưu.
5. **Mượn & Trả Sách Nhanh:**
   - Giao dịch nguyên tử (Firestore Transaction) đảm bảo tính toàn vẹn số lượng kho.
   - Tính toán số ngày trễ hạn tự động.
   - Ghi nhận trạng thái trả: Bình thường / Hư hỏng / Báo mất.
6. **Kiểm Kê Thư Viện (Inventory):**
   - Chế độ quét liên tục (Continuous Scan) cho phép kiểm đếm hàng trăm cuốn sách nhanh chóng.
   - Tự động so khớp số lượng thực tế với dữ liệu hệ thống, chỉ ra sách thiếu, dư thừa.
7. **Lịch Sử Giao Dịch & Báo Cáo:**
   - Mọi biến động kho đều lưu vết vào bộ sưu tập `transactions`.
   - Lọc báo cáo theo ngày, tháng, quý, năm và xuất file Excel (.xlsx) đa dạng.
8. **Phân Quyền & Bảo Mật:**
   - 3 Vai trò: **Admin** (Quản trị viên), **Librarian** (Thủ thư), **Viewer** (Người xem).
   - Quy tắc bảo mật Firestore Rules bảo vệ dữ liệu ở tầng cơ sở dữ liệu.

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai

### Bước 1: Cài đặt Dependencies

```bash
npm install
```

### Bước 2: Tạo Firebase Project & Cấu hình dịch vụ

1. Truy cập [Firebase Console](https://console.firebase.google.com/) và tạo project mới.
2. **Authentication:**
   - Vào mục **Build** > **Authentication** > **Get started**.
   - Bật phương thức đăng nhập **Email/Password**.
3. **Cloud Firestore:**
   - Vào mục **Build** > **Firestore Database** > **Create database**.
   - Chọn vị trí máy chủ (ví dụ: `asia-southeast1` hoặc `asia-east1`).
4. **Firebase Storage** *(Tùy chọn nếu cần upload ảnh bìa)*:
   - Vào mục **Build** > **Storage** > **Get started**.

### Bước 3: Cấu hình biến môi trường

1. Tạo file `.env.local` từ mẫu `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
2. Lấy thông tin cấu hình từ **Project settings** > **General** > **Your apps** > **Web app** (`</>`) trên Firebase Console và điền vào `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_ENABLE_STORAGE=false
```

### Bước 4: Triển khai Firestore Security Rules

Triển khai nội dung file `firestore.rules` lên Firebase Console:
- Vào **Firestore Database** > **Rules** > Dán toàn bộ nội dung từ file `firestore.rules` và bấm **Publish**.

Hoặc sử dụng Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

### Bước 5: Chạy ứng dụng môi trường phát triển

```bash
npm run dev
```
Truy cập ứng dụng tại `http://localhost:3000`.

### Bước 6: Khởi tạo Quản trị viên đầu tiên & Dữ liệu mẫu

1. Tại Firebase Console > **Authentication** > **Users** > Bấm **Add user** và tạo tài khoản email/mật khẩu đầu tiên.
2. Mở `http://localhost:3000/login`, đăng nhập bằng tài khoản vừa tạo.
3. Hệ thống sẽ tự động chuyển sang màn hình **Thiết lập Quản trị viên ban đầu (Bootstrap Admin)**.
4. Nhập họ tên của bạn và bấm **Kích hoạt Quản trị viên**.
5. Sau khi vào Dashboard, bạn có thể vào **Cài đặt** > Bấm **Nạp dữ liệu mẫu vào Firestore** để thử nghiệm ngay hệ thống với các đầu sách và phiếu mượn thực tế.

---

## 🌐 Triển khai lên Vercel (Production)

1. Đẩy mã nguồn lên GitHub/GitLab.
2. Truy cập [Vercel](https://vercel.com) > **Add New** > **Project** > Import repository.
3. Trong phần **Environment Variables**, thêm toàn bộ các biến trong file `.env.local`.
4. Bấm **Deploy**.

---

## 📁 Cấu Trúc Mã Nguồn

```
src/
├── app/                  # Next.js App Router Pages
│   ├── (auth)/login/     # Trang đăng nhập, đổi mật khẩu & bootstrap admin
│   ├── books/            # Quản lý sách & chi tiết sách [id]
│   ├── circulation/      # Mượn & Trả sách qua máy quét Barcode
│   ├── import/           # Thêm sách, bổ sung số lượng, import Excel
│   ├── inventory/        # Kiểm kê thư viện & chế độ quét nhanh
│   ├── borrowers/        # Quản lý sinh viên/giảng viên mượn sách
│   ├── transactions/     # Lịch sử giao dịch & biến động kho
│   ├── reports/          # Báo cáo tổng hợp, xuất Excel & PDF
│   ├── categories/       # Danh mục thể loại chuyên ngành
│   ├── users/            # Quản lý tài khoản & phân quyền
│   ├── settings/         # Cài đặt hệ thống & nạp dữ liệu mẫu
│   └── dashboard/        # Dashboard tổng quan trực quan
├── components/
│   ├── barcode/          # Component BarcodeScannerInput, Code128 SVG, Tem in
│   ├── layout/           # AppShell, Sidebar, Header, Providers
│   └── ui/               # Button, Card, Table, Modal, Badge, Form controls
├── hooks/                # useAuth, useRealtime, useTable, useBookLookup, useAsync
├── lib/                  # firebase.ts, constants.ts, permissions.ts, firestore.ts
├── services/             # book, loan, borrower, transaction, report, inventory, auth
├── types/                # TypeScript Interfaces
└── utils/                # text, sound, format, excel, integrity, errors, cn
```
