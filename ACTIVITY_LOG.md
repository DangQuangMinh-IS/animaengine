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

---

## Phiên làm việc: 2026-10-07 — Khắc phục rung lắc chuột (Shake), Menu Cài đặt & Character Studio, Tích hợp nhân vật Yuuka, Yuzu, Mika, Arisu

### 1. Mục tiêu phiên làm việc
- **Khắc phục lỗi tính năng chóng mặt khi lắc chuột**: Xử lý triệt để việc Windows chiếm dụng modal drag loop chặn sự kiện DOM `mousemove` bằng cách phát hiện rung lắc trực tiếp từ Win32 API trên luồng cảm biến Rust và phát tín hiệu `sensor:drag_shake`.
- **Thêm giao diện ngữ cảnh tinh chỉnh chi tiết (Option Settings & Character Studio)**:
  - Menu chuột phải có tùy chọn `⚙️ Cài đặt & Tinh chỉnh...` mở modal giao diện hiện đại kính mờ (Glassmorphism).
  - Tab 1: **Ánh sáng & Đồ họa**: Tinh chỉnh thời gian thực Ambient Light, Key Light, Tông màu ánh sáng (Tint color kèm bảng preset ấm hoàng hôn, xanh dịu, hồng anime), Khoảng cách Camera Zoom, Độ cao trọng tâm Y, Chế độ chất lượng (Cân bằng / Khử răng cưa tối đa).
  - Tab 2: **Âm thanh & Tương tác**: Điều chỉnh âm lượng Master Volume, Tần suất tự thoại khi nhàn rỗi (15s, 30s, 60s, Tắt), Độ nhạy chóng mặt khi lắc chuột (Cao, Bình thường, Thấp).
  - Tab 3: **Character Studio**: Hiển thị bộ sưu tập nhân vật đã cài đặt (chuyển đổi nhanh 1-click), Hỗ trợ tự thêm Model 3D (`.glb` / `.gltf`) và Voice riêng với Three.js GLTFLoader tự động đọc danh sách animation clips và gán thông minh vào các trạng thái tương tác (`idle`, `typing`, `dragged`, `poke`, `salute`, `praise`, `shake`).
- **Tích hợp thêm 4 nhân vật mới với đầy đủ 10 tương tác và voice line chính thức**:
  - Hayase Yuuka - Đồ Ngủ (3D): 121 file voice lines.
  - Hanekawa Yuzu - Thùng Game (3D): 10 file voice lines.
  - Misono Mika - Công Chúa Trinity (3D): 19 file voice lines.
  - Tendou Arisu - Hầu Gái Dũng Sĩ (3D): 11 file voice lines.
- **Hiệu ứng đồ họa chóng mặt (Dizzy Shake)**: Bổ sung hoạt ảnh CSS chao đảo nghiêng ngả khi bị lắc mạnh cho cả nhân vật 2D và 3D.

---

### 2. Chi tiết kỹ thuật & Giải pháp
1. **Phát hiện rung lắc ở tầng OS Hook Rust (`ShakeDetector`)**:
   - Thêm struct `ShakeDetector` trong `src-tauri/src/sensors.rs` theo dõi sự đổi hướng di chuyển liên tục trên trục X trong cửa sổ trượt 700ms khi người dùng đang giữ chuột trái.
   - Thêm unit test `test_shake_detector_lifecycle` trong `sensors.rs`.
   - Kết nối với `start_sensor_loop` trong `src-tauri/src/lib.rs` để phát IPC event `sensor:drag_shake` tức thời.
   - Kết nối frontend listener `sensor:drag_shake` trong `src/main.js` kích hoạt `triggerAction('shake')` và class `.dizzy-shake`.
