"""
Q-Knee Full End-to-End System Integration Test Suite
Validates the complete diagnostic screening pipeline:
Upload/Volume -> Validation -> Preprocessing -> ResNet18 (512D) ->
PCA (4D) -> 4-Qubit VQC -> Prediction & Risk -> Grad-CAM -> Feature Attribution -> Output Schema
"""

import os
import sys
import unittest
import tempfile
import json
from pathlib import Path
import numpy as np
from PIL import Image

# Add project root and ml-service to Python path
project_root = Path(__file__).parent.parent.resolve()
ml_service_dir = project_root / "ml-service"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from fastapi.testclient import TestClient
from app.main import app
import app.pipeline.pca_handler as pca_handler
import app.pipeline.quantum_model as quantum_model
import app.pipeline.classical_model as classical_model
from app.services.dicom_service import load_study_slices


class TestEndToEndIntegration(unittest.TestCase):
    """Full pipeline integration tests using FastAPI TestClient."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Ensure models are loaded
        pca_handler.load_pca()
        quantum_model.load_vqc()
        classical_model.load_classifier()

    def test_01_service_and_model_health(self):
        """Verify service and model health check endpoints."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "qknee-ml")
        self.assertEqual(data["qubits"], 4)
        self.assertTrue(data["pca_fitted"])

        res_models = self.client.get("/health/models")
        self.assertEqual(res_models.status_code, 200)
        models_data = res_models.json()
        self.assertIn("feature_extractor", models_data)
        self.assertIn("pca", models_data)
        self.assertIn("quantum_vqc", models_data)
        self.assertIn("classical_svm", models_data)
        self.assertEqual(models_data["quantum_vqc"]["qubits"], 4)

    def test_02_volume_processing_endpoint(self):
        """Verify POST /process handles real NPY and DICOM volumes."""
        sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"
        self.assertTrue(sample_path.exists(), f"Sample file missing: {sample_path}")

        res = self.client.post("/process", json={
            "study_id": "test_study_001",
            "file_paths": [str(sample_path)],
            "mode": "REAL",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ready")
        self.assertGreater(data["slice_count"], 0)
        self.assertEqual(data["target_dimensions"], [128, 128])

    def test_03_quantum_prediction_on_real_mri(self):
        """Verify POST /predict executes ResNet18 -> PCA -> 4-Qubit VQC."""
        sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"
        res = self.client.post("/predict", json={
            "study_id": "test_study_001",
            "file_paths": [str(sample_path)],
            "model_type": "quantum",
            "mode": "REAL",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("predicted_class", data)
        self.assertIn(data["predicted_class"], ["abnormal", "normal"])
        self.assertIn("abnormal_probability", data)
        self.assertIn("normal_probability", data)
        self.assertIn("confidence", data)
        self.assertEqual(len(data["pca_features"]), 4)

        # Probabilities sum to ~1.0
        prob_sum = data["abnormal_probability"] + data["normal_probability"]
        self.assertAlmostEqual(prob_sum, 1.0, places=4)

    def test_04_classical_svm_prediction_on_real_mri(self):
        """Verify POST /predict executes ResNet18 -> PCA -> Classical SVM."""
        sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"
        res = self.client.post("/predict", json={
            "study_id": "test_study_001",
            "file_paths": [str(sample_path)],
            "model_type": "classical",
            "mode": "REAL",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["model_name"], "Classical SVM")
        self.assertIn(data["predicted_class"], ["abnormal", "normal"])
        self.assertEqual(len(data["pca_features"]), 4)

    def test_05_gradcam_explanation_endpoint(self):
        """Verify POST /explanations/gradcam generates original, heatmap, and overlay."""
        sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"
        res = self.client.post("/explanations/gradcam", json={
            "prediction_id": "pred_test_001",
            "study_id": "test_study_001",
            "file_paths": [str(sample_path)],
            "slice_idx": 2,
            "label_idx": 1,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["target_layer"], "ResNet18.layer4[1].conv2")
        self.assertEqual(data["selected_slice_index"], 2)
        self.assertIn("original_b64", data)
        self.assertIn("heatmap_b64", data)
        self.assertIn("overlay_b64", data)
        self.assertTrue(data["overlay_b64"].startswith("data:image/png;base64,"))

    def test_06_feature_attribution_endpoint(self):
        """Verify POST /explanations/features returns signed 4D sensitivity scores."""
        res = self.client.post("/explanations/features", json={
            "pca_features": [0.4, -0.25, 0.1, -0.6],
            "model_type": "quantum",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["features"]), 4)
        for f in data["features"]:
            self.assertIn(f["feature_name"], ["feature_1", "feature_2", "feature_3", "feature_4"])
            self.assertIn(f["direction"], ["positive_abnormal", "negative_normal"])
            self.assertIsInstance(f["attribution_score"], float)

    def test_07_unified_explain_endpoint(self):
        """Verify POST /explain returns both Grad-CAM and Feature Attribution with disclaimer."""
        sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"
        res = self.client.post("/explain", json={
            "prediction_id": "pred_unified_001",
            "study_id": "test_study_001",
            "file_paths": [str(sample_path)],
            "model_type": "quantum",
            "slice_idx": 0,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("gradcam", data)
        self.assertIn("attribution", data)
        self.assertIn("scientific_disclaimer", data)

    def test_08_error_handling_and_resilience(self):
        """Verify invalid/corrupted files do not crash the service."""
        # Corrupt file path
        res = self.client.post("/process", json={
            "study_id": "corrupt_study",
            "file_paths": ["non_existent_corrupted.dcm"],
            "mode": "REAL",
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ready")
        self.assertEqual(res.json()["slice_count"], 0)

        # Explain fallback with empty files
        res_exp = self.client.post("/explain", json={
            "prediction_id": "pred_fallback",
            "study_id": "study_fallback",
            "file_paths": [],
            "model_type": "quantum",
        })
        self.assertEqual(res_exp.status_code, 200)
        self.assertIn("attribution", res_exp.json())


if __name__ == "__main__":
    unittest.main(verbosity=2)
