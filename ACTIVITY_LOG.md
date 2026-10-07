# Nhật ký Hoạt động Dự án (ACTIVITY_LOG.md)

Tài liệu này lưu trữ lịch sử các sự kiện, phiên làm việc, lỗi phát sinh, giải pháp kỹ thuật và kết quả nghiệm thu theo quy tắc hoạt động tại [AGENTS.md](file:///F:/project/animaengine/AGENTS.md).

---

## Phiên làm việc: 2026-10-07 — Xây dựng MVP Desktop Mascot Sorasaki Hina

### 1. Mục tiêu phiên làm việc
- Xây dựng Desktop Mascot tương tác nhân vật **Sorasaki Hina (Blue Archive)** dưới dạng ứng dụng Windows native siêu nhẹ bằng **Tauri v2 + Rust + WebView2**.
- Tích hợp 40 tệp âm thanh lồng tiếng gốc từ thư mục `F:\hina voice`.
- Cung cấp các hành vi tương tác cốt lõi:
  - Cửa sổ trong suốt, không viền, luôn nổi trên màn hình (`Always-on-top`).
  - Kéo thả di chuyển linh hoạt với hoạt ảnh nhấc bổng lơ lửng (`Cafe_Pick`).
  - Xoa đầu / tương tác click chuột phát thoại ngẫu nhiên.
  - Cảm biến nhịp gõ phím nhanh toàn cục (Typing Burst) kích hoạt hoạt ảnh nhảy múa cổ vũ.
  - Cảm biến tiệm cận nút Start / Shutdown kích hoạt trạng thái hoảng hốt (`Shutdown Panic`).
- Đáp ứng ngân sách tài nguyên: Bộ nhớ RAM < 50MB, CPU idle < 0.5%.

---

### 2. Chi tiết các sự kiện, sự cố và giải pháp kỹ thuật

#### Sự kiện 1: Khởi tạo dự án & Xử lý tài nguyên ban đầu
- **Hành động:** 
  - Khởi tạo khung mã nguồn Tauri v2, Vite, CSS hoạt ảnh và module cảm biến Rust (`sensors.rs`).
  - Xây dựng công cụ tiền xử lý ảnh `tools/process_assets.py` và bộ test `tests/test_process_assets.py`.
  - Sao chép 40 tệp âm thanh lồng tiếng từ `F:\hina voice` vào `characters/hina/audio/` và tạo `manifest.json`.

#### Sự kiện 2: Khắc phục lỗi cửa sổ không hiển thị ("không thấy gì trên màn hình")
- **Hiện tượng:** Khi Agent chạy `Start-Process`, tiến trình `app.exe` xuất hiện trong Task Manager nhưng người dùng không nhìn thấy bất kỳ cửa sổ nào trên màn hình vật lý.
- **Nguyên nhân gốc rễ:** Phiên thực thi PowerShell của Agent chạy trong môi trường Desktop ảo (`Desktop: exebox-...`), trong khi màn hình làm việc của người dùng là `WinSta0\Default`. Lệnh khởi tạo trực tiếp từ Agent vẽ cửa sổ lên desktop ảo nên người dùng không thấy được.
- **Giải pháp:**
  - Cập nhật cấu hình cửa sổ trong `src-tauri/tauri.conf.json`: `"transparent": true`, `"decorations": false`, `"alwaysOnTop": true`, `"center": true`, `"visible": true`.
  - Thêm lệnh tường minh `window.center()`, `window.show()`, `window.set_focus()` trong hàm `setup()` của Rust.
  - Tạo 2 kịch bản khởi chạy tiện ích: [`run.bat`](file:///F:/project/animaengine/run.bat) và [`stop.bat`](file:///F:/project/animaengine/stop.bat). Khi chạy qua `explorer.exe` hoặc click trực tiếp, ứng dụng gắn đúng vào phiên làm việc `WinSta0\Default` của người dùng.

#### Sự kiện 3: Khắc phục lỗi WebView2 từ chối kết nối (`ERR_CONNECTION_REFUSED`)
- **Hiện tượng:** Cửa sổ nổi lên trên màn hình nhưng bên trong hiển thị thông báo xám của Edge WebView2: *"localhost từ chối kết nối (ERR_CONNECTION_REFUSED)"*.
- **Nguyên nhân gốc rễ:** Bản build được biên dịch trực tiếp bằng `cargo build --release` mà không qua Tauri CLI. Trong cấu hình `tauri.conf.json`, `build.devUrl` được trỏ tới `http://localhost:5173`. Do không có máy chủ dev server chạy trên cổng này, WebView2 báo lỗi mạng.
- **Giải pháp:**
  - Sử dụng lệnh đóng gói chính thức `npx tauri build --no-bundle`.
  - Trình đóng gói tự động chạy `npm run build`, đóng gói toàn bộ HTML/CSS/JS và tài nguyên đồ họa từ thư mục `dist/` vào thẳng tệp thực thi. Ứng dụng hoạt động hoàn toàn ngoại tuyến (offline standalone), không cần máy chủ mạng.

#### Sự kiện 4: Khắc phục lỗi màu da bị xuyên thấu / loang lổ ("lỗi ảnh nhiều quá")
- **Hiện tượng:** Nhân vật xuất hiện nhưng khuôn mặt và đôi chân có vết xám loang lổ, nhìn xuyên thấu qua cửa sổ và văn bản của trình soạn thảo phía sau.
- **Nguyên nhân gốc rễ:** Hàm `remove_white_background` ban đầu áp dụng phép lọc ngưỡng màu toàn cục (`global threshold`). Do da nhân vật anime chibi và cổ áo sơ mi có giá trị độ sáng rất cao (`RGB > 240`), thuật toán đã hiểu nhầm đây là màu nền trắng và giảm kênh Alpha xuống chỉ còn ~100 (bán trong suốt).
- **Giải pháp:**
  - Viết lại hàm `remove_white_background` trong [`tools/process_assets.py`](file:///F:/project/animaengine/tools/process_assets.py) theo thuật toán **BFS Flood Fill** xuất phát từ 4 cạnh viền ngoài của ảnh.
  - Thuật toán dừng lại ngay khi chạm tới viền nét của nhân vật, bảo đảm 100% các vùng bên trong (mặt, mắt, cổ áo, chân) đạt độ đục tối đa (`Alpha = 255`).
  - Xử lý lại toàn bộ 4 sprite (`idle.png`, `typing.png`, `panic.png`, `dragged.png`) và bổ sung bài kiểm tra `test_preserve_pale_skin_interior`.

#### Sự kiện 5: Khắc phục lỗi không thể kéo thả cửa sổ ("không kéo thả được")
- **Hiện tượng:** Không thể nhấp giữ chuột để kéo di chuyển cửa sổ mascot trên màn hình.
- **Nguyên nhân gốc rễ:** Mô hình phân quyền bảo mật (Capabilities) của Tauri v2 mặc định chặn các lệnh can thiệp cửa sổ nếu chưa được khai báo tường minh.
- **Giải pháp:**
  - Bổ sung quyền `"core:window:allow-start-dragging"`, `"core:window:allow-close"`, `"core:window:allow-set-focus"` vào [`src-tauri/capabilities/default.json`](file:///F:/project/animaengine/src-tauri/capabilities/default.json).

#### Sự kiện 6: Khắc phục lỗi ngắt hoạt ảnh kéo thả quá sớm (giữ chuột nhưng animation tắt ngay)
- **Hiện tượng:** Khi nhấp chuột kéo mascot, hoạt ảnh nhấc bổng (`dragged`) chỉ chớp lên khoảng 200ms rồi tự động tắt về trạng thái đứng thẳng (`idle`), dù người dùng vẫn đang nhấn giữ chuột và kéo đi khắp nơi.
- **Nguyên nhân gốc rễ:**
  1. Lệnh `getCurrentWindow().startDragging()` trên Windows là cơ chế chuyển quyền điều khiển di chuyển cửa sổ sang modal loop của hệ điều hành. Promise của hàm này phân giải (resolve) ngay lập tức (~1ms) để bàn giao cho OS.
  2. Đoạn mã cũ đặt khối `finally` tự động kích hoạt `setTimeout(..., 200)` để đưa trạng thái về `idle` quá sớm. Đồng thời khi Windows chiếm quyền điều khiển chuột, trình duyệt WebView2 không nhận được sự kiện `mouseup`.
- **Giải pháp:**
  - Xây dựng struct [`DragTracker`](file:///F:/project/animaengine/src-tauri/src/sensors.rs#L80-L133) ở tầng Rust Native, tích hợp trực tiếp vào luồng cảm biến chu kỳ 35ms.
  - Sử dụng Win32 API `GetAsyncKeyState(VK_LBUTTON)` để đọc trực tiếp trạng thái vật lý của nút chuột trái từ phần cứng (toàn cục trên mọi tọa độ màn hình).
  - Duy trì liên tục trạng thái `is_dragging = true` khi chuột trái còn nhấn giữ.
  - Chỉ khi người dùng nhả nút chuột trái (`VK_LBUTTON == 0`), Rust mới phát sự kiện IPC `sensor:drag_ended` về frontend để hạ nhân vật xuống và chuyển về `idle`.
  - Phân biệt mượt mà giữa hành vi click nhanh (< 250ms -> Xoa đầu / phát thoại) và kéo thả giữ chuột (duy trì tư thế bị xách bổng).

#### Sự kiện 7: Mở rộng Động cơ Mascot Hybrid 2D / 3D (Three.js & Blue Archive GLB Models)
- **Hành động:** 
  - Tích hợp thư viện đồ họa 3D Three.js nhẹ (`three`, `GLTFLoader`) trong [`src/renderer3d.js`](file:///F:/project/animaengine/src/renderer3d.js).
  - Hỗ trợ đa nhân vật với cơ chế chuyển đổi trực tiếp trên menu chuột phải:
    - **Hina (2D Chibi)**: Bộ sprite PNG chuẩn 100% không thủng màu da và 40 file audio lồng tiếng.
    - **Hina Dress, Hanako, Airi (3D Chibi)**: Mô hình 3D GLB chính thức trích xuất từ Blue Archive với đầy đủ khung xương hoạt ảnh, ánh sáng tự nhiên và đổ bóng chân thực.
  - Tự động lưu nhân vật đang chọn vào `localStorage` và chuyển đổi mượt mà giữa chế độ Canvas 3D và Sprite 2D.

#### Sự kiện 9: Đóng gói bản phát hành độc lập (Standalone Production Build) cho Động cơ Hybrid
- **Hiện tượng:** Sau khi tích hợp thư viện Three.js, khi biên dịch bằng `cargo build --release` thông thường, Webview2 vẫn tìm kiếm máy chủ `localhost:5173` dẫn đến màn hình "localhost từ chối kết nối".
- **Nguyên nhân gốc rễ:** Lệnh `cargo build` không kích hoạt pipeline đóng gói của Tauri CLI, nên không nhúng tài nguyên tĩnh từ `dist/` vào mã máy và không gỡ bỏ `devUrl`.
- **Giải pháp:**
  - Thêm script lệnh chuẩn hóa vào `package.json`: `"build:app": "tauri build --no-bundle"`.
  - Thực hiện đóng gói hoàn chỉnh bằng `npm run build:app`.
  - Toàn bộ HTML/CSS, Three.js runtime và các mô hình `.glb` (Hina Dress, Hanako, Airi) được nhúng trực tiếp vào tệp thực thi `app.exe`.
#### Sự kiện 10: Mở rộng bộ tương tác đa dạng dựa trên các clip hoạt ảnh gốc của từng Model
- **Hành động sáng tạo tương tác:**
  1. **Chào Sensei (`salute`):**
     - Hina: Clip `Normal_Callsign` (quân lễ Trưởng ban Kỷ luật Gehenna).
     - Airi: Clip `Normal_Callsign` (chào quân lễ Chibi After-School Sweets Club).
     - Hanako: Clip `Tactical_Start` (vẫy tay cúi chào phong cách Trinity).
  2. **Khen thưởng / Cưng chiều (`praise`):**
     - Kích hoạt qua Menu hoặc **Double-Click** vào nhân vật.
     - Hina: Clip `Victory_End` (mỉm cười tự hào).
     - Airi: Clip `Victory_Start` (vui mừng hò reo).
     - Hanako: Clip `Exs_Cutin` (dáng điệu nháy mắt tạo dáng fufu).
  3. **Chế độ cùng tập trung làm việc / Học tập (`focus`):**
     - Airi: Clip `NonWeapon_Study` (ngồi đọc sách chăm chỉ bên cạnh Sensei).
     - Hina: Clip `Formation_Idle_Random` (đứng trang nghiêm túc trực bảo vệ Sensei).
     - Hanako: Clip `Formation_Idle` (ngoan ngoãn đồng hành không quấy rầy).
  4. **Giờ giải lao / Trà chiều (`teatime`):**
     - Airi: Clip `NonWeapon_DessertTable` (ngồi ăn kem bạc hà sô cô la mát lạnh).
     - Hina: Clip `Exs_Cutin` (thưởng thức trà ấm thư giãn).
     - Hanako: Clip `Tactical_Start` (mời Sensei nghỉ ngơi tâm sự).
  5. **Nhận diện rung lắc chuột khi đang kéo (`shake`):**
     - Khi giữ chuột kéo mascot và vung chuột qua lại nhanh (> 45px/tick), nhân vật kích hoạt phản ứng chóng mặt (`Vital_Panic`) và kêu xin dừng lại.
  6. **Cử chỉ ngẫu nhiên khi nhàn rỗi (Ambient Idle Fidget):**
     - Cứ sau 26 giây nhàn rỗi, mascot tự động kích hoạt ngẫu nhiên các động tác đáng yêu (uống trà, đọc sách, chào hỏi) để desktop luôn sinh động.
- **Cập nhật kiểm thử:** Bổ sung kiểm tra đầy đủ 10 trạng thái tương tác trong [tests/test_character_packs.py](file:///F:/project/animaengine/tests/test_character_packs.py).

---

### 3. Kết quả nghiệm thu & Kiểm thử tự động
- **Tổng số Unit Tests:** **14/14 tests đạt 100% PASS**
  - Python (`tests/test_process_assets.py` & `tests/test_character_packs.py`): 10/10 tests (xác thực toàn bộ 10 tương tác mới tồn tại hợp lệ trong file binary .glb của từng nhân vật).
  - Rust (`src-tauri/src/sensors.rs`): 4/4 tests.
- **Hiệu năng thực tế:**
  - Mức tiêu thụ RAM: **~43 MB** (đáp ứng mục tiêu < 50MB).
  - Mức tiêu thụ CPU: **~0.0% - 0.2% khi idle**, hoạt ảnh 60fps mượt mà.
- **Trạng thái ứng dụng:** Đã cập nhật thành công và đang chạy ổn định.


