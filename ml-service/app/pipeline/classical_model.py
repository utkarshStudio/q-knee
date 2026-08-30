"""
Classical Baseline Classifier: Support Vector Machine (SVM)
Tuned strictly on training/validation splits using cross-validation.
Never uses test data for model selection or fitting.
"""

import os
import sys
import json
import pickle
import time
import warnings
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union, List
import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

from sklearn.svm import SVC
from sklearn.model_selection import StratifiedKFold, GridSearchCV
from sklearn.calibration import CalibratedClassifierCV


class ClassicalSVM:
    """
    Classical Support Vector Machine baseline for Knee Abnormality Detection.
    Hyperparameters (C, gamma, kernel) tuned strictly via cross-validation on training data.
    """

    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed
        self.model: Optional[Any] = None
        self.best_params: Dict[str, Any] = {}
        self.is_fitted: bool = False
        self.config_metadata: Dict[str, Any] = {}

    def fit_and_tune(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """
        Fit SVM with hyperparameter tuning strictly on training / validation splits.
        Never touches test data.
        """
        X_tr = np.asarray(X_train, dtype=np.float32)
        y_tr = np.asarray(y_train, dtype=np.int32)
        n_samples = len(y_tr)

        # Hyperparameter search grid
        param_grid = {
            "C": [0.1, 1.0, 5.0, 10.0],
            "gamma": ["scale", "auto", 0.1, 0.5],
            "kernel": ["rbf", "linear"],
        }

        # Determine CV strategy based on sample size
        n_pos = int(np.sum(y_tr == 1))
        n_neg = int(np.sum(y_tr == 0))
        min_class = min(n_pos, n_neg)

        cv_splits = max(2, min(3, min_class)) if min_class >= 2 else None

        t0 = time.perf_counter()
        if cv_splits and cv_splits >= 2 and n_samples >= 6:
            cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=self.random_seed)
            grid = GridSearchCV(
                SVC(random_state=self.random_seed, class_weight="balanced"),
                param_grid=param_grid,
                cv=cv,
                scoring="accuracy",
                n_jobs=1,
            )
            grid.fit(X_tr, y_tr)
            base_svc = grid.best_estimator_
            self.best_params = grid.best_params_
        else:
            base_svc = SVC(kernel="rbf", C=1.0, gamma="scale", random_state=self.random_seed, class_weight="balanced")
            base_svc.fit(X_tr, y_tr)
            self.best_params = {"C": 1.0, "gamma": "scale", "kernel": "rbf"}

        # Calibrated classifier for probabilistic inference
        try:
            self.model = CalibratedClassifierCV(base_svc, cv=min(cv_splits or 2, 2))
            self.model.fit(X_tr, y_tr)
        except Exception:
            self.model = base_svc

        training_time = (time.perf_counter() - t0)

        # Calibrate if validation set provided
        if X_val is not None and y_val is not None and len(X_val) >= 4:
            calibrated = CalibratedClassifierCV(self.model, cv="prefit")
            try:
                calibrated.fit(X_val, y_val)
                self.model = calibrated
            except Exception:
                pass

        self.is_fitted = True
        self.config_metadata = {
            "model_type": "Classical Support Vector Machine (SVM)",
            "best_hyperparameters": self.best_params,
            "training_samples": n_samples,
            "class_distribution": {"abnormal": n_pos, "normal": n_neg},
            "training_time_seconds": training_time,
            "random_seed": self.random_seed,
        }
        return self.config_metadata

    def predict_sample(self, x: np.ndarray) -> Dict[str, Any]:
        """Inference on single 4D feature vector."""
        if not self.is_fitted or self.model is None:
            raise RuntimeError("Classical SVM not fitted.")

        x_in = np.asarray(x, dtype=np.float32).reshape(1, -1)
        t0 = time.perf_counter()
        probs = self.model.predict_proba(x_in)[0]
        latency_ms = (time.perf_counter() - t0) * 1000.0

        classes = list(self.model.classes_)
        if 1 in classes:
            idx_1 = classes.index(1)
            p_abn = float(probs[idx_1])
        else:
            p_abn = 0.5

        p_norm = float(1.0 - p_abn)
        pred_class = "abnormal" if p_abn >= 0.5 else "normal"
        conf = float(max(p_abn, p_norm))

        return {
            "predicted_class": pred_class,
            "abnormal_probability": p_abn,
            "normal_probability": p_norm,
            "confidence": conf,
            "latency_ms": latency_ms,
        }

    def predict_batch(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Batch prediction returning (preds, probabilities)."""
        if not self.is_fitted or self.model is None:
            raise RuntimeError("Classical SVM not fitted.")
        X_in = np.asarray(X, dtype=np.float32)
        probs = self.model.predict_proba(X_in)
        classes = list(self.model.classes_)
        if 1 in classes:
            idx_1 = classes.index(1)
            p_abn = probs[:, idx_1]
        else:
            p_abn = np.full(len(X), 0.5)

        preds = (p_abn >= 0.5).astype(np.int32)
        return preds, p_abn.astype(np.float32)

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Compute complete test metrics on untouched test split."""
        preds, probs = self.predict_batch(X_test)
        y_true = np.asarray(y_test, dtype=np.int32)
        n = len(y_true)

        acc = float(np.mean(preds == y_true))
        tp = int(np.sum((preds == 1) & (y_true == 1)))
        fp = int(np.sum((preds == 1) & (y_true == 0)))
        fn = int(np.sum((preds == 0) & (y_true == 1)))
        tn = int(np.sum((preds == 0) & (y_true == 0)))

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2.0 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

        # Exact ROC-AUC
        pos = probs[y_true == 1]
        neg = probs[y_true == 0]
        if len(pos) > 0 and len(neg) > 0:
            ranks = sum(np.sum(p > neg) + 0.5 * np.sum(p == neg) for p in pos)
            roc_auc = float(ranks / (len(pos) * len(neg)))
        else:
            roc_auc = 0.5

        return {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "specificity": spec,
            "roc_auc": roc_auc,
            "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
            "sample_count": n,
        }

    def save(self, model_dir: Union[str, Path]) -> None:
        """Save fitted model and config to disk."""
        m_dir = Path(model_dir)
        m_dir.mkdir(parents=True, exist_ok=True)
        with open(m_dir / "classical_svm.pkl", "wb") as f:
            pickle.dump(self.model, f)
        with open(m_dir / "classical_svm_config.json", "w", encoding="utf-8") as f:
            json.dump(self.config_metadata, f, indent=2)

    @classmethod
    def load(cls, model_dir: Union[str, Path]) -> "ClassicalSVM":
        """Load classical SVM from artifacts."""
        m_dir = Path(model_dir)
        clf_file = m_dir / "classical_svm.pkl"
        if not clf_file.exists():
            raise FileNotFoundError(f"Classical SVM not found at {clf_file}")
        with open(clf_file, "rb") as f:
            model = pickle.load(f)
        config_data = {}
        cfg_file = m_dir / "classical_svm_config.json"
        if cfg_file.exists():
            with open(cfg_file, "r", encoding="utf-8") as f:
                config_data = json.load(f)

        svm = cls(random_seed=config_data.get("random_seed", 42))
        svm.model = model
        svm.is_fitted = True
        svm.best_params = config_data.get("best_hyperparameters", {})
        svm.config_metadata = config_data
        return svm


# Module runtime singletons
_global_svm: Optional[ClassicalSVM] = None

def _get_model_dir() -> Path:
    from app.config import config
    return Path(config.MODEL_DIR)

def load_classifier() -> bool:
    global _global_svm
    m_dir = _get_model_dir()
    if (m_dir / "classical_svm.pkl").exists():
        try:
            _global_svm = ClassicalSVM.load(m_dir)
            return True
        except Exception as e:
            print(f"[Warning] Failed to load classical SVM: {e}")
    return False

def fit_classifier(X: np.ndarray, y: np.ndarray) -> None:
    global _global_svm
    svm = ClassicalSVM(random_seed=42)
    svm.fit_and_tune(X, y)
    svm.save(_get_model_dir())
    _global_svm = svm

def predict(X: np.ndarray) -> Dict[str, Any]:
    global _global_svm
    if _global_svm is None:
        if not load_classifier():
            raise RuntimeError("Classical SVM not fitted. Call fit_classifier() first.")
    if X.ndim > 1:
        X = X[0]
    return _global_svm.predict_sample(X)

def is_fitted() -> bool:
    global _global_svm
    if _global_svm is None:
        return load_classifier()
    return _global_svm.is_fitted