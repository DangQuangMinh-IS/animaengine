"""
tests/test_process_assets.py
Unit tests cho bộ công cụ tiền xử lý asset tools/process_assets.py
"""

import unittest
import shutil
import tempfile
from pathlib import Path
from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.process_assets import (
    remove_white_background,
    extract_eyes_layers,
    generate_manifest,
    process_character_pack,
)


class TestProcessAssets(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.raw_dir = self.temp_dir / "raw"
        self.out_dir = self.temp_dir / "output"
        self.raw_dir.mkdir()
        self.out_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_remove_white_background(self):
        # Tạo ảnh mẫu: Nền trắng, ở giữa là một hình tròn màu xanh/tím (nhân vật)
        img = Image.new("RGB", (100, 100), (255, 255, 255))
        pixels = img.load()
        for y in range(40, 60):
            for x in range(40, 60):
                pixels[x, y] = (120, 80, 200)  # Tím chibi

        res = remove_white_background(img, threshold=240)
        self.assertEqual(res.mode, "RGBA")

        # Kiểm tra góc ngoài là trong suốt hoàn toàn (Alpha = 0)
        corner_pixel = res.getpixel((0, 0))
        self.assertEqual(corner_pixel[3], 0)

        # Kiểm tra tâm hình tròn giữ nguyên độ đục (Alpha = 255)
        center_pixel = res.getpixel((50, 50))
        self.assertEqual(center_pixel[3], 255)
        self.assertEqual(center_pixel[0], 120)

    def test_preserve_pale_skin_interior(self):
        # Tạo ảnh mẫu: Nền trắng, bao quanh bởi viền đen, bên trong là màu da trắng hồng (251, 240, 234)
        img = Image.new("RGB", (100, 100), (255, 255, 255))
        pixels = img.load()
        for i in range(30, 71):
            pixels[i, 30] = (20, 20, 20)
            pixels[i, 70] = (20, 20, 20)
            pixels[30, i] = (20, 20, 20)
            pixels[70, i] = (20, 20, 20)
        for y in range(31, 70):
            for x in range(31, 70):
                pixels[x, y] = (251, 240, 234)

        res = remove_white_background(img, threshold=238)
        # Nền ngoài phải trong suốt
        self.assertEqual(res.getpixel((0, 0))[3], 0)
        # Vùng da bên trong KHÔNG ĐƯỢC bị trong suốt
        face_pixel = res.getpixel((50, 50))
        self.assertEqual(face_pixel[3], 255)
        self.assertEqual(face_pixel[:3], (251, 240, 234))

    def test_extract_eyes_layers(self):
        # Tạo ảnh mẫu mô phỏng khuôn mặt
        img = Image.new("RGBA", (100, 100), (255, 220, 200, 255))
        base, pupil = extract_eyes_layers(img, pupil_box=(30, 40, 70, 60))

        self.assertEqual(base.size, (100, 100))
        self.assertEqual(pupil.size, (100, 100))

        # Pupil bên ngoài box phải trong suốt
        self.assertEqual(pupil.getpixel((10, 10))[3], 0)

    def test_generate_manifest(self):
        manifest = generate_manifest(self.out_dir)
        self.assertEqual(manifest["id"], "phoebe_chibi")
        self.assertIn("idle", manifest["states"])
        self.assertIn("panic_shutdown", manifest["states"])
        self.assertTrue((self.out_dir / "manifest.json").exists())

    def test_process_character_pack(self):
        # Tạo 4 ảnh thô giả lập
        for name in ["idle", "typing", "panic", "dragged"]:
            img = Image.new("RGB", (64, 64), (255, 255, 255))
            # Vẽ một điểm màu nhận diện
            img.putpixel((32, 32), (100, 150, 255))
            img.save(self.raw_dir / f"{name}.png")

        process_character_pack(self.raw_dir, self.out_dir)

        anim_dir = self.out_dir / "animations"
        self.assertTrue((anim_dir / "idle.png").exists())
        self.assertTrue((anim_dir / "typing.png").exists())
        self.assertTrue((anim_dir / "panic.png").exists())
        self.assertTrue((anim_dir / "dragged.png").exists())
        self.assertTrue((anim_dir / "eyes" / "base.png").exists())
        self.assertTrue((anim_dir / "eyes" / "pupil.png").exists())
        self.assertTrue((self.out_dir / "manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
