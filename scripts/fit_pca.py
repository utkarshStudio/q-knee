"""
Q-Knee Production Feature Reduction CLI - Fit PCA
Fits PCA and quantum scaling strictly on the training split features.
Transforms train, validation, and test splits into 4-dimensional quantum-ready feature matrices.
Saves model artifacts, metrics, and dataset arrays.
"""

import os
import sys
import json
import argparse
from pathlib import Path
import numpy as np

# Add project root and ml-service to Python path
project_root = Path(__file__).parent.parent.resolve()
ml_service_dir = project_root / "ml-service"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.pipeline.pca_handler import FeatureReductionPipeline

def parse_args():
    parser = argparse.ArgumentParser(description="Fit PCA on training features and reduce 512D -> 4D quantum features.")
    parser.add_argument("--features_dir", type=str, default="./data/features", help="Directory containing extracted 512D features (.npz).")
    parser.add_argument("--output_dir", type=str, default="./data/quantum_features", help="Directory to save 4D quantum features (.npy) and metrics.")
    parser.add_argument("--model_dir", type=str, default="./ml-service/models", help="Directory to save pca.pkl for runtime inference.")
    parser.add_argument("--n_components", type=int, default=4, help="Number of PCA components (default: 4 for 4-qubit circuit).")
    parser.add_argument("--random_state", type=int, default=42, help="Random seed for PCA decomposition.")
    return parser.parse_args()


def load_split_data(features_dir: Path, split_name: str):
    """Load cached features, labels, and study IDs for a split."""
    npz_path = features_dir / f"{split_name}_features.npz"
    if not npz_path.exists():
        return None, None, None
    data = np.load(npz_path, allow_pickle=True)
    X = data["X"].astype(np.float32)
    y = data["y"].astype(np.int32)
    study_ids = data["study_ids"].astype(str)
    return X, y, study_ids


def main():
    args = parse_args()
    features_dir = Path(args.features_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    model_dir = Path(args.model_dir).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("Q-KNEE 512D -> 4D FEATURE REDUCTION PIPELINE")
    print("=" * 65)
    print(f"Features Input Directory: {features_dir}")
    print(f"Quantum Output Directory: {output_dir}")
    print(f"Model Artifacts Directory:{model_dir}")
    print(f"Target PCA Components:    {args.n_components}")
    print(f"Random State:             {args.random_state}")

    # 1. Load training features
    X_train, y_train, ids_train = load_split_data(features_dir, "train")
    if X_train is None or len(X_train) == 0:
        print(f"\n[Error] Training features not found at {features_dir / 'train_features.npz'}")
        print("Please run 'python scripts/extract_features.py' first.")
        sys.exit(1)

    print(f"\n[Info] Loaded Training Data: {X_train.shape[0]} samples, {X_train.shape[1]} dimensions.")

    # 2. Instantiate and Fit PCA Pipeline ONLY on Training Data
    print("[Info] Fitting PCA & Scaler strictly on TRAINING split...")
    pipeline = FeatureReductionPipeline(n_components=args.n_components, random_state=args.random_state)
    pipeline.fit(X_train)

    # 3. Transform Training Set
    X_train_pca = pipeline.transform(X_train)
    if X_train_pca.shape[1] != args.n_components:
        raise RuntimeError(f"Dimensionality validation failed! Expected {args.n_components}, got {X_train_pca.shape[1]}")

    print(f"[Done] Training features transformed: {X_train_pca.shape} (dtype: {X_train_pca.dtype})")

    # 4. Save Train Quantum Features
    np.save(output_dir / "train_pca_features.npy", X_train_pca)
    np.save(output_dir / "train_labels.npy", y_train)
    np.save(output_dir / "train_study_ids.npy", ids_train)

    # 5. Transform Validation Set (if present) using SAME fitted pipeline
    X_val, y_val, ids_val = load_split_data(features_dir, "validation")
    if X_val is not None and len(X_val) > 0:
        X_val_pca = pipeline.transform(X_val)
        np.save(output_dir / "val_pca_features.npy", X_val_pca)
        np.save(output_dir / "val_labels.npy", y_val)
        np.save(output_dir / "val_study_ids.npy", ids_val)
        print(f"[Done] Validation features transformed: {X_val_pca.shape}")
    else:
        print("[Info] No validation samples present to transform.")

    # 6. Transform Test Set (if present) using SAME fitted pipeline
    X_test, y_test, ids_test = load_split_data(features_dir, "test")
    if X_test is not None and len(X_test) > 0:
        X_test_pca = pipeline.transform(X_test)
        np.save(output_dir / "test_pca_features.npy", X_test_pca)
        np.save(output_dir / "test_labels.npy", y_test)
        np.save(output_dir / "test_study_ids.npy", ids_test)
        print(f"[Done] Test features transformed: {X_test_pca.shape}")
    else:
        print("[Info] No test samples present to transform.")

    # 7. Save Model Artifacts
    pca_artifact_path = output_dir / "pca.pkl"
    metrics_path = output_dir / "pca_metrics.json"
    pipeline.save(pca_artifact_path, metrics_path)

    # Also persist directly into ML Service models directory for immediate runtime use
    pipeline.save(model_dir / "pca.pkl", model_dir / "pca_metrics.json")
    print(f"\n[Info] PCA Model artifact saved to: {model_dir / 'pca.pkl'}")
    print(f"[Info] Metrics saved to:            {metrics_path}")

    # 8. Display Metrics Summary
    metrics = pipeline.metrics
    print("\n" + "=" * 65)
    print("PCA DECOMPOSITION & FEATURE METRICS SUMMARY")
    print("=" * 65)
    print(f"{'Component':<12} | {'Explained Var':<14} | {'Var Ratio':<12} | {'Cumulative Ratio':<16}")
    print("-" * 65)
    for i in range(len(metrics["explained_variance"])):
        comp_name = f"PC{i+1}"
        var = metrics["explained_variance"][i]
        ratio = metrics["explained_variance_ratio"][i]
        cum_ratio = metrics["cumulative_explained_variance"][i]
        print(f"{comp_name:<12} | {var:<14.4f} | {ratio*100:<11.2f}% | {cum_ratio*100:<15.2f}%")
    print("-" * 65)
    print(f"Total Explained Variance: {metrics['total_explained_variance_ratio']*100:.2f}%")
    print("\nOutput Feature Value Ranges (Train Set Scaled for Quantum Encoding):")
    for i in range(args.n_components):
        f_min = metrics["train_feature_stats"]["min"][i]
        f_max = metrics["train_feature_stats"]["max"][i]
        f_mean = metrics["train_feature_stats"]["mean"][i]
        f_std = metrics["train_feature_stats"]["std"][i]
        print(f"  PC{i+1}: range [{f_min:.3f}, {f_max:.3f}] (mean={f_mean:+.3f}, std={f_std:.3f})")
    print("=" * 65)


if __name__ == "__main__":
    main()
