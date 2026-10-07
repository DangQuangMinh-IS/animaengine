// src-tauri/src/sensors.rs
// Logic cảm biến hành vi OS: Vị trí chuột, vùng Shutdown và nhịp gõ phím

use std::time::{Duration, Instant};

/// Tính toán góc lượng giác (radian) và khoảng cách từ tâm mascot tới con trỏ chuột
pub fn calculate_angle_and_distance(
    chibi_x: i32,
    chibi_y: i32,
    mouse_x: i32,
    mouse_y: i32,
) -> (f64, f64) {
    let dx = (mouse_x - chibi_x) as f64;
    let dy = (mouse_y - chibi_y) as f64;
    let distance = (dx * dx + dy * dy).sqrt();
    let angle = dy.atan2(dx);
    (angle, distance)
}

/// Kiểm tra xem con trỏ chuột có đang nằm trong "vùng nguy hiểm" (Nút Start / Shutdown ở góc màn hình) hay không
pub fn is_in_shutdown_zone(
    mouse_x: i32,
    mouse_y: i32,
    screen_width: i32,
    screen_height: i32,
) -> bool {
    // Góc dưới bên trái: Nút Start Menu / Power truyền thống của Windows (x <= 90, y >= screen_h - 75)
    let is_bottom_left = mouse_x >= 0 && mouse_x <= 90 && mouse_y >= (screen_height - 75) && mouse_y <= screen_height;
    
    // Windows 11 Taskbar căn giữa: nếu chuột ở sát đáy thanh Taskbar gần nút Windows (tùy chọn)
    let is_taskbar_edge = mouse_x >= 0 && mouse_x <= (screen_width / 4) && mouse_y >= (screen_height - 50);

    is_bottom_left || is_taskbar_edge
}

/// Bộ đếm nhịp gõ phím trượt (Rolling Window Typing Monitor)
/// Đảm bảo quyền riêng tư: Tuyệt đối KHÔNG lưu trữ ký tự phím bấm, chỉ đếm số lần nhấn trong khoảng thời gian trượt.
pub struct TypingCounter {
    timestamps: Vec<Instant>,
    window_duration: Duration,
    burst_threshold: usize,
}

impl TypingCounter {
    pub fn new(window_duration: Duration, burst_threshold: usize) -> Self {
        Self {
            timestamps: Vec::new(),
            window_duration,
            burst_threshold,
        }
    }

    /// Ghi nhận 1 xung nhịp phím bấm
    pub fn record_keystroke(&mut self, now: Instant) {
        self.timestamps.push(now);
        self.cleanup(now);
    }

    /// Dọn dẹp các xung nhịp cũ hơn cửa sổ trượt
    fn cleanup(&mut self, now: Instant) {
        self.timestamps.retain(|&t| now.duration_since(t) <= self.window_duration);
    }

    /// Kiểm tra người dùng có đang gõ phím nhanh liên tục không
    pub fn is_typing_burst(&mut self, now: Instant) -> bool {
        self.cleanup(now);
        self.timestamps.len() >= self.burst_threshold
    }

    pub fn count(&mut self, now: Instant) -> usize {
        self.cleanup(now);
        self.timestamps.len()
    }

    pub fn clear(&mut self) {
        self.timestamps.clear();
    }
}

/// Trình theo dõi trạng thái kéo thả chuột (Mouse Drag Tracker)
/// Duy trì trạng thái nhấc bổng liên tục khi chuột trái đang được nhấn giữ và phát tín hiệu kết thúc ngay khi nhả chuột
pub struct DragTracker {
    is_dragging: bool,
    start_time: Option<Instant>,
    min_check_delay: Duration,
}

impl DragTracker {
    pub fn new(min_check_delay: Duration) -> Self {
        Self {
            is_dragging: false,
            start_time: None,
            min_check_delay,
        }
    }

    pub fn start(&mut self, now: Instant) {
        self.is_dragging = true;
        self.start_time = Some(now);
    }

    pub fn is_dragging(&self) -> bool {
        self.is_dragging
    }

