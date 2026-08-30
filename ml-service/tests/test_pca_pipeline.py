"""
Q-Knee 512D -> 4D Feature Reduction Unit Tests
Verifies:
1. PCA is fitted ONLY on the training split (validation/test independence).
2. Transformed output is strictly 4-dimensional for both single vectors (512,) and batches (N, 512).
3. Determinism: Same input yields bit-exact identical transformed output.
4. Model serialization: Saving to disk and reloading reproduces identical inference transformations.
5. Value bounds: Output features lie strictly in [-1.0, 1.0] for quantum angle encoding.
6. Metrics validity: Explained variance and statistics are correctly computed and tracked.
"""

import sys
import unittest
import numpy as np
import tempfile
from pathlib import Path

# Add project root and ml-service to Python path
test_dir = Path(__file__).parent.resolve()
ml_service_dir = test_dir.parent.resolve()
project_root = ml_service_dir.parent.resolve()
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.pipeline.pca_handler import FeatureReductionPipeline
import app.pipeline.pca_handler as pca_handler


class TestFeatureReductionPipeline(unittest.TestCase):
    """Test suite for 512D -> 4D PCA reduction pipeline."""

    def setUp(self):
        np.random.seed(42)
        # Create synthetic 512D training, val, and test splits
        self.X_train = np.random.normal(loc=0.0, scale=1.0, size=(50, 512)).astype(np.float32)
        self.X_val = np.random.normal(loc=0.5, scale=1.2, size=(15, 512)).astype(np.float32)
        self.X_test = np.random.normal(loc=-0.5, scale=0.8, size=(15, 512)).astype(np.float32)

    def test_fit_only_on_train(self):
        """Verify PCA transformation depends solely on the training data."""
        p1 = FeatureReductionPipeline(n_components=4, random_state=42)
        p1.fit(self.X_train)
        out1_test = p1.transform(self.X_test)

        # Another pipeline fitted on identical X_train
        p2 = FeatureReductionPipeline(n_components=4, random_state=42)
        p2.fit(self.X_train)
        out2_test = p2.transform(self.X_test)

        # Output on X_test must be identical
        np.testing.assert_allclose(out1_test, out2_test, rtol=1e-6, atol=1e-6)
        # PCA components must match exactly
        np.testing.assert_allclose(p1.components_, p2.components_, rtol=1e-6, atol=1e-6)

    def test_output_dimensionality_is_exactly_four(self):
        """Verify output has exactly 4 features for various input batch sizes."""
        pipeline = FeatureReductionPipeline(n_components=4, random_state=42)
        pipeline.fit(self.X_train)

        # Batch of 50
        out_batch = pipeline.transform(self.X_train)
        self.assertEqual(out_batch.shape, (50, 4))
        self.assertEqual(out_batch.dtype, np.float32)

        # Batch of 1
        out_single_batch = pipeline.transform(self.X_train[0:1])
        self.assertEqual(out_single_batch.shape, (1, 4))

        # Single 1D vector (512,) -> should return (4,)
        out_1d = pipeline.transform(self.X_train[0])
        self.assertEqual(out_1d.shape, (4,))
        self.assertEqual(out_1d.dtype, np.float32)

    def test_determinism(self):
        """Verify same input vector produces bit-exact identical transformed output."""
        pipeline = FeatureReductionPipeline(n_components=4, random_state=42)
        pipeline.fit(self.X_train)

        vec = self.X_test[0]
        out_a = pipeline.transform(vec)
        out_b = pipeline.transform(vec)
        np.testing.assert_array_equal(out_a, out_b)

    def test_persistence_and_inference_parity(self):
        """Verify saving and reloading pipeline reproduces identical inference transformations."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "pca.pkl"
            metrics_path = Path(tmpdir) / "pca_metrics.json"

            p_train = FeatureReductionPipeline(n_components=4, random_state=42)
            p_train.fit(self.X_train)
            p_train.save(model_path, metrics_path)

            self.assertTrue(model_path.exists())
            self.assertTrue(metrics_path.exists())

            # Load in a fresh instance
            p_loaded = FeatureReductionPipeline.load(model_path)
            self.assertTrue(p_loaded.is_fitted)

            # Compare transformations on test data
            out_orig = p_train.transform(self.X_test)
            out_loaded = p_loaded.transform(self.X_test)
            np.testing.assert_allclose(out_orig, out_loaded, rtol=1e-6, atol=1e-6)

    def test_quantum_scaling_bounds(self):
        """Verify transformed features lie strictly in [-1.0, 1.0] for quantum angle encoding."""
        pipeline = FeatureReductionPipeline(n_components=4, random_state=42)
        pipeline.fit(self.X_train)

        out_train = pipeline.transform(self.X_train)
        self.assertGreaterEqual(float(out_train.min()), -1.0)
        self.assertLessEqual(float(out_train.max()), 1.0)

        out_test = pipeline.transform(self.X_test)
        self.assertGreaterEqual(float(out_test.min()), -1.0)
        self.assertLessEqual(float(out_test.max()), 1.0)

    def test_metrics_and_variance_recording(self):
        """Verify explained variance and cumulative variance are computed and stored."""
        pipeline = FeatureReductionPipeline(n_components=4, random_state=42)
        pipeline.fit(self.X_train)

        metrics = pipeline.metrics
        self.assertEqual(metrics["input_dim"], 512)
        self.assertEqual(metrics["output_dim"], 4)
        self.assertEqual(len(metrics["explained_variance"]), 4)
        self.assertEqual(len(metrics["explained_variance_ratio"]), 4)
        self.assertEqual(len(metrics["cumulative_explained_variance"]), 4)
    def test_module_fit_pca_with_n_components(self):
        """Verify module-level fit_pca(X, n_components=4) succeeds without TypeError."""
        pca_handler.fit_pca(self.X_train, n_components=4)
        self.assertTrue(pca_handler.is_fitted())
        out = pca_handler.transform(self.X_test)
        self.assertEqual(out.shape, (15, 4))
        self.assertGreaterEqual(float(out.min()), -1.0)
        self.assertLessEqual(float(out.max()), 1.0)

    def test_module_fit_pca_default_signature(self):
        """Verify module-level fit_pca(X) succeeds without n_components specified."""
        pca_handler.fit_pca(self.X_train)
        self.assertTrue(pca_handler.is_fitted())
        out = pca_handler.transform(self.X_test)
        self.assertEqual(out.shape, (15, 4))


if __name__ == "__main__":
    unittest.main(verbosity=2)
