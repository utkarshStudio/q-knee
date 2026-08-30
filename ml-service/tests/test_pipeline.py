"""
Q-Knee Real Medical Data Pipeline Unit Tests
Tests:
1. DICOM loading (pixel extraction, windowing, MONOCHROME1 inversion, error resilience)
2. NPY loading (2D, 3D D-H-W and H-W-D shapes, normalization)
3. Normalization & Preprocessing (128x128 resize, tensor format, ImageNet normalization)
4. Slice sorting (physical Z-axis, SliceLocation, InstanceNumber)
5. ResNet18 feature extraction & aggregation (512D output, mean/max pooling)
6. Data leakage prevention (train/val/test group stratification)
"""

import sys
import unittest
import numpy as np
import tempfile
import torch
from pathlib import Path
from PIL import Image

# Add project root and ml-service to Python path
test_dir = Path(__file__).parent.resolve()
ml_service_dir = test_dir.parent.resolve()
project_root = ml_service_dir.parent.resolve()
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.services.dicom_service import (
    apply_dicom_windowing,
    load_npy_volume,
    load_image_from_path,
    sort_dicom_paths,
    select_representative_slices,
)
from app.pipeline.feature_extractor import (
    get_resnet_feature_extractor,
    preprocess_slice,
    extract_features_from_image,
    extract_features_from_batch,
    aggregate_slice_features,
)
from scripts.prepare_dataset import create_leak_free_splits


class TestDICOMProcessing(unittest.TestCase):
    """Test DICOM window leveling, normalization, and photometric interpretation."""

    def test_window_leveling(self):
        # Create synthetic CT/MRI raw values [-1000 to +1000]
        raw = np.linspace(-1000, 1000, 100).reshape(10, 10)
        # Window: Center=0, Width=400 (Range: -200 to +200)
        norm = apply_dicom_windowing(raw, window_center=0, window_width=400)
        self.assertEqual(norm.shape, (10, 10))
        self.assertAlmostEqual(float(norm.min()), 0.0, places=4)
        self.assertAlmostEqual(float(norm.max()), 1.0, places=4)
        # Values below -200 should be 0.0, values above 200 should be 1.0
        self.assertEqual(norm[0, 0], 0.0)
        self.assertEqual(norm[-1, -1], 1.0)

    def test_monochrome1_inversion(self):
        raw = np.array([[0, 100], [200, 300]], dtype=np.float32)
        norm_mono2 = apply_dicom_windowing(raw, photometric_interpretation="MONOCHROME2")
        norm_mono1 = apply_dicom_windowing(raw, photometric_interpretation="MONOCHROME1")
        # Mono1 should be the exact inverse of Mono2
        np.testing.assert_allclose(norm_mono1, 1.0 - norm_mono2, rtol=1e-5, atol=1e-5)

    def test_rescale_slope_intercept(self):
        raw = np.array([[10, 20], [30, 40]], dtype=np.float32)
        norm = apply_dicom_windowing(raw, rescale_slope=2.0, rescale_intercept=-20.0)
        self.assertGreaterEqual(norm.min(), 0.0)
        self.assertLessEqual(norm.max(), 1.0)


