import json
import os
import unittest


class TestPackaging(unittest.TestCase):
    def setUp(self):
        self.root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def test_no_hardcoded_paths(self):
        """Kiem tra khong con bat ky duong dan tuyet doi nao (nhu F:\\ hoac C:\\Users) trong source code."""
        forbidden_patterns = ["F:\\", "F:/", "C:\\Users\\quang"]
        check_dirs = [
            os.path.join(self.root_dir, "src"),
            os.path.join(self.root_dir, "src-tauri", "src"),
            os.path.join(self.root_dir, "tools"),
        ]
        
        for d in check_dirs:
            for root, _, files in os.walk(d):
                for f in files:
                    if f.endswith((".rs", ".js", ".html", ".css", ".py")):
                        path = os.path.join(root, f)
                        with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                            content = fp.read()
                            for pat in forbidden_patterns:
                                self.assertNotIn(
                                    pat,
                                    content,
                                    f"Tep {path} van con chua duong dan hardcode: {pat}",
                                )

    def test_tauri_config_integrity(self):
        """Kiem tra tinh hop le cua cau hinh dong goi tauri.conf.json."""
        conf_path = os.path.join(self.root_dir, "src-tauri", "tauri.conf.json")
        self.assertTrue(os.path.exists(conf_path), "Khong tim thay tauri.conf.json")
        
        with open(conf_path, "r", encoding="utf-8") as fp:
            conf = json.load(fp)
            
        self.assertEqual(conf.get("productName"), "animaengine")
        self.assertTrue(conf.get("bundle", {}).get("active", False))
        self.assertEqual(conf.get("build", {}).get("frontendDist"), "../dist")
        self.assertEqual(conf.get("app", {}).get("windows", [])[0].get("transparent"), True)

    def test_dist_build_integrity(self):
        """Kiem tra cac tep tin dong goi web frontend trong dist/."""
        dist_dir = os.path.join(self.root_dir, "dist")
        self.assertTrue(os.path.exists(dist_dir), "Thu muc dist/ chua duoc build")
        self.assertTrue(os.path.exists(os.path.join(dist_dir, "index.html")))
        
        # Kiem tra 8 nhan vat co mat trong dist/characters
        expected_chars = [
            "hina", "hina_dress", "airi", "hanako",
            "yuuka_pajama", "yuzu", "mika", "arisu"
        ]
        dist_chars = os.path.join(dist_dir, "characters")
        for char in expected_chars:
            char_dir = os.path.join(dist_chars, char)
            self.assertTrue(os.path.exists(char_dir), f"Thieu nhan vat {char} trong dist/characters")
            self.assertTrue(os.path.exists(os.path.join(char_dir, "manifest.json")), f"Thieu manifest cua {char}")

    def test_launcher_scripts(self):
        """Kiem tra kịch ban run.bat va stop.bat ho tro khoi chay portable."""
        run_bat = os.path.join(self.root_dir, "run.bat")
        stop_bat = os.path.join(self.root_dir, "stop.bat")
        
        self.assertTrue(os.path.exists(run_bat))
        self.assertTrue(os.path.exists(stop_bat))
        
        with open(run_bat, "r", encoding="utf-8", errors="ignore") as f:
            run_content = f.read()
            self.assertIn("animaengine.exe", run_content)
            self.assertIn("app.exe", run_content)
            
        with open(stop_bat, "r", encoding="utf-8", errors="ignore") as f:
            stop_content = f.read()
            self.assertIn("taskkill", stop_content)


if __name__ == "__main__":
    unittest.main()
