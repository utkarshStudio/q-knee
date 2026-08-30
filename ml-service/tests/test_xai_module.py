"""
Q-Knee Explainability (XAI) Module Unit Tests
Verifies:
1. Grad-CAM computation on ResNet18 layer4 (target: layer4[-1].conv2).
2. Generation of original, heatmap, and blended overlay images.
3. Multi-slice volume Grad-CAM and slice selection.
4. 4D PCA / quantum feature attribution with signed directional contributions.
5. Graceful error handling and fallback on malformed/missing inputs.
"""

import sys
import unittest
import tempfile
import warnings
from pathlib import Path
import numpy as np
from PIL import Image

warnings.filterwarnings("ignore")

# Add project root and ml-service to Python path
test_dir = Path(__file__).parent.resolve()
ml_service_dir = test_dir.parent.resolve()
project_root = ml_service_dir.parent.resolve()
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.pipeline.gradcam import compute_gradcam_on_slice, compute_gradcam_for_volume
from app.pipeline.attribution import compute_feature_attribution
import app.pipeline.pca_handler as pca_handler
import app.pipeline.quantum_model as quantum_model


class TestXAIModule(unittest.TestCase):
    """Test suite for Explainability (Grad-CAM + Feature Attribution)."""

    def setUp(self):
        # Create a synthetic 128x128 grayscale MRI slice
        arr = np.random.randint(0, 255, size=(128, 128), dtype=np.uint8)
        self.sample_slice = Image.fromarray(arr, mode="L")
        self.sample_4d = np.array([0.45, -0.32, 0.12, -0.68], dtype=np.float32)

    def test_gradcam_single_slice_generation(self):
        """Verify Grad-CAM produces original, heatmap, and overlay images with valid activations."""
        with tempfile.TemporaryDirectory() as tmpdir:
            res = compute_gradcam_on_slice(self.sample_slice, output_dir=tmpdir, label_idx=1)

            self.assertIn("original", res)
            self.assertIn("heatmap", res)
            self.assertIn("overlay", res)
            self.assertIn("original_b64", res)
            self.assertIn("heatmap_b64", res)
            self.assertIn("overlay_b64", res)

            # Files exist on disk
            self.assertTrue(Path(res["original"]).exists())
            self.assertTrue(Path(res["heatmap"]).exists())
            self.assertTrue(Path(res["overlay"]).exists())

            # Valid activation stats
            self.assertGreaterEqual(res["max_activation"], 0.0)
            self.assertGreaterEqual(res["mean_activation"], 0.0)
            self.assertLessEqual(res["mean_activation"], 1.0)
            self.assertEqual(res["target_layer"], "ResNet18.layer4[1].conv2")

    def test_gradcam_volume_and_slice_selection(self):
        """Verify Grad-CAM on a volume supports selecting specific slice indices."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save 3 test slices
            slice_paths = []
            for i in range(3):
                p = Path(tmpdir) / f"slice_{i}.png"
                self.sample_slice.save(p)
                slice_paths.append(str(p))

            res = compute_gradcam_for_volume(
                slice_paths,
                output_dir=Path(tmpdir) / "output",
                slice_idx=1,
                label_idx=1,
            )

            self.assertEqual(res["selected_slice_index"], 1)
            self.assertEqual(res["total_volume_slices"], 3)
            self.assertIn("overlay", res)
            self.assertIn("scientific_disclaimer", res)

    def test_feature_attribution_for_four_pca_features(self):
        """Verify signed feature attribution decomposes prediction for 4 PCA features."""
        # Mock prediction probability function: P = 0.5 + 0.3*x0 - 0.2*x1 + 0.1*x2 - 0.4*x3
        def mock_predict_fn(x):
            val = 0.5 + 0.3 * x[0] - 0.2 * x[1] + 0.1 * x[2] - 0.4 * x[3]
            return float(np.clip(val, 0.0, 1.0))

        attr_res = compute_feature_attribution(self.sample_4d, mock_predict_fn)

        self.assertIn("features", attr_res)
        self.assertEqual(len(attr_res["features"]), 4)

        feature_names = [f["feature_name"] for f in attr_res["features"]]
        self.assertEqual(feature_names, ["feature_1", "feature_2", "feature_3", "feature_4"])

        # Check signed attribution values
        for f in attr_res["features"]:
            self.assertIn("attribution_score", f)
            self.assertIn("direction", f)
            self.assertIn(f["direction"], ["positive_abnormal", "negative_normal"])
            self.assertIn("relative_importance_pct", f)

        # Feature 1 (0.45 * +0.3) should be positive
        f1 = attr_res["features"][0]
        self.assertGreater(f1["attribution_score"], 0.0)
        self.assertEqual(f1["direction"], "positive_abnormal")

    def test_graceful_error_handling_on_invalid_files(self):
        """Verify compute_gradcam_for_volume raises descriptive error on non-existent files."""
        with self.assertRaises(ValueError):
            compute_gradcam_for_volume(["non_existent_file_12345.dcm"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