    pub fn stop(&mut self) {
        self.is_dragging = false;
        self.start_time = None;
    }

    /// Cập nhật với trạng thái vật lý của nút chuột trái.
    /// Trả về true nếu người dùng VỪA MỚI nhả chuột kết thúc kéo thả.
    pub fn update(&mut self, now: Instant, lbutton_down: bool) -> bool {
        if !self.is_dragging {
            return false;
        }

        if let Some(st) = self.start_time {
            if now.duration_since(st) < self.min_check_delay {
                return false;
            }
        }

        if !lbutton_down {
            self.is_dragging = false;
            self.start_time = None;
            return true;
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_angle_and_distance() {
        let (angle, dist) = calculate_angle_and_distance(100, 100, 100, 150);
        assert!((dist - 50.0).abs() < 1e-4);
        assert!((angle - std::f64::consts::FRAC_PI_2).abs() < 1e-4);

        let (angle_h, dist_h) = calculate_angle_and_distance(0, 0, 10, 0);
        assert!((dist_h - 10.0).abs() < 1e-4);
        assert!((angle_h - 0.0).abs() < 1e-4);
    }

    #[test]
    fn test_is_in_shutdown_zone() {
        let screen_w = 1920;
        let screen_h = 1080;

        // Chuột ở góc Start Menu (30, 1050) -> Báo động
        assert!(is_in_shutdown_zone(30, 1050, screen_w, screen_h));

        // Chuột ở góc dưới cùng (10, 1075) -> Báo động
        assert!(is_in_shutdown_zone(10, 1075, screen_w, screen_h));

        // Chuột ở giữa màn hình (960, 540) -> An toàn
        assert!(!is_in_shutdown_zone(960, 540, screen_w, screen_h));

        // Chuột ở góc trên bên phải (1900, 20) -> An toàn
        assert!(!is_in_shutdown_zone(1900, 20, screen_w, screen_h));
    }

    #[test]
    fn test_typing_counter_burst() {
        let mut counter = TypingCounter::new(Duration::from_millis(1000), 3);
        let start = Instant::now();

        // 2 lần gõ -> Chưa đạt ngưỡng 3
        counter.record_keystroke(start);
        counter.record_keystroke(start + Duration::from_millis(100));
        assert!(!counter.is_typing_burst(start + Duration::from_millis(150)));

        // Lần gõ thứ 3 trong cùng 1s -> Kích hoạt Burst!
        counter.record_keystroke(start + Duration::from_millis(200));
        assert!(counter.is_typing_burst(start + Duration::from_millis(250)));

        // Sau 1.5s không gõ nữa -> Hết burst
        assert!(!counter.is_typing_burst(start + Duration::from_millis(1500)));
    }

    #[test]
    fn test_drag_tracker_lifecycle() {
        let mut tracker = DragTracker::new(Duration::from_millis(50));
        let start = Instant::now();

        // Ban đầu chưa kéo
        assert!(!tracker.is_dragging());
        assert!(!tracker.update(start, true));

        // Bắt đầu kéo thả
        tracker.start(start);
        assert!(tracker.is_dragging());

        // Trong thời gian min_check_delay (20ms), dù chuột nhả cũng chưa tính (tránh race condition)
        assert!(!tracker.update(start + Duration::from_millis(20), false));
        assert!(tracker.is_dragging());

        // Sau 100ms, chuột vẫn đang nhấn giữ (lbutton_down = true) -> Vẫn tiếp tục kéo
        assert!(!tracker.update(start + Duration::from_millis(100), true));
        assert!(tracker.is_dragging());

        // Sau 500ms, người dùng nhả chuột (lbutton_down = false) -> Kéo thả kết thúc!
        assert!(tracker.update(start + Duration::from_millis(500), false));
        assert!(!tracker.is_dragging());

        // Các tick tiếp theo không phát tín hiệu kết thúc lặp lại
        assert!(!tracker.update(start + Duration::from_millis(600), false));
    }
}