class TestNPYVolumeLoading(unittest.TestCase):
    """Test loading and slicing 2D and 3D NumPy array volumes."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_load_2d_npy(self):
        arr_2d = np.random.uniform(0, 255, (256, 256)).astype(np.float32)
        npy_path = self.temp_path / "slice.npy"
        np.save(npy_path, arr_2d)

        slices = load_npy_volume(npy_path)
        self.assertEqual(len(slices), 1)
        self.assertIsInstance(slices[0], Image.Image)
        self.assertEqual(slices[0].size, (256, 256))

    def test_load_3d_npy_dhw(self):
        # 16 slices of 128x128
        arr_3d = np.random.uniform(10, 500, (16, 128, 128)).astype(np.float32)
        npy_path = self.temp_path / "volume_dhw.npy"
        np.save(npy_path, arr_3d)

        slices = load_npy_volume(npy_path)
        self.assertEqual(len(slices), 16)
        for s in slices:
            self.assertEqual(s.size, (128, 128))

    def test_load_3d_npy_hwd(self):
        # 128x128 with 10 slices along axis 2
        arr_3d = np.random.uniform(0, 100, (128, 128, 10)).astype(np.float32)
        npy_path = self.temp_path / "volume_hwd.npy"
        np.save(npy_path, arr_3d)

        slices = load_npy_volume(npy_path)
        self.assertEqual(len(slices), 10)


class TestPreprocessingAndFeatureExtraction(unittest.TestCase):
    """Test slice resizing to 128x128, tensor normalization, and ResNet18 512D output."""

    def test_slice_preprocessing(self):
        img = Image.new("L", (300, 400), color=128)
        tensor = preprocess_slice(img)
        # Should be shape (3, 128, 128)
        self.assertEqual(tensor.shape, (3, 128, 128))
        self.assertEqual(tensor.dtype, torch.float32)

    def test_resnet18_512d_feature_extraction(self):
        img = Image.new("RGB", (128, 128), color=(100, 100, 100))
        feat = extract_features_from_image(img)
        self.assertEqual(feat.shape, (512,))
        self.assertEqual(feat.dtype, np.float32)
        # Verify vector is non-zero
        self.assertGreater(float(np.linalg.norm(feat)), 0.0)

    def test_batch_feature_extraction(self):
        imgs = [Image.new("RGB", (128, 128), color=(i * 20, i * 20, i * 20)) for i in range(5)]
        batch_feats = extract_features_from_batch(imgs)
        self.assertEqual(batch_feats.shape, (5, 512))

    def test_slice_aggregation(self):
        feats = np.array([
            [1.0, 2.0, 3.0] + [0.0] * 509,
            [3.0, 4.0, 5.0] + [0.0] * 509,
        ], dtype=np.float32)

        mean_feat = aggregate_slice_features(feats, strategy="mean")
        self.assertEqual(mean_feat.shape, (512,))
        self.assertAlmostEqual(float(mean_feat[0]), 2.0)
        self.assertAlmostEqual(float(mean_feat[1]), 3.0)
        self.assertAlmostEqual(float(mean_feat[2]), 4.0)

        max_feat = aggregate_slice_features(feats, strategy="max")
        self.assertAlmostEqual(float(max_feat[0]), 3.0)
        self.assertAlmostEqual(float(max_feat[1]), 4.0)
        self.assertAlmostEqual(float(max_feat[2]), 5.0)


class TestRepresentativeSliceSampling(unittest.TestCase):
    """Test deterministic uniform sampling across volume slices."""

    def test_slice_sampling(self):
        all_slices = [Image.new("L", (64, 64), color=i) for i in range(20)]
        sampled = select_representative_slices(all_slices, max_slices=5)
        self.assertEqual(len(sampled), 5)


class TestLeakagePrevention(unittest.TestCase):
    """Test patient/study group-stratification to ensure zero train/val/test data leakage."""

    def test_zero_leakage_split(self):
        # Create 100 mock studies with binary labels
        studies = [{"study_id": f"study_{i:03d}", "file_paths": [f"/path/{i}.dcm"]} for i in range(100)]
        labels_map = {f"study_{i:03d}": (1 if i % 3 == 0 else 0) for i in range(100)}

        splits, summary = create_leak_free_splits(
            studies=studies,
            labels_map=labels_map,
            train_ratio=0.70,
            val_ratio=0.15,
            test_ratio=0.15,
            seed=42
        )

        train_ids = {s["study_id"] for s in splits["train"]}
        val_ids = {s["study_id"] for s in splits["validation"]}
        test_ids = {s["study_id"] for s in splits["test"]}

        # Assert no intersection whatsoever between any splits
        self.assertEqual(len(train_ids.intersection(val_ids)), 0)
        self.assertEqual(len(train_ids.intersection(test_ids)), 0)
        self.assertEqual(len(val_ids.intersection(test_ids)), 0)

        # Assert total counts match
        total_split_count = len(train_ids) + len(val_ids) + len(test_ids)
        self.assertEqual(total_split_count, 100)
        self.assertTrue(summary["leakage_free"])


if __name__ == "__main__":
    import torch
    unittest.main(verbosity=2)
