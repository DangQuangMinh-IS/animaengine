// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let _ = std::fs::write("F:\\project\\animaengine\\app.log", format!("PANIC: {:?}", info));
    }));
    let _ = std::fs::write("F:\\project\\animaengine\\app.log", "main() started\n");
    app_lib::run();
}
