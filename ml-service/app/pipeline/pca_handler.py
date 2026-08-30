"""
Production PCA & Feature Reduction Pipeline
Reduces 512D ResNet18 spatial embeddings to exactly 4 quantum-ready features.
Implements exact SVD Principal Component Analysis and deterministic [-1.0, 1.0] scaling
using pure NumPy for maximal performance, reliability, and cross-platform compatibility.
"""

import os
import json
import pickle
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, Union, Tuple
from app.config import config

class FeatureReductionPipeline:
    """
    Unified 512D -> 4D Feature Reduction & Quantum Scaling Pipeline.
    Combines SVD-based PCA with deterministic min-max scaling to [-1.0, 1.0].
    """

    def __init__(self, n_components: int = 4, random_state: int = 42):
        self.n_components = n_components
        self.random_state = random_state
        self.mean_: Optional[np.ndarray] = None
        self.components_: Optional[np.ndarray] = None
        self.explained_variance_: Optional[np.ndarray] = None
        self.explained_variance_ratio_: Optional[np.ndarray] = None
        self.scale_min_: Optional[np.ndarray] = None
        self.scale_max_: Optional[np.ndarray] = None
        self.is_fitted = False
        self.metrics: Dict[str, Any] = {}

    def fit(self, X_train: np.ndarray) -> "FeatureReductionPipeline":
        """
        Fit PCA and Scaler ONLY on training features (N_train, 512).
        Never fit on validation or test splits.
        """
        if X_train.ndim != 2:
            raise ValueError(f"Expected 2D array (N, 512), got shape {X_train.shape}")

        n_samples, n_features = X_train.shape
        if n_features != 512:
            raise ValueError(f"Expected 512 features, got {n_features}")

        # 1. Compute and store feature means
        self.mean_ = np.mean(X_train, axis=0).astype(np.float32)
        X_centered = X_train - self.mean_

        # 2. Compute exact PCA via SVD
        # X_centered = U * S * Vt
        u, s, vt = np.linalg.svd(X_centered, full_matrices=False)

        # Enforce deterministic sign convention (flip eigenvectors so largest absolute value is positive)
        for i in range(vt.shape[0]):
            max_abs_idx = np.argmax(np.abs(vt[i]))
            if vt[i, max_abs_idx] < 0:
                vt[i] *= -1.0

        n_comp = min(self.n_components, vt.shape[0])
        self.components_ = np.zeros((self.n_components, n_features), dtype=np.float32)
        self.components_[:n_comp] = vt[:n_comp].astype(np.float32)

        # 3. Compute Explained Variance
        dof = max(1, n_samples - 1)
        total_var = float(np.sum(s ** 2) / dof) if dof > 0 else 1.0
        exp_var = (s[:n_comp] ** 2) / dof
        exp_var_ratio = exp_var / (total_var + 1e-12)

        # Pad variance if n_samples < n_components
        if len(exp_var) < self.n_components:
            pad = self.n_components - len(exp_var)
            exp_var = np.pad(exp_var, (0, pad), mode="constant")
            exp_var_ratio = np.pad(exp_var_ratio, (0, pad), mode="constant")

        self.explained_variance_ = exp_var.astype(np.float32)
        self.explained_variance_ratio_ = exp_var_ratio.astype(np.float32)

        # 4. Project training features and fit Min-Max Scaler to [-1.0, 1.0]
        pca_train = np.dot(X_centered, self.components_.T)  # (N, n_components)

        self.scale_min_ = np.min(pca_train, axis=0).astype(np.float32)
        self.scale_max_ = np.max(pca_train, axis=0).astype(np.float32)

        # Prevent division by zero for constant features
        scale_range = self.scale_max_ - self.scale_min_
        scale_range[scale_range < 1e-8] = 1.0
        self.scale_range_ = scale_range

        self.is_fitted = True

        # 5. Record full metrics & statistics
        cum_var_ratio = np.cumsum(self.explained_variance_ratio_).tolist()
        scaled_train = self.transform(X_train)

        self.metrics = {
            "n_train_samples": int(n_samples),
            "input_dim": int(n_features),
            "output_dim": int(self.n_components),
            "explained_variance": [float(v) for v in self.explained_variance_],
            "explained_variance_ratio": [float(v) for v in self.explained_variance_ratio_],
            "cumulative_explained_variance": [float(v) for v in cum_var_ratio],
            "total_explained_variance_ratio": float(np.sum(self.explained_variance_ratio_)),
            "train_feature_stats": {
                "mean": [float(m) for m in np.mean(scaled_train, axis=0)],
                "std": [float(s) for s in np.std(scaled_train, axis=0)],
                "min": [float(m) for m in np.min(scaled_train, axis=0)],
                "max": [float(m) for m in np.max(scaled_train, axis=0)],
            },
            "random_state": self.random_state,
        }
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """
        Transform 512D features to exactly 4 quantum-ready features in [-1.0, 1.0].
        Supports input shapes (512,) or (N, 512).
        Returns float32 array of shape (N, 4) or (4,).
        """
        if not self.is_fitted or self.mean_ is None or self.components_ is None:
            raise RuntimeError("Pipeline is not fitted. Call fit() or load() first.")

        single_vector = False
        if X.ndim == 1:
            if X.shape[0] != 512:
                raise ValueError(f"Expected 512 features, got {X.shape[0]}")
            X = X.reshape(1, -1)
            single_vector = True
        elif X.ndim == 2:
            if X.shape[1] != 512:
                raise ValueError(f"Expected 512 features, got {X.shape[1]}")
        else:
            raise ValueError(f"Expected 1D or 2D array, got {X.ndim}D")

        # Center using training mean
        X_centered = X - self.mean_

        # Project onto principal components
        pca_out = np.dot(X_centered, self.components_.T)  # (N, 4)

        # Scale into [-1.0, 1.0]
        scaled = -1.0 + 2.0 * (pca_out - self.scale_min_) / self.scale_range_
        scaled = np.clip(scaled, -1.0, 1.0).astype(np.float32)

        if single_vector:
            return scaled[0]
        return scaled

    def fit_transform(self, X_train: np.ndarray) -> np.ndarray:
        """Fit on train and return transformed train features."""
        self.fit(X_train)
        return self.transform(X_train)

    def save(self, model_path: Union[str, Path], metrics_path: Optional[Union[str, Path]] = None) -> None:
        """Serialize pipeline artifact and metrics."""
        m_path = Path(model_path)
        m_path.parent.mkdir(parents=True, exist_ok=True)
        with open(m_path, "wb") as f:
            pickle.dump(self, f)

        if metrics_path:
            met_path = Path(metrics_path)
            met_path.parent.mkdir(parents=True, exist_ok=True)
            with open(met_path, "w", encoding="utf-8") as f:
                json.dump(self.metrics, f, indent=2)

    @classmethod
    def load(cls, model_path: Union[str, Path]) -> "FeatureReductionPipeline":
        """Load serialized pipeline artifact."""
        m_path = Path(model_path)
        if not m_path.exists():
            raise FileNotFoundError(f"PCA model artifact not found at {m_path}")
        with open(m_path, "rb") as f:
            obj = pickle.load(f)
        return obj


