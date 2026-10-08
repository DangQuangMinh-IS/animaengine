# Anima Engine 🌸

> **Động cơ Desktop Mascot Hybrid 2D / 3D thế hệ mới dành cho Windows**  
> Xây dựng bằng công nghệ hiện đại **Tauri v2 + Rust + Three.js + Vite** với mức tiêu thụ tài nguyên siêu tiết kiệm (RAM < 50MB, CPU idle ~0%).

---

## ✨ Tính Năng Nổi Bật

- **Đồ họa Hybrid 2D/3D đỉnh cao**:
  - Hỗ trợ sprite vẽ tay 2D tinh tế và mô hình 3D nguyên bản Blue Archive với đầy đủ khung xương hoạt ảnh mượt mà 60fps.
  - Tích hợp 8 nhân vật được yêu thích: **Hina (2D & 3D Đầm Dạ Hội), Yuuka (Đồ Ngủ), Mika (Công Chúa Trinity), Arisu (Hầu Gái), Yuzu (Thùng Game), Hanako (Áo Tắm), Airi (Kem Bạc Hà)**.
- **Cảm biến hệ thống thông minh (OS-level Native Sensors)**:
  - Cảm biến tốc độ gõ phím nhanh (Typing Burst) kích hoạt mascot nhảy múa cổ vũ.
  - Cảm biến tiệm cận góc màn hình / nút Shutdown kích hoạt trạng thái hốt hoảng níu giữ.
  - Cảm biến rung lắc chuột (Shake Detector) nhận diện hành vi lắc mạnh kích hoạt chóng mặt.
  - Tự động thực hiện cử chỉ tự nhiên khi nhàn rỗi (Ambient Fidgets: đọc sách, uống trà, chào hỏi).
- **Hệ thống tương tác phong phú**:
  - Nhấp chuột xoa đầu phát âm thanh lồng tiếng gốc phong phú (hơn 200+ voice lines).
  - Nhấp đúp chuột để khen thưởng (Praise).
  - Nhấn giữ chuột trái để nhấc bổng lơ lửng và kéo thả đến mọi vị trí trên màn hình.
- **Menu Cài đặt & Character Studio**:
  - Tùy chỉnh ánh sáng thời gian thực, zoom camera, chất lượng khử răng cưa, âm lượng và độ nhạy rung lắc.
  - Cho phép người dùng tự nạp mô hình 3D `.glb` và voice lines riêng vào mascot.

---

## 🚀 Đóng Gói & Chạy Trên Máy Khác

Xem hướng dẫn chi tiết tại:  
👉 **[Hướng Dẫn Chạy Trên Máy Khác (HUONG_DAN_CAI_DAT_MAY_KHAC.md)](file:///HUONG_DAN_CAI_DAT_MAY_KHAC.md)**  
👉 **[Hướng Dẫn Sử Dụng & Tương Tác (HUONG_DAN_SU_DUNG.md)](file:///HUONG_DAN_SU_DUNG.md)**

### Tóm tắt nhanh:
1. **Dành cho người dùng (Chạy ngay không cần cài đặt)**:
   - Tải bản **`AnimaEngine-v1.0.0-Portable-Windows-x64.zip`** từ mục [Releases](https://github.com/DangQuangMinh-IS/animaengine/releases).
   - Giải nén và nhấp đúp vào file `run.bat` để thưởng thức mascot!
2. **Dành cho lập trình viên**:
   ```bash
   git clone https://github.com/DangQuangMinh-IS/animaengine.git
   cd animaengine
   npm install
   npm run tauri dev
   ```

---

## 🧪 Kiểm Thử & Nghiệm Thu

Dự án được bảo vệ bởi bộ kiểm thử tự động toàn diện:
```bash
# Chạy kiểm thử Python (Assets, Models, Packaging)
python -m unittest discover tests

# Chạy kiểm thử Rust (Sensors, Win32 Hooks)
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 📄 Bản Quyền & Giấy Phép
Dự án được phát triển phi thương mại vì mục đích học tập và giải trí cá nhân. Bản quyền hình ảnh, mô hình và âm thanh nhân vật thuộc về **NEXON Games** và **Yostar**.
