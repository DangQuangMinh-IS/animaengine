// src-tauri/src/lib.rs
// Rust Native Core cho Anima Engine: Cửa sổ trong suốt, IPC bridge và vòng lặp cảm biến OS

pub mod sensors;

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use sensors::{is_in_shutdown_zone, DragTracker, TypingCounter};

static DRAG_REQUESTED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn start_drag_tracking() {
    DRAG_REQUESTED.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn log_front(msg: String) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open("F:\\project\\animaengine\\app.log") {
        let _ = writeln!(f, "[Frontend] {}", msg);
    }
}

#[derive(Clone, serde::Serialize)]
struct AlertPayload {
    r#type: String,
}

#[derive(Clone, serde::Serialize)]
struct TypingPayload {
    is_typing: bool,
    count: usize,
}

#[derive(Clone, serde::Serialize)]
struct MousePayload {
    x: i32,
    y: i32,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use std::io::Write;
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("F:\\project\\animaengine\\app.log")
        .and_then(|mut f| writeln!(f, "lib::run() entered"));

    let res = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_drag_tracking, log_front])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open("F:\\project\\animaengine\\app.log") {
                let _ = writeln!(f, "setup() entered");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = writeln!(f, "main window found! is_visible: {:?}", window.is_visible());
                    let _ = window.center();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = writeln!(f, "window.show() called");
                } else {
                    let _ = writeln!(f, "WARNING: main window NOT FOUND in app.get_webview_window('main')");
                }
            }

            let app_handle = app.handle().clone();
            start_sensor_loop(app_handle);

            Ok(())
        })
        .run(tauri::generate_context!());

    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("F:\\project\\animaengine\\app.log")
        .and_then(|mut f| writeln!(f, "Builder::run returned with result: {:?}", res));
}

/// Khởi chạy luồng nền cảm biến hệ thống (OS Sensors Thread)
fn start_sensor_loop(app: AppHandle) {
    thread::spawn(move || {
        let mut drag_tracker = DragTracker::new(Duration::from_millis(60));
        let mut typing_counter = TypingCounter::new(Duration::from_millis(1500), 3);
        let mut last_typing_emit = Instant::now() - Duration::from_secs(5);
        let mut last_panic_emit = Instant::now() - Duration::from_secs(5);
        let mut last_mouse_emit = Instant::now() - Duration::from_secs(5);
        let mut last_mouse_pos = (0i32, 0i32);

        loop {
            thread::sleep(Duration::from_millis(35));
            let now = Instant::now();

            // 1. Kiểm tra sự kiện yêu cầu bắt đầu kéo thả từ frontend
            if DRAG_REQUESTED.swap(false, Ordering::SeqCst) {
                drag_tracker.start(now);
            }

            // Đọc trạng thái vật lý của nút chuột trái (0x01 = VK_LBUTTON)
            let lbutton_down = unsafe {
                (windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(0x01) as u16 & 0x8000) != 0
            };

            // Nếu người dùng vừa thả chuột ra -> Phát tín hiệu kết thúc kéo thả về frontend
            if drag_tracker.update(now, lbutton_down) {
                let _ = app.emit("sensor:drag_ended", ());
            }

            // 2. Đọc kích thước màn hình chính của Windows
            let (screen_w, screen_h) = unsafe {
                let w = windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics(
                    windows_sys::Win32::UI::WindowsAndMessaging::SM_CXSCREEN,
                );
                let h = windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics(
                    windows_sys::Win32::UI::WindowsAndMessaging::SM_CYSCREEN,
                );
                (w, h)
            };

            // 3. Đọc tọa độ con trỏ chuột toàn cục
            let mut pt = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
            let mouse_ok = unsafe {
                windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut pt) != 0
            };

            if mouse_ok {
                // Phát sự kiện di chuyển chuột toàn cục cho 3D Look-at (tối đa ~25Hz)
                if (pt.x != last_mouse_pos.0 || pt.y != last_mouse_pos.1)
                    && last_mouse_emit.elapsed() >= Duration::from_millis(40)
                {
                    last_mouse_emit = Instant::now();
                    last_mouse_pos = (pt.x, pt.y);
                    let _ = app.emit("sensor:mouse", MousePayload { x: pt.x, y: pt.y });
                }

                // Kiểm tra va chạm vùng nút Start / Shutdown
                if is_in_shutdown_zone(pt.x, pt.y, screen_w, screen_h) {
                    if last_panic_emit.elapsed() > Duration::from_millis(2500) {
                        last_panic_emit = Instant::now();
                        let _ = app.emit(
                            "sensor:alert",
                            AlertPayload {
                                r#type: "shutdown_panic".into(),
                            },
                        );
                    }
                }
            }

            // 3. Đo nhịp gõ phím toàn cục (tuyệt đối không lưu keycode, chỉ đếm số lần bấm)
            let mut any_key = false;
            // Quét các phím gõ thông dụng: 0x08 (Backspace) ..= 0x5A (Z), Space (0x20), Enter (0x0D)
            for vk in 0x08..=0x5Au32 {
                let state = unsafe {
                    windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(vk as i32)
                };
                if (state as u16 & 0x0001) != 0 {
                    any_key = true;
                    break;
                }
            }

            let now = Instant::now();
            if any_key {
                typing_counter.record_keystroke(now);
            }

            if typing_counter.is_typing_burst(now) {
                if last_typing_emit.elapsed() > Duration::from_millis(1500) {
                    last_typing_emit = now;
                    let _ = app.emit(
                        "sensor:typing",
                        TypingPayload {
                            is_typing: true,
                            count: typing_counter.count(now),
                        },
                    );
                }
            }
        }
    });
}
