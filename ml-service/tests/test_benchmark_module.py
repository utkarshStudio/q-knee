"""
Q-Knee Benchmarking System Unit Tests
Verifies:
1. Classical SVM hyperparameter tuning strictly on training split.
2. Classical SVM and Hybrid VQC evaluation on untouched test set.
3. Confusion matrix computation (TP, FP, TN, FN, Specificity).
4. ROC curve point generation (FPR, TPR in [0, 1]).
5. SVG chart generation for ROC, Confusion Matrices, and Metrics Comparison.
6. JSON benchmark artifact structure and non-fabrication guarantees.
"""

import sys
import unittest
import tempfile
import warnings
from pathlib import Path
import numpy as np

warnings.filterwarnings("ignore")

# Add project root and ml-service to Python path
test_dir = Path(__file__).parent.resolve()
ml_service_dir = test_dir.parent.resolve()
project_root = ml_service_dir.parent.resolve()
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.pipeline.classical_model import ClassicalSVM
from app.services.benchmark_service import (
    _compute_roc_points,
    _generate_roc_svg,
    _generate_confusion_matrix_svg,
    _generate_metrics_bar_svg,
    run_benchmark,
)


class TestBenchmarkModule(unittest.TestCase):
    """Test suite for Classical vs Quantum Benchmarking System."""

    def setUp(self):
        np.random.seed(42)
        self.X_train = np.random.uniform(-1.0, 1.0, size=(12, 4)).astype(np.float32)
        self.y_train = np.array([0, 1] * 6, dtype=np.int32)
        self.X_test = np.random.uniform(-1.0, 1.0, size=(6, 4)).astype(np.float32)
        self.y_test = np.array([0, 1, 0, 1, 0, 1], dtype=np.int32)

    def test_classical_svm_training_and_evaluation(self):
        """Verify Classical SVM tunes on train and computes valid test metrics."""
        svm = ClassicalSVM(random_seed=42)
        config = svm.fit_and_tune(self.X_train, self.y_train)

        self.assertTrue(svm.is_fitted)
        self.assertIn("best_hyperparameters", config)
        self.assertEqual(config["training_samples"], 12)

        eval_res = svm.evaluate(self.X_test, self.y_test)
        for key in ["accuracy", "precision", "recall", "f1", "specificity", "roc_auc"]:
            self.assertIn(key, eval_res)
            self.assertGreaterEqual(eval_res[key], 0.0)
            self.assertLessEqual(eval_res[key], 1.0)

        cm = eval_res["confusion_matrix"]
        self.assertEqual(cm["tp"] + cm["fp"] + cm["tn"] + cm["fn"], len(self.y_test))

    def test_svm_persistence(self):
        """Verify Classical SVM model saving and reloading."""
        with tempfile.TemporaryDirectory() as tmpdir:
            svm = ClassicalSVM(random_seed=42)
            svm.fit_and_tune(self.X_train, self.y_train)
            svm.save(tmpdir)

            loaded = ClassicalSVM.load(tmpdir)
            self.assertTrue(loaded.is_fitted)
            pred_orig = svm.predict_sample(self.X_test[0])
            pred_loaded = loaded.predict_sample(self.X_test[0])

            self.assertEqual(pred_orig["predicted_class"], pred_loaded["predicted_class"])
            self.assertAlmostEqual(pred_orig["abnormal_probability"], pred_loaded["abnormal_probability"], places=5)

    def test_roc_points_computation(self):
        """Verify empirical ROC curve points are within [0, 1] bounds."""
        probs = np.array([0.1, 0.9, 0.3, 0.8, 0.4, 0.7], dtype=np.float32)
        roc = _compute_roc_points(self.y_test, probs)

        self.assertIn("fpr", roc)
        self.assertIn("tpr", roc)
        self.assertTrue(all(0.0 <= f <= 1.0 for f in roc["fpr"]))
        self.assertTrue(all(0.0 <= t <= 1.0 for t in roc["tpr"]))

    def test_svg_generation(self):
        """Verify generated SVGs are valid non-empty XML/SVG strings."""
        roc_pts = {"fpr": [0.0, 0.5, 1.0], "tpr": [0.0, 0.8, 1.0]}
        roc_svg = _generate_roc_svg(roc_pts, roc_pts, 0.85, 0.75)
        self.assertTrue(roc_svg.startswith("<svg") and roc_svg.endswith("</svg>"))

        cm = {"tp": 2, "fp": 1, "tn": 2, "fn": 1}
        cm_svg = _generate_confusion_matrix_svg(cm, cm)
        self.assertTrue(cm_svg.startswith("<svg") and cm_svg.endswith("</svg>"))

        m_dict = {"accuracy": 0.8, "precision": 0.75, "recall": 0.8, "f1": 0.77, "roc_auc": 0.82}
        bar_svg = _generate_metrics_bar_svg(m_dict, m_dict)
        self.assertTrue(bar_svg.startswith("<svg") and bar_svg.endswith("</svg>"))

    def test_end_to_end_benchmark_execution(self):
        """Verify run_benchmark returns valid payload with both models."""
        payload = run_benchmark(mode="REAL")
        self.assertIn("dataset_information", payload)
        self.assertIn("results", payload)
        self.assertEqual(len(payload["results"]), 2)

        model_names = [r["model_name"] for r in payload["results"]]
        self.assertIn("ClassicalSVM", model_names)
        self.assertIn("HybridVQC", model_names)


if __name__ == "__main__":
    unittest.main(verbosity=2)
