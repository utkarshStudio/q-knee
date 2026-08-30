"""
Q-Knee Production Classical vs Quantum Benchmarking CLI
Runs rigorous side-by-side evaluation of Classical SVM and Hybrid Quantum VQC
on the untouched test split. Generates JSON metrics and vector SVG plots.
"""

import os
import sys
import json
from pathlib import Path

# Add project root and ml-service to Python path
project_root = Path(__file__).parent.parent.resolve()
ml_service_dir = project_root / "ml-service"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.services.benchmark_service import run_benchmark


def main():
    print("=" * 70)
    print("Q-KNEE CLASSICAL BASELINE VS HYBRID QUANTUM VQC BENCHMARK")
    print("=" * 70)

    payload = run_benchmark(mode="REAL")

    ds_info = payload["dataset_information"]
    results = {r["model_name"]: r for r in payload["results"]}
    svm = results.get("ClassicalSVM", {})
    vqc = results.get("HybridVQC", {})

    print(f"Dataset Name:        {ds_info['dataset_name']}")
    print(f"Execution Mode:      {payload['mode']}")
    print(f"Total Studies:       {ds_info['total_studies']} (Train: {ds_info['train_samples']}, Test: {ds_info['test_samples']})")
    print(f"Train Class Balance: Abnormal: {ds_info['class_distribution']['train']['abnormal']}, Normal: {ds_info['class_distribution']['train']['normal']} (Ratio: {ds_info['class_distribution']['train']['imbalance_ratio']})")
    print(f"Test Class Balance:  Abnormal: {ds_info['class_distribution']['test']['abnormal']}, Normal: {ds_info['class_distribution']['test']['normal']} (Ratio: {ds_info['class_distribution']['test']['imbalance_ratio']})")

    if ds_info.get("small_sample_warning"):
        print("\n[NOTE / DISCLAIMER]:")
        print("  " + ds_info["scientific_note"])

    print("\n" + "=" * 70)
    print(f"{'Metric':<20} | {'Classical SVM':<18} | {'Hybrid Quantum VQC':<18} | {'Diff (VQC - SVM)':<12}")
    print("-" * 70)

    metrics = [
        ("Accuracy", "accuracy", "%"),
        ("Precision", "precision_score", ""),
        ("Recall (Sens.)", "recall", ""),
        ("Specificity", "specificity", ""),
        ("F1-Score", "f1", ""),
        ("ROC-AUC", "roc_auc", ""),
        ("Latency (ms)", "latency_ms", " ms"),
    ]

    for label, key, unit in metrics:
        s_val = svm.get(key, 0.0)
        q_val = vqc.get(key, 0.0)

        if unit == "%":
            s_str = f"{s_val * 100:.1f}%"
            q_str = f"{q_val * 100:.1f}%"
            diff = f"{(q_val - s_val) * 100:+.1f}%"
        elif unit == " ms":
            s_str = f"{s_val:.2f} ms"
            q_str = f"{q_val:.2f} ms"
            diff = f"{q_val - s_val:+.2f} ms"
        else:
            s_str = f"{s_val:.3f}"
            q_str = f"{q_val:.3f}"
            diff = f"{q_val - s_val:+.3f}"

        print(f"{label:<20} | {s_str:<18} | {q_str:<18} | {diff:<12}")

    print("-" * 70)

    # Confusion Matrices
    print("\nCONFUSION MATRICES (Untouched Test Set):")
    cm_s = svm.get("confusion_matrix", {})
    cm_q = vqc.get("confusion_matrix", {})

    print(f"  Classical SVM:       TP={cm_s.get('tp',0)}, FP={cm_s.get('fp',0)}, TN={cm_s.get('tn',0)}, FN={cm_s.get('fn',0)}")
    print(f"  Hybrid Quantum VQC:  TP={cm_q.get('tp',0)}, FP={cm_q.get('fp',0)}, TN={cm_q.get('tn',0)}, FN={cm_q.get('fn',0)}")

    print("\nSAVED BENCHMARK ARTIFACTS:")
    print("  - Results JSON:       ./data/benchmarks/benchmark_results.json")
    print("  - ROC Curve SVG:      ./data/benchmarks/roc_curve.svg")
    print("  - Confusion Matrix:   ./data/benchmarks/confusion_matrices.svg")
    print("  - Metrics Bar Chart:  ./data/benchmarks/metrics_comparison.svg")
    print("=" * 70)


if __name__ == "__main__":
    main()