# Global pipeline instance for ML microservice runtime
_pipeline: Optional[FeatureReductionPipeline] = None

def _pca_path() -> Path:
    return Path(config.MODEL_DIR) / "pca.pkl"

def load_pca() -> bool:
    """Load global PCA artifact if present."""
    global _pipeline
    p = _pca_path()
    if p.exists():
        try:
            with open(p, "rb") as f:
                loaded = pickle.load(f)
            if isinstance(loaded, FeatureReductionPipeline):
                _pipeline = loaded
            else:
                _pipeline = FeatureReductionPipeline(n_components=config.PCA_COMPONENTS)
            return True
        except Exception as e:
            print(f"[Warning] Failed to load PCA artifact: {e}")
            return False
    return False

def fit_pca(features: np.ndarray, n_components: Optional[int] = None) -> None:
    """Fit global PCA on training features."""
    global _pipeline
    components = n_components if n_components is not None else config.PCA_COMPONENTS
    _pipeline = FeatureReductionPipeline(n_components=components)
    _pipeline.fit(features)
    _pipeline.save(_pca_path(), Path(config.MODEL_DIR) / "pca_metrics.json")

def transform(features: np.ndarray) -> np.ndarray:
    """Transform 512D features to exactly 4 quantum-ready features."""
    global _pipeline
    if _pipeline is None or not _pipeline.is_fitted:
        if not load_pca():
            raise RuntimeError("PCA pipeline not fitted or loaded. Call fit_pca() first.")
    return _pipeline.transform(features)

def is_fitted() -> bool:
    global _pipeline
    if _pipeline is None:
        return load_pca()
    return _pipeline.is_fitted

def get_explained_variance() -> list:
    global _pipeline
    if _pipeline is None:
        load_pca()
    if _pipeline is not None and _pipeline.is_fitted:
        return _pipeline.metrics.get("explained_variance_ratio", [])
    return []

def get_pca_metrics() -> dict:
    global _pipeline
    if _pipeline is None:
        load_pca()
    if _pipeline is not None and _pipeline.is_fitted:
        return _pipeline.metrics
    return {}

def get_pipeline() -> Optional[FeatureReductionPipeline]:
    global _pipeline
    if _pipeline is None:
        load_pca()
    return _pipeline