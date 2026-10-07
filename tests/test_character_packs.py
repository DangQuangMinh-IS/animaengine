"""
tests/test_character_packs.py
Kiểm thử tính toàn vẹn của hệ thống nhân vật Hybrid (2D Sprite & 3D GLB Models)
Bao gồm các tương tác nâng cao: salute, praise, focus, teatime, poke, shake
"""

import unittest
import json
import struct
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CHARACTERS_DIR = ROOT_DIR / "public" / "characters"

REQUIRED_INTERACTION_STATES = [
    "idle",
    "typing",
    "panic_shutdown",
    "dragged",
    "poke",
    "salute",
    "praise",
    "focus",
    "teatime",
    "shake",
]


def extract_glb_animation_names(glb_path: Path) -> list[str]:
    """Đọc tên các animation clips có trong file .glb"""
    with open(glb_path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF":
            return []
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        if chunk_type == b"JSON":
            data = json.loads(f.read(chunk_len).decode("utf-8"))
            return [a.get("name") for a in data.get("animations", []) if "name" in a]
    return []


class TestCharacterPacks(unittest.TestCase):
    def test_characters_directory_exists(self):
        self.assertTrue(CHARACTERS_DIR.exists(), "Thư mục public/characters phải tồn tại")

    def test_2d_character_hina(self):
        hina_dir = CHARACTERS_DIR / "hina"
        manifest_path = hina_dir / "manifest.json"
        self.assertTrue(manifest_path.exists(), "Manifest Hina 2D phải tồn tại")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("id"), "hina")
        self.assertEqual(manifest.get("type"), "2d")

        states = manifest.get("states", {})
        for state_name in REQUIRED_INTERACTION_STATES:
            self.assertIn(state_name, states, f"Thiếu state '{state_name}' trong Hina 2D")
            asset_rel = states[state_name].get("asset")
            self.assertTrue(asset_rel, f"Thiếu asset cho state '{state_name}'")
            asset_file = hina_dir / asset_rel
            self.assertTrue(asset_file.exists(), f"File ảnh asset {asset_file} không tồn tại")

    def test_3d_character_hina_dress(self):
        char_dir = CHARACTERS_DIR / "hina_dress"
        manifest_path = char_dir / "manifest.json"
        self.assertTrue(manifest_path.exists(), "Manifest Hina Dress 3D phải tồn tại")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("id"), "hina_dress")
        self.assertEqual(manifest.get("type"), "3d")

        model_file = char_dir / manifest.get("model", "model.glb")
        self.assertTrue(model_file.exists(), f"File mô hình {model_file} phải tồn tại")
        self.assertGreater(model_file.stat().st_size, 1_000_000, "Mô hình phải có dung lượng > 1MB")

        available_clips = extract_glb_animation_names(model_file)
        self.assertGreater(len(available_clips), 0, "Mô hình phải chứa ít nhất 1 animation clip")

        states = manifest.get("states", {})
        for state_name in REQUIRED_INTERACTION_STATES:
            self.assertIn(state_name, states, f"Thiếu state '{state_name}' trong Hina Dress 3D")
            clip_name = states[state_name].get("clip")
            self.assertIn(
                clip_name,
                available_clips,
                f"Clip '{clip_name}' trong state '{state_name}' không tồn tại trong Hina Dress model.glb",
            )

    def test_3d_character_hanako(self):
        char_dir = CHARACTERS_DIR / "hanako"
        manifest_path = char_dir / "manifest.json"
        self.assertTrue(manifest_path.exists(), "Manifest Hanako 3D phải tồn tại")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("id"), "hanako")
        self.assertEqual(manifest.get("type"), "3d")

        model_file = char_dir / manifest.get("model", "model.glb")
        self.assertTrue(model_file.exists())

        available_clips = extract_glb_animation_names(model_file)
        states = manifest.get("states", {})
        for state_name in REQUIRED_INTERACTION_STATES:
            self.assertIn(state_name, states, f"Thiếu state '{state_name}' trong Hanako 3D")
            clip_name = states[state_name].get("clip")
            self.assertIn(
                clip_name,
                available_clips,
                f"Clip '{clip_name}' trong state '{state_name}' không tồn tại trong Hanako model.glb",
            )

    def test_3d_character_airi(self):
        char_dir = CHARACTERS_DIR / "airi"
        manifest_path = char_dir / "manifest.json"
        self.assertTrue(manifest_path.exists(), "Manifest Airi 3D phải tồn tại")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("id"), "airi")
        self.assertEqual(manifest.get("type"), "3d")

        model_file = char_dir / manifest.get("model", "model.glb")
        self.assertTrue(model_file.exists())

        available_clips = extract_glb_animation_names(model_file)
        states = manifest.get("states", {})
        for state_name in REQUIRED_INTERACTION_STATES:
            self.assertIn(state_name, states, f"Thiếu state '{state_name}' trong Airi 3D")
            clip_name = states[state_name].get("clip")
            self.assertIn(
                clip_name,
                available_clips,
                f"Clip '{clip_name}' trong state '{state_name}' không tồn tại trong Airi model.glb",
            )


if __name__ == "__main__":
    unittest.main()
