# Hướng Dẫn Sử Dụng Anima Engine (Desktop Mascot Blue Archive)

Anima Engine là ứng dụng Desktop Mascot nhẹ nhàng, hiện đại, hỗ trợ cả 2D Sprite và mô hình 3D tương tác chân thực dành cho Windows.

---

## 🚀 Cách khởi động & Tắt ứng dụng

- **Khởi động**: Nhấp đúp vào tệp [`run.bat`](file:///run.bat) (hoặc trực tiếp [`animaengine.exe`](file:///animaengine.exe)).
- **Tắt ứng dụng**: 
  - Cách 1: Chuột phải vào nhân vật -> Chọn **"❌ Thoát ứng dụng"**.
  - Cách 2: Nhấp đúp vào tệp [`stop.bat`](file:///stop.bat).

---

## 🎮 Các cử chỉ & Tương tác

| Tương tác | Thao tác | Mô tả |
| :--- | :--- | :--- |
| **Xoa đầu / Trò chuyện** | Nhấp chuột trái (Click < 250ms) | Nhân vật phản ứng và phát giọng lồng tiếng ngẫu nhiên. |
| **Khen thưởng (Praise)** | Nhấp đúp chuột trái (Double Click) | Nhân vật biểu cảm vui mừng, kiêu hãnh hoặc nháy mắt fufu. |
| **Nhấc bổng / Di chuyển** | Nhấn giữ chuột trái và kéo | Nhân vật chuyển sang tư thế bị xách lơ lửng, kéo đến bất kỳ vị trí nào trên màn hình. |
| **Chóng mặt (Dizzy Shake)** | Giữ chuột kéo và vung lắc nhanh | Nhân vật kích hoạt biểu cảm hoảng hốt chóng mặt khi bị rung lắc mạnh. |
| **Cảm biến gõ phím nhanh** | Gõ bàn phím nhịp độ cao liên tục | Nhân vật tự động nhảy múa, cổ vũ tinh thần làm việc của bạn! |
| **Cảnh báo Shutdown** | Di chuột lại gần nút Start/Shutdown | Nhân vật phản ứng hốt hoảng níu giữ bạn lại. |
| **Cử chỉ nhàn rỗi (Ambient)** | Không tương tác sau ~26 giây | Nhân vật tự động thực hiện các động tác tự nhiên (đọc sách, uống trà, chào hỏi). |

---

## 👥 Danh sách 8 Nhân vật hỗ trợ sẵn

Nhấp chuột phải vào nhân vật để đổi ngay lập tức:
1. **Sorasaki Hina (2D Chibi)**: Sprite vẽ tay sắc nét, 40 giọng thoại gốc.
2. **Sorasaki Hina - Đầm Dạ Hội (3D)**: Mô hình 3D nguyên bản Blue Archive, tương tác quân lễ và tiệc trà.
3. **Hayase Yuuka - Đồ Ngủ (3D)**: 121 voice lines, thùng kho báu hải tặc cắm kiếm siêu ngộ nghĩnh.
4. **Misono Mika - Công Chúa Trinity (3D)**: 19 voice lines, cánh thiên thần lấp lánh và nụ cười rạng rỡ.
5. **Tendou Arisu - Hầu Gái Dũng Sĩ (3D)**: 11 voice lines, trang phục maid cùng súng Railgun dũng mãnh.
6. **Hanekawa Yuzu - Thùng Game (3D)**: 10 voice lines, nấp trong thùng gỗ chơi game đáng yêu.
7. **Urawa Hanako - Áo Tắm (3D)**: Điệu bộ e ấp, biểu cảm hài hước đặc trưng.
8. **Kurimura Airi - Kem Bạc Hà (3D)**: Vừa ăn kem bạc hà sô cô la vừa học bài chăm chỉ.

---

## ⚙️ Menu Cài đặt & Tinh chỉnh chi tiết

Chuột phải -> Chọn **"⚙️ Cài đặt & Tinh chỉnh..."**:
- **Ánh sáng & Đồ họa**: Chỉnh độ sáng môi trường, ánh sáng chính, tông màu ấm hoàng hôn/hồng anime, khoảng cách Camera Zoom, chất lượng khử răng cưa.
- **Âm thanh & Tương tác**: Chỉnh âm lượng tổng thể (Master Volume), tần suất tự trò chuyện khi nhàn rỗi, độ nhạy chóng mặt khi lắc chuột.
- **Character Studio**: Bộ sưu tập nhân vật và hỗ trợ nạp mô hình 3D `.glb` cùng voice tùy chọn bên ngoài.

---

## 💻 Yêu cầu hệ thống khi chạy trên máy khác
- Hệ điều hành: **Windows 10 / Windows 11 (64-bit)**.
- Đã có sẵn **Microsoft Edge WebView2 Runtime** (hầu hết mọi máy Windows 10/11 hiện nay đều đã tích hợp sẵn).
- Không yêu cầu cài đặt Node.js hay Rust compiler.
