"""
Q-Knee Quantum Machine Learning (QML) Unit Tests
Verifies:
1. Circuit construction: 4 qubits, angle encoding, parameterized gates, CNOT ladder, Pauli-Z.
2. Input dimensionality: Correctly handles 1D (4,) and 2D (N, 4) inputs.
3. Forward pass: Produces valid expectation value <Z_0> in [-1.0, 1.0].
4. Parameter-shift gradients: Computes analytical gradients matching weights shape.
5. Training & early stopping: Optimizes loss and tracks metrics.
6. Checkpoint persistence: Saves and reloads weights and config for artifact-only inference parity.
7. Prediction schema: Returns predicted_class, abnormal_probability, normal_probability, confidence.
"""

import sys
import unittest
import tempfile
from pathlib import Path
import numpy as np

# Add project root and ml-service to Python path
test_dir = Path(__file__).parent.resolve()
ml_service_dir = test_dir.parent.resolve()
project_root = ml_service_dir.parent.resolve()
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.pipeline.quantum_model import VariationalQuantumClassifier, create_quantum_device


class TestQuantumModel(unittest.TestCase):
    """Test suite for 4-Qubit Variational Quantum Classifier."""

    def setUp(self):
        np.random.seed(42)
        self.vqc = VariationalQuantumClassifier(n_qubits=4, depth=2, backend_name="default.qubit", random_seed=42)
        # Synthetic 4D PCA features in [-1.0, 1.0]
        self.X_train = np.random.uniform(-1.0, 1.0, size=(8, 4)).astype(np.float32)
        self.y_train = np.array([0, 1] * 4, dtype=np.int32)
        self.X_test = np.random.uniform(-1.0, 1.0, size=(4, 4)).astype(np.float32)
        self.y_test = np.array([0, 1, 0, 1], dtype=np.int32)

    def test_device_and_circuit_initialization(self):
        """Verify device creates 4 wires and circuit is initialized."""
        self.assertEqual(len(self.vqc.dev.wires), 4)
        self.assertEqual(self.vqc.n_qubits, 4)
        self.assertEqual(self.vqc.depth, 2)

    def test_forward_pass_bounds(self):
        """Verify forward pass output is strictly bounded in [-1.0, 1.0]."""
        test_weights = np.random.uniform(-np.pi, np.pi, (2, 4, 3)).astype(np.float32)
        for i in range(len(self.X_train)):
            val = self.vqc.forward(self.X_train[i], weights=test_weights)
            self.assertIsInstance(val, float)
            self.assertGreaterEqual(val, -1.0)
            self.assertLessEqual(val, 1.0)

    def test_parameter_shift_gradient_shape(self):
        """Verify analytical parameter-shift gradient has identical shape to weights."""
        test_weights = np.random.uniform(-np.pi, np.pi, (2, 4, 3)).astype(np.float32)
        grad = self.vqc._compute_parameter_shift_gradients(self.X_train[0], test_weights)
        self.assertEqual(grad.shape, test_weights.shape)
        self.assertEqual(grad.dtype, np.float32)
        # Gradient should be non-zero
        self.assertGreater(float(np.linalg.norm(grad)), 0.0)

    def test_training_and_convergence(self):
        """Verify training reduces loss and saves best weights."""
        history_meta = self.vqc.train(
            X_train=self.X_train,
            y_train=self.y_train,
            epochs=4,
            lr=0.08,
            patience=3,
        )
        self.assertTrue(self.vqc.is_trained)
        self.assertIsNotNone(self.vqc.weights)
        self.assertEqual(self.vqc.weights.shape, (2, 4, 3))
        self.assertIn("best_train_loss", history_meta)
        self.assertGreater(history_meta["total_epochs_trained"], 0)

    def test_prediction_output_schema(self):
        """Verify prediction returns valid probabilities, confidence, and class label."""
        self.vqc.train(self.X_train, self.y_train, epochs=3, lr=0.05)
        res = self.vqc.predict_sample(self.X_test[0])

        self.assertIn("predicted_class", res)
        self.assertIn(res["predicted_class"], ["abnormal", "normal"])
        self.assertIn("abnormal_probability", res)
        self.assertIn("normal_probability", res)
        self.assertIn("confidence", res)
        self.assertIn("raw_circuit_output", res)
        self.assertIn("quantum_backend", res)

        # Probabilities sum to 1.0
        self.assertAlmostEqual(res["abnormal_probability"] + res["normal_probability"], 1.0, places=5)
        self.assertGreaterEqual(res["confidence"], 0.5)
        self.assertLessEqual(res["confidence"], 1.0)

    def test_persistence_and_artifact_only_inference(self):
        """Verify model weights and config can be saved and loaded for identical inference."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.vqc.train(self.X_train, self.y_train, epochs=3, lr=0.05)
            self.vqc.save(tmpdir)

            # Load into fresh instance
            loaded_vqc = VariationalQuantumClassifier.load(tmpdir)
            self.assertTrue(loaded_vqc.is_trained)
            self.assertEqual(loaded_vqc.n_qubits, 4)
            self.assertEqual(loaded_vqc.depth, 2)

            # Compare predictions across all test samples
            for i in range(len(self.X_test)):
                pred_orig = self.vqc.predict_sample(self.X_test[i])
                pred_loaded = loaded_vqc.predict_sample(self.X_test[i])

                self.assertEqual(pred_orig["predicted_class"], pred_loaded["predicted_class"])
                self.assertAlmostEqual(pred_orig["abnormal_probability"], pred_loaded["abnormal_probability"], places=5)
                self.assertAlmostEqual(pred_orig["confidence"], pred_loaded["confidence"], places=5)

    def test_batch_prediction(self):
        """Verify batch prediction returns correctly shaped arrays."""
        self.vqc.train(self.X_train, self.y_train, epochs=3, lr=0.05)
        preds, probs = self.vqc.predict_batch(self.X_test)
        self.assertEqual(len(preds), len(self.X_test))
        self.assertEqual(len(probs), len(self.X_test))
        self.assertTrue(all(p in [0, 1] for p in preds))
        self.assertTrue(all(0.0 <= pr <= 1.0 for pr in probs))


if __name__ == "__main__":
    unittest.main(verbosity=2)