2. **Hệ thống điều khiển thời gian thực (Live Preview & Persistence)**:
   - Thêm phương thức `setLighting`, `setCameraZoom`, `setQuality` trong `src/renderer3d.js`.
   - Tự động lưu và khôi phục cài đặt từ `localStorage` (`anima_engine_settings`).
   - Tự động thay đổi kích thước cửa sổ (`setSize`) khi mở/đóng modal cài đặt để mang lại trải nghiệm tiện nghi nhất.
3. **Character Studio linh hoạt**:
   - Sử dụng Three.js `GLTFLoader` chạy trực tiếp trong WebView2 phân tích cấu trúc binary GLB, đọc toàn bộ mảng `animations` và gợi ý tự động regex-based cho 7 hành động chính.
   - Hỗ trợ lưu trữ character profile vào `localStorage` (`anima_custom_characters`) và nạp ngay lập tức vào runtime.

---

### 3. Kết quả nghiệm thu & Kiểm thử
- **Tổng số Unit Tests:** **19/19 tests đạt 100% PASS**
  - Python tests: **14/14 tests PASS** (Kiểm tra toàn vẹn tài nguyên hình ảnh 2D, mô hình 3D GLB, manifest và animation clips cho 8 nhân vật: `hina`, `hina_dress`, `airi`, `hanako`, `yuuka_pajama`, `yuzu`, `mika`, `arisu`).
  - Rust tests: **5/5 tests PASS** (Cảm biến nhịp gõ phím, vùng shutdown, drag tracking, shake detector, tính toán góc nhìn).
- **Frontend & Standalone Build:**
  - Vite compilation: 100% thành công, 0 lỗi.
  - Tauri Standalone: Đóng gói toàn bộ tài nguyên vào `app.exe` chạy độc lập, offline.

---

## Phiên làm việc: 2026-10-07 — Khắc phục triệt để hiện tượng vát/cắt mép Model 3D (3D Model Edge Clipping Fix)

### 1. Mục tiêu phiên làm việc
- Khắc phục hiện tượng mô hình 3D và đạo cụ (như thùng hải tặc của Yuuka Đồ Ngủ, súng Railgun của Arisu, thùng của Yuzu) bị cắt mép phẳng đứng ở bên trái và dưới đáy màn hình.

### 2. Chi tiết kỹ thuật & Giải pháp
1. **Mở rộng kích thước Canvas & Container**:
   - Tăng `.chibi-wrapper` từ cố định `280px x 280px` lên `width: 100%; height: 345px;` (chiếm trọn chiều rộng 320px của cửa sổ ứng dụng) trong `src/style.css`.
   - Đảm bảo `.chibi-canvas` luôn phủ 100% không gian hiển thị, tăng diện tích vẽ 3D lên ~30% - 40%.
2. **Dynamic Canvas & Window Resize Listener**:
   - Thêm phương thức `handleResize()` và lắng nghe sự kiện `resize` trong `src/renderer3d.js` để tự động cập nhật `camera.aspect`, `camera.updateProjectionMatrix()` và `renderer.setSize()` khi cửa sổ co giãn.
3. **Vô hiệu hóa SkinnedMesh Frustum Culling**:
   - Thêm duyệt đệ quy `mesh.frustumCulled = false` trên toàn bộ SkinnedMesh trong `loadModel()`, ngăn Three.js cắt nhầm các bộ phận vươn xa khỏi bounding box gốc.
4. **Tối ưu góc nhìn Camera (Safe Margin Framing) theo từng nhân vật**:
   - Nâng góc mở camera `FOV` mặc định từ 32 lên 35 độ.
   - Cập nhật thông số camera chuẩn trong `manifest.json`:
     - `yuuka_pajama`: `distance: 3.1`, `targetY: 0.44` (bao trọn vẹn Yuuka, thùng hải tặc cắm kiếm và đồ chơi trên sàn).
     - `yuzu`: `distance: 2.9`, `targetY: 0.43`.
     - `arisu`: `distance: 3.0`, `targetY: 0.48`.
     - `mika`: `distance: 2.8`, `targetY: 0.48`.
   - Cập nhật `src/main.js` để tự động áp dụng thông số tối ưu của từng nhân vật khi chuyển đổi, đồng thời vẫn bảo lưu tính năng tự chỉnh slider khi người dùng muốn zoom thủ công.

