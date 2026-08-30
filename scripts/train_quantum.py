"""
Q-Knee Production Quantum Training CLI - Train VQC
Trains 4-qubit Variational Quantum Classifier on 4D PCA features using PennyLane.
Applies parameter-shift analytical gradients, class imbalance weighting,
validation-based early stopping, test evaluation, and latency benchmarking.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
import numpy as np

# Add project root and ml-service to Python path
project_root = Path(__file__).parent.parent.resolve()
ml_service_dir = project_root / "ml-service"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.pipeline.quantum_model import VariationalQuantumClassifier

def parse_args():
    parser = argparse.ArgumentParser(description="Train 4-Qubit Variational Quantum Classifier (VQC) for Knee Abnormality Detection.")
    parser.add_argument("--features_dir", type=str, default="./data/quantum_features", help="Directory containing 4D PCA features (.npy).")
    parser.add_argument("--model_dir", type=str, default="./ml-service/models", help="Directory to save vqc_weights.npy and vqc_config.json.")
    parser.add_argument("--depth", type=int, default=2, help="Number of variational layers (default: 2).")
    parser.add_argument("--epochs", type=int, default=30, help="Maximum training epochs (default: 30).")
    parser.add_argument("--lr", type=float, default=0.05, help="Learning rate for parameter-shift SGD (default: 0.05).")
    parser.add_argument("--patience", type=int, default=6, help="Early stopping patience (default: 6).")
    parser.add_argument("--backend", type=str, default="default.qubit", help="Quantum simulation backend.")
    parser.add_argument("--class_weight", type=str, default="balanced", choices=["balanced", "uniform"], help="Class weighting strategy.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    return parser.parse_args()


def load_array(path: Path) -> Optional[np.ndarray]:
    if path.exists():
        return np.load(path)
    return None


def main():
    args = parse_args()
    features_dir = Path(args.features_dir).resolve()
    model_dir = Path(args.model_dir).resolve()
    model_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("Q-KNEE 4-QUBIT VARIATIONAL QUANTUM CLASSIFIER (VQC) TRAINING")
    print("=" * 65)
    print(f"Features Directory: {features_dir}")
    print(f"Model Save Directory:{model_dir}")
    print(f"Quantum Qubits:     4 (1:1 Angle Encoding from PCA)")
    print(f"Variational Depth:  {args.depth}")
    print(f"Max Epochs:         {args.epochs}")
    print(f"Learning Rate:      {args.lr}")
    print(f"Random Seed:        {args.seed}")
    print(f"Target Backend:     {args.backend}")

    # 1. Load Training Data
    X_train = load_array(features_dir / "train_pca_features.npy")
    y_train = load_array(features_dir / "train_labels.npy")

    if X_train is None or y_train is None:
        print(f"\n[Error] Training quantum features not found in {features_dir}")
        print("Please run 'python scripts/fit_pca.py' first.")
        sys.exit(1)

    print(f"\n[Info] Loaded Training Data:   {X_train.shape[0]} samples (features: {X_train.shape[1]})")

    # 2. Load Validation & Test Data if present
    X_val = load_array(features_dir / "val_pca_features.npy")
    y_val = load_array(features_dir / "val_labels.npy")
    X_test = load_array(features_dir / "test_pca_features.npy")
    y_test = load_array(features_dir / "test_labels.npy")

    if X_val is not None and y_val is not None and len(X_val) > 0:
        print(f"[Info] Loaded Validation Data: {X_val.shape[0]} samples")
    else:
        X_val, y_val = None, None

    if X_test is not None and y_test is not None and len(X_test) > 0:
        print(f"[Info] Loaded Test Data:       {X_test.shape[0]} samples")
    else:
        X_test, y_test = None, None

    # 3. Instantiate Quantum Model
    vqc = VariationalQuantumClassifier(
        n_qubits=4,
        depth=args.depth,
        backend_name=args.backend,
        random_seed=args.seed,
    )

    # 4. Train with Parameter-Shift analytical gradients
    train_metadata = vqc.train(
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        epochs=args.epochs,
        lr=args.lr,
        patience=args.patience,
        class_weight=args.class_weight,
    )

    # 5. Evaluate on Test Set
    test_metrics = None
    if X_test is not None and y_test is not None and len(X_test) > 0:
        print("\n[Info] Evaluating on held-out test split...")
        test_metrics = vqc.evaluate(X_test, y_test)
        train_metadata["test_metrics"] = test_metrics

    # 6. Benchmark Simulator Latency
    print("[Info] Benchmarking quantum simulator inference latency...")
    warmup_vec = X_train[0]
    for _ in range(5):
        _ = vqc.forward(warmup_vec)

    latencies = []
    for i in range(min(20, len(X_train))):
        t0 = time.perf_counter()
        _ = vqc.forward(X_train[i])
        latencies.append((time.perf_counter() - t0) * 1000.0)

    mean_lat = float(np.mean(latencies))
    std_lat = float(np.std(latencies))
    train_metadata["latency_benchmark"] = {
        "mean_latency_ms": mean_lat,
        "std_latency_ms": std_lat,
        "evaluations": len(latencies),
    }

    # 7. Save Model Checkpoints & Artifacts
    vqc.save(model_dir)
    # Also save copy in features_dir
    vqc.save(features_dir)

    print(f"\n[Done] Quantum model weights saved to: {model_dir / 'vqc_weights.npy'}")
    print(f"[Done] Circuit metadata saved to:      {model_dir / 'vqc_config.json'}")

    # 8. Print Results Table
    print("\n" + "=" * 65)
    print("QUANTUM VQC TRAINING & EVALUATION SUMMARY")
    print("=" * 65)
    print(f"Backend Used:        {vqc.active_backend}")
    print(f"Circuit Architecture:4 Qubits | {args.depth} Variational Layers | Circular CNOT")
    print(f"Training Time:       {train_metadata['training_time_seconds']:.2f} seconds ({train_metadata['total_epochs_trained']} epochs)")
    print(f"Best Training Loss:  {train_metadata['best_train_loss']:.4f}")
    print(f"Best Val Loss:       {train_metadata['best_val_loss']:.4f}")
    print(f"Best Val Accuracy:   {train_metadata['best_val_accuracy']*100:.1f}%")
    print(f"Best Val ROC-AUC:    {train_metadata['best_val_roc_auc']:.3f}")
    print("-" * 65)
    if test_metrics:
        print("HELD-OUT TEST SET METRICS:")
        print(f"  Test Loss:         {test_metrics['loss']:.4f}")
        print(f"  Test Accuracy:     {test_metrics['accuracy']*100:.1f}% ({test_metrics['sample_count']} samples)")
        print(f"  Test Precision:    {test_metrics['precision']:.3f}")
        print(f"  Test Recall:       {test_metrics['recall']:.3f}")
        print(f"  Test F1-Score:     {test_metrics['f1']:.3f}")
        print(f"  Test ROC-AUC:      {test_metrics['roc_auc']:.3f}")
        print("-" * 65)
    print(f"Mean Inference Latency: {mean_lat:.2f} ± {std_lat:.2f} ms/sample")
    print("=" * 65)


if __name__ == "__main__":
    main()
