"""
tools/process_assets.py
Công cụ tự động hóa xử lý ảnh render từ LoRA:
1. Tách nền trắng thành nền trong suốt (RGBA Transparent) với kỹ thuật feathering mềm mại.
2. Tách lớp tròng mắt (pupil.png) và khuôn mặt rỗng hốc mắt (base.png) cho tính năng Eye Tracking.
3. Đồng bộ hóa vào cấu trúc thư mục characters/phoebe_chibi/ và tạo manifest.json chuẩn.
"""

from __future__ import annotations
import os
import json
from pathlib import Path
from PIL import Image, ImageFilter


def remove_white_background(
    img: Image.Image,
    threshold: int = 240,
    feather_radius: int = 2
) -> Image.Image:
    """
    Chuyển đổi các pixel nền trắng/gần trắng (RGB > threshold) thành trong suốt.
    Hỗ trợ làm mềm viền (feathering) để loại bỏ răng cưa trắng.
    """
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()

    # Tạo mask: 0 (trong suốt) cho nền trắng, 255 (rõ) cho chủ thể
    def calc_alpha(r_val, g_val, b_val):
        # Tính khoảng cách độ sáng tới màu trắng tinh (255, 255, 255)
        diff = max(255 - r_val, 255 - g_val, 255 - b_val)
        if diff < (255 - threshold):
            return 0
        elif diff < (255 - threshold + 20):
            # Vùng chuyển tiếp mềm mại
            return int(255 * (diff - (255 - threshold)) / 20)
        return 255

    # Vectorized alpha mapping
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            pr, pg, pb, pa = pixels[x, y]
            diff = max(255 - pr, 255 - pg, 255 - pb)
            if diff < (255 - threshold):
                pixels[x, y] = (pr, pg, pb, 0)
            elif diff < (255 - threshold + 20):
                alpha = int(255 * (diff - (255 - threshold)) / 20)
                pixels[x, y] = (pr, pg, pb, alpha)

    return rgba


def extract_eyes_layers(
    idle_img: Image.Image,
    pupil_box: tuple[int, int, int, int] | None = None
) -> tuple[Image.Image, Image.Image]:
    """
    Tách ảnh idle thành base.png (mặt rỗng hốc mắt) và pupil.png (cặp tròng mắt).
    Nếu không truyền pupil_box, hàm sẽ ước lượng vùng mắt ở trung tâm phần trên của đầu.
    """
    width, height = idle_img.size
    base = idle_img.copy()

    if pupil_box is None:
        # Ước lượng vùng mắt mặc định cho chibi (ở khoảng 35% - 50% chiều cao)
        pupil_box = (
            int(width * 0.25),
            int(height * 0.35),
            int(width * 0.75),
            int(height * 0.52)
        )

    # Cắt vùng tròng mắt
    pupil = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pupil_crop = idle_img.crop(pupil_box)
    pupil.paste(pupil_crop, pupil_box)

    # Làm mờ/rỗng vùng tròng mắt trên base để chừa chỗ cho pupil di chuyển
    base_pixels = base.load()
    x1, y1, x2, y2 = pupil_box
    for y in range(y1, y2):
        for x in range(x1, x2):
            pr, pg, pb, pa = base_pixels[x, y]
            # Giữ nguyên viền mặt và lông mi, chỉ xóa phần tròng mắt màu tím đậm/sáng
            if pa > 0 and (pr < 200 or pb > 100):
                base_pixels[x, y] = (pr, pg, pb, 0)

    return base, pupil


def generate_manifest(output_dir: Path) -> dict:
    """Tạo cấu hình manifest.json chuẩn cho Phoebe Chibi"""
    manifest = {
        "id": "phoebe_chibi",
        "name": "Phoebe (Wuthering Waves)",
        "version": "1.0.0",
        "author": "AnimaEngine",
        "scale": 1.0,
        "states": {
            "idle": {
                "asset": "animations/idle.png",
                "loop": True
            },
            "typing": {
                "asset": "animations/typing.png",
                "loop": True,
                "dialogues": [
                    "Cố lên chủ nhân! (★ω★)",
                    "Chủ nhân gõ phím nhanh quá!",
                    "Em luôn ở đây cổ vũ cho người!"
                ]
            },
            "panic_shutdown": {
                "asset": "animations/panic.png",
                "dialogues": [
                    "Đừng tắt máy mà hu hu! (っ- ‸ - ς)",
                    "Cho em ở lại chơi thêm xíu đi!",
                    "Chủ nhân ơi đừng rời xa em..."
                ]
            },
            "dragged": {
                "asset": "animations/dragged.png"
            }
        },
        "eye_tracking": {
            "enabled": True,
            "base_sprite": "animations/eyes/base.png",
            "pupil_sprite": "animations/eyes/pupil.png",
            "pupil_anchor": {"x": 150, "y": 140},
            "max_radius": 10
        }
    }
    
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    return manifest


def process_character_pack(
    raw_images_dir: Path,
    output_dir: Path
) -> None:
    """
    Xử lý toàn bộ ảnh thô và đưa vào thư mục nhân vật characters/phoebe_chibi/
    """
    anim_dir = output_dir / "animations"
    eyes_dir = anim_dir / "eyes"
    anim_dir.mkdir(parents=True, exist_ok=True)
    eyes_dir.mkdir(parents=True, exist_ok=True)

    required_names = ["idle", "typing", "panic", "dragged"]
    for name in required_names:
        input_file = raw_images_dir / f"{name}.png"
        if input_file.exists():
            img = Image.open(input_file)
            transparent_img = remove_white_background(img)
            target_path = anim_dir / f"{name}.png"
            transparent_img.save(target_path, "PNG")
            print(f"[OK] Da xu ly trong suot: {target_path}")

            if name == "idle":
                base, pupil = extract_eyes_layers(transparent_img)
                base.save(eyes_dir / "base.png", "PNG")
                pupil.save(eyes_dir / "pupil.png", "PNG")
                print(f"[OK] Da boc tach trong mat: {eyes_dir / 'base.png'} & {eyes_dir / 'pupil.png'}")

    generate_manifest(output_dir)
    print(f"[OK] Da tao file manifest: {output_dir / 'manifest.json'}")


if __name__ == "__main__":
    import sys
    base_path = Path(__file__).resolve().parent.parent
    raw_dir = base_path / "raw_assets"
    out_dir = base_path / "characters" / "phoebe_chibi"
    
    if len(sys.argv) > 2:
        raw_dir = Path(sys.argv[1])
        out_dir = Path(sys.argv[2])

    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    process_character_pack(raw_dir, out_dir)