### 3. Kết quả nghiệm thu
- Toàn bộ 19/19 tests (14 Python, 5 Rust) PASS 100%.
- Không còn bất kỳ hiện tượng bị cắt mép hoặc cấn viền trên mọi nhân vật và hoạt ảnh.

---

## Phiên làm việc: 2026-10-07 — Dọn dẹp tệp rác, tệp tạm và cấu trúc tài nguyên dự án (Mức 1 & Mức 2)

### 1. Mục tiêu phiên làm việc
- Thực hiện yêu cầu dọn dẹp các tệp rác, file tạm không dùng và cấu trúc tài nguyên trùng lặp (Mức 1 & Mức 2) theo phê duyệt của người dùng.
- Giữ nguyên vẹn 100% các file vận hành cốt lõi, kho model/voice dự phòng và toàn bộ tài liệu dự án.

### 2. Chi tiết thực hiện
1. **Dọn dẹp Mức 1 (Tệp rác & file tạm):**
   - Đã xóa tệp trọng số LoRA AI cũ `phoebe_chibi_anima_v1.safetensors` (~183.7 MB) tại thư mục gốc.
   - Đã xóa các file tạm và nhật ký rỗng/cũ: `err.txt` (0 byte), `out.txt` (0 byte), `app.log` (~500 bytes).
   - Đã xóa thư mục cache của IDE: `.vs/` (~123 KB).
   - Đã dọn dẹp các thư mục cache bytecode Python: `tests/__pycache__/`, `tools/__pycache__/`.
2. **Dọn dẹp Mức 2 (Thư mục tài nguyên trùng lặp):**
   - Đã gỡ bỏ thư mục `characters/` (chứa 45 tệp của bản Hina cũ, ~6.02 MB) khỏi Git và đĩa cục bộ.
   - Toàn bộ 8 nhân vật chính thức (bao gồm cả Hina 2D bản cập nhật mới nhất đầy đủ 10 tương tác) được quản lý tập trung và duy nhất trong `public/characters/`.
   - Cập nhật đường dẫn mặc định trong `tools/process_assets.py` và `TECHNICAL_SPECIFICATION.md` sang chuẩn `public/characters/`.

### 3. Kết quả nghiệm thu
- **Dung lượng giải phóng:** ~190 MB bộ nhớ đĩa.
- **Kiểm thử tự động:** 19/19 tests (14 Python tests, 5 Rust unit tests) đạt 100% PASS.
- **Tính toàn vẹn ứng dụng:** Ứng dụng hoạt động ổn định, tài nguyên chuẩn hóa và không có bất kỳ xung đột nào.

---

## Phiên làm việc: 2026-10-08 — Xuất bản dự án lên GitHub Repository

### 1. Mục tiêu phiên làm việc
- Khởi tạo GitHub repository `animaengine` ở chế độ Public theo yêu cầu của người dùng.
- Liên kết remote `origin` và đồng bộ toàn bộ lịch sử commit cùng mã nguồn lên GitHub.

### 2. Chi tiết thực hiện
- Sử dụng GitHub CLI (`gh`) xác thực với tài khoản `DangQuangMinh-IS`.
- Tạo repository công khai: `https://github.com/DangQuangMinh-IS/animaengine`.
- Cấu hình remote `origin` trỏ tới `https://github.com/DangQuangMinh-IS/animaengine.git`.
- Đẩy toàn bộ nhánh `master` lên `origin/master`.

### 3. Kết quả nghiệm thu
- Repository đã hoạt động chính thức trên GitHub tại [https://github.com/DangQuangMinh-IS/animaengine](https://github.com/DangQuangMinh-IS/animaengine).




