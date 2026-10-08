# Hướng Dẫn Đóng Gói & Chạy Anima Engine Trên Máy Tính Khác

Tài liệu này cung cấp hướng dẫn đầy đủ để bạn có thể mang ứng dụng **Anima Engine** sang bất kỳ máy tính Windows nào khác để chạy một cách mượt mà và thuận tiện nhất.

---

## 🎯 Phương án 1: Bản Portable Độc Lập (Khuyên Dùng — Nhanh Nhất)

Đây là phương thức thuận tiện nhất cho người dùng thông thường vì **hoàn toàn không cần cài đặt bất kỳ công cụ phát triển nào (Không cần Node.js, không cần Rust, không cần Python)**.

### Cấu trúc gói Portable:
```
AnimaEngine-Portable/
├── animaengine.exe       (Tệp thực thi chính độc lập, đã nhúng toàn bộ 3D models & voice)
├── run.bat               (Kịch bản khởi chạy 1-click chuẩn xác)
├── stop.bat              (Kịch bản đóng ứng dụng nhanh chóng)
└── HUONG_DAN_SU_DUNG.md  (Hướng dẫn tương tác, phím tắt & đổi nhân vật)
```

### Cách mang sang máy khác:
1. Nén thư mục hoặc tải tệp **`AnimaEngine-v1.0.0-Portable-Windows-x64.zip`** từ mục **Releases** trên GitHub:
   👉 **https://github.com/DangQuangMinh-IS/animaengine/releases**
2. Sao chép qua USB, Google Drive, Zalo hoặc Discord sang máy tính mới.
3. Giải nén tệp zip ra thư mục bất kỳ (ví dụ: `C:\AnimaEngine` hoặc Desktop).
4. Nhấp đúp vào **`run.bat`** để khởi chạy mascot ngay lập tức!

---

## 📦 Phương án 2: Bản Cài Đặt Chính Thức (Setup Installer)

Nếu muốn ứng dụng xuất hiện trong Start Menu và có lối tắt trên Desktop:
1. Tải bộ cài đặt:
   - **`animaengine_0.1.0_x64-setup.exe`** (Trình cài đặt NSIS)
   - Hoặc **`animaengine_0.1.0_x64_en-US.msi`** (Windows Installer tiêu chuẩn)
2. Nhấp đúp vào tệp setup để tiến hành cài đặt theo hướng dẫn trên màn hình.
3. Mở ứng dụng từ Start Menu hoặc icon ngoài Desktop.

---

## 🛠️ Phương án 3: Chạy từ Mã Nguồn (Dành cho Lập Trình Viên)

Nếu máy tính đích đã có sẵn môi trường lập trình và bạn muốn chạy trực tiếp từ mã nguồn:

### 1. Yêu cầu môi trường trên máy mới:
- **Git**: `git --version`
- **Node.js (LTS v20+)**: `node -v` & `npm -v`
- **Rust Toolchain**: `rustc --version` & `cargo --version`
  - Cài đặt qua: [https://rustup.rs](https://rustup.rs) (chọn MSVC Toolchain kèm Visual Studio C++ Build Tools).
- **Edge WebView2 Runtime**: Có sẵn trên Windows 10/11.

### 2. Các bước khởi chạy:
```powershell
# 1. Clone mã nguồn dự án
git clone https://github.com/DangQuangMinh-IS/animaengine.git
cd animaengine

# 2. Cài đặt các thư viện Node.js
npm install

# 3. Chạy chế độ phát triển (Development)
npm run tauri dev

# 4. Hoặc đóng gói bản phát hành cục bộ
npm run build:app
```

---

## ⚡ Tự Động Đóng Gói Bằng GitHub Actions (CI/CD)

Dự án đã được tích hợp sẵn luồng tự động hóa đóng gói trên GitHub Actions tại [`.github/workflows/package.yml`](file:///.github/workflows/package.yml).

Mỗi khi bạn muốn tạo một bản đóng gói mới:
1. Vào tab **Actions** trên GitHub: `https://github.com/DangQuangMinh-IS/animaengine/actions`
2. Chọn workflow **"Build & Package Anima Engine"** -> Bấm **Run workflow**.
3. Hệ thống máy chủ Windows của GitHub sẽ tự động:
   - Kiểm tra mã nguồn và chạy toàn bộ unit test.
   - Biên dịch ứng dụng sang mã máy tối ưu.
   - Đóng gói ra bản **Portable Zip** và **Installer (.exe/.msi)**.
   - Xuất bản trực tiếp lên trang Releases để bạn tải về ngay lập tức!
