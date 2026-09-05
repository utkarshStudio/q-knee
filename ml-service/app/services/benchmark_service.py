import os
import sys
import json
import time
import warnings
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

project_root = Path(__file__).parent.parent.parent.parent.resolve()
sys.path.insert(0, str(project_root))

from app.pipeline.classical_model import ClassicalSVM
from app.pipeline.quantum_model import VariationalQuantumClassifier, load_vqc, get_vqc_model
import app.pipeline.pca_handler as pca_handler
from app.config import config


def _compute_roc_points(y_true: np.ndarray, y_score: np.ndarray) -> Dict[str, List[float]]:
    """Compute empirical ROC curve points (FPR, TPR) across probability thresholds."""
    thresholds = np.linspace(0.0, 1.0, 21)
    fpr_list = []
    tpr_list = []

    pos_count = max(1, int(np.sum(y_true == 1)))
    neg_count = max(1, int(np.sum(y_true == 0)))

    for th in thresholds:
        preds = (y_score >= th).astype(int)
        tp = int(np.sum((preds == 1) & (y_true == 1)))
        fp = int(np.sum((preds == 1) & (y_true == 0)))
        tpr_list.append(float(tp / pos_count))
        fpr_list.append(float(fp / neg_count))

    # Sort by FPR
    points = sorted(zip(fpr_list, tpr_list), key=lambda x: x[0])
    return {
        "fpr": [p[0] for p in points],
        "tpr": [p[1] for p in points],
        "thresholds": [float(t) for t in thresholds],
    }


def _generate_roc_svg(svm_roc: Dict[str, List[float]], vqc_roc: Dict[str, List[float]], svm_auc: float, vqc_auc: float) -> str:
    """Generate high-resolution SVG of ROC curves."""
    w, h = 500, 350
    pad_l, pad_r, pad_t, pad_b = 50, 20, 30, 45
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b

    def pt(fpr, tpr):
        x = pad_l + fpr * plot_w
        y = pad_t + (1.0 - tpr) * plot_h
        return f"{x:.1f},{y:.1f}"

    svm_path = " ".join([f"{'M' if i==0 else 'L'} {pt(fpr, tpr)}" for i, (fpr, tpr) in enumerate(zip(svm_roc["fpr"], svm_roc["tpr"]))])
    vqc_path = " ".join([f"{'M' if i==0 else 'L'} {pt(fpr, tpr)}" for i, (fpr, tpr) in enumerate(zip(vqc_roc["fpr"], vqc_roc["tpr"]))])
    diag_path = f"M {pad_l},{pad_t + plot_h} L {pad_l + plot_w},{pad_t}"

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%" class="rounded-lg bg-white p-2">
  <style>
    .grid {{ stroke: #e2e8f0; stroke-dasharray: 4,4; stroke-width: 1; }}
    .axis {{ stroke: #64748b; stroke-width: 1.5; }}
    .lbl {{ font-family: system-ui, sans-serif; font-size: 11px; fill: #64748b; text-anchor: middle; }}
    .title {{ font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; fill: #0f172a; }}
    .legend {{ font-family: system-ui, sans-serif; font-size: 11px; fill: #334155; }}
  </style>
  <text x="{w/2}" y="18" text-anchor="middle" class="title">ROC Curves (Untouched Test Split)</text>
  <!-- Grid -->
  <line x1="{pad_l}" y1="{pad_t + plot_h/2}" x2="{pad_l + plot_w}" y2="{pad_t + plot_h/2}" class="grid" />
  <line x1="{pad_l + plot_w/2}" y1="{pad_t}" x2="{pad_l + plot_w/2}" y2="{pad_t + plot_h}" class="grid" />
  <!-- Axes -->
  <line x1="{pad_l}" y1="{pad_t + plot_h}" x2="{pad_l + plot_w}" y2="{pad_t + plot_h}" class="axis" />
  <line x1="{pad_l}" y1="{pad_t}" x2="{pad_l}" y2="{pad_t + plot_h}" class="axis" />
  <!-- Diagonal Chance -->
  <path d="{diag_path}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,5" fill="none" />
  <!-- Curves -->
  <path d="{svm_path}" stroke="#2563eb" stroke-width="2.5" fill="none" />
  <path d="{vqc_path}" stroke="#9333ea" stroke-width="2.5" fill="none" />
  <!-- Labels -->
  <text x="{pad_l + plot_w/2}" y="{h - 10}" class="lbl">False Positive Rate (1 - Specificity)</text>
  <text x="18" y="{pad_t + plot_h/2}" class="lbl" transform="rotate(-90 18 {pad_t + plot_h/2})">True Positive Rate (Sensitivity)</text>
  <!-- Ticks -->
  <text x="{pad_l}" y="{pad_t + plot_h + 16}" class="lbl">0.0</text>
  <text x="{pad_l + plot_w}" y="{pad_t + plot_h + 16}" class="lbl">1.0</text>
  <text x="{pad_l - 12}" y="{pad_t + plot_h}" class="lbl">0.0</text>
  <text x="{pad_l - 12}" y="{pad_t + 10}" class="lbl">1.0</text>
  <!-- Legend -->
  <rect x="{pad_l + plot_w - 190}" y="{pad_t + plot_h - 60}" width="180" height="50" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
  <line x1="{pad_l + plot_w - 180}" y1="{pad_t + plot_h - 45}" x2="{pad_l + plot_w - 160}" y2="{pad_t + plot_h - 45}" stroke="#2563eb" stroke-width="2.5" />
  <text x="{pad_l + plot_w - 150}" y="{pad_t + plot_h - 41}" class="legend">Classical SVM (AUC: {svm_auc:.2f})</text>
  <line x1="{pad_l + plot_w - 180}" y1="{pad_t + plot_h - 25}" x2="{pad_l + plot_w - 160}" y2="{pad_t + plot_h - 25}" stroke="#9333ea" stroke-width="2.5" />
  <text x="{pad_l + plot_w - 150}" y="{pad_t + plot_h - 21}" class="legend">Hybrid VQC (AUC: {vqc_auc:.2f})</text>
</svg>"""
    return svg


def _generate_confusion_matrix_svg(cm_svm: Dict[str, int], cm_vqc: Dict[str, int]) -> str:
    """Generate SVG visualization of confusion matrices for both models."""
    w, h = 500, 240
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%" class="rounded-lg bg-white p-2">
  <style>
    .title {{ font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; fill: #0f172a; text-anchor: middle; }}
    .subtitle {{ font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; fill: #334155; text-anchor: middle; }}
    .cell-lbl {{ font-family: system-ui, sans-serif; font-size: 10px; fill: #64748b; text-anchor: middle; }}
    .cell-val {{ font-family: system-ui, sans-serif; font-size: 16px; font-weight: 700; fill: #0f172a; text-anchor: middle; }}
    .axis-lbl {{ font-family: system-ui, sans-serif; font-size: 10px; fill: #475569; text-anchor: middle; }}
  </style>
  <text x="{w/2}" y="18" class="title">Confusion Matrices (Test Set)</text>

  <!-- Left: Classical SVM -->
  <g transform="translate(30, 35)">
    <text x="100" y="15" class="subtitle">Classical SVM</text>
    <!-- Header -->
    <text x="65" y="32" class="axis-lbl">Pred Abn</text>
    <text x="135" y="32" class="axis-lbl">Pred Norm</text>
    <text x="15" y="65" class="axis-lbl" transform="rotate(-90 15 65)">True Abn</text>
    <text x="15" y="125" class="axis-lbl" transform="rotate(-90 15 125)">True Norm</text>
    <!-- TP -->
    <rect x="30" y="40" width="70" height="55" rx="4" fill="#dbeafe" stroke="#93c5fd" />
    <text x="65" y="65" class="cell-val">{cm_svm['tp']}</text>
    <text x="65" y="82" class="cell-lbl">True Pos (TP)</text>
    <!-- FN -->
    <rect x="105" y="40" width="70" height="55" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
    <text x="140" y="65" class="cell-val">{cm_svm['fn']}</text>
    <text x="140" y="82" class="cell-lbl">False Neg (FN)</text>
    <!-- FP -->
    <rect x="30" y="100" width="70" height="55" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
    <text x="65" y="125" class="cell-val">{cm_svm['fp']}</text>
    <text x="65" y="142" class="cell-lbl">False Pos (FP)</text>
    <!-- TN -->
    <rect x="105" y="100" width="70" height="55" rx="4" fill="#dbeafe" stroke="#93c5fd" />
    <text x="140" y="125" class="cell-val">{cm_svm['tn']}</text>
    <text x="140" y="142" class="cell-lbl">True Neg (TN)</text>
  </g>

  <!-- Right: Hybrid Quantum VQC -->
  <g transform="translate(260, 35)">
    <text x="100" y="15" class="subtitle">Hybrid Quantum VQC</text>
    <!-- Header -->
    <text x="65" y="32" class="axis-lbl">Pred Abn</text>
    <text x="135" y="32" class="axis-lbl">Pred Norm</text>
    <text x="15" y="65" class="axis-lbl" transform="rotate(-90 15 65)">True Abn</text>
    <text x="15" y="125" class="axis-lbl" transform="rotate(-90 15 125)">True Norm</text>
    <!-- TP -->
    <rect x="30" y="40" width="70" height="55" rx="4" fill="#f3e8ff" stroke="#d8b4fe" />
    <text x="65" y="65" class="cell-val">{cm_vqc['tp']}</text>
    <text x="65" y="82" class="cell-lbl">True Pos (TP)</text>
    <!-- FN -->
    <rect x="105" y="40" width="70" height="55" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
    <text x="140" y="65" class="cell-val">{cm_vqc['fn']}</text>
    <text x="140" y="82" class="cell-lbl">False Neg (FN)</text>
    <!-- FP -->
    <rect x="30" y="100" width="70" height="55" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
    <text x="65" y="125" class="cell-val">{cm_vqc['fp']}</text>
    <text x="65" y="142" class="cell-lbl">False Pos (FP)</text>
    <!-- TN -->
    <rect x="105" y="100" width="70" height="55" rx="4" fill="#f3e8ff" stroke="#d8b4fe" />
    <text x="140" y="125" class="cell-val">{cm_vqc['tn']}</text>
    <text x="140" y="142" class="cell-lbl">True Neg (TN)</text>
  </g>
</svg>"""
    return svg


def _generate_metrics_bar_svg(svm_m: Dict[str, float], vqc_m: Dict[str, float]) -> str:
    """Generate SVG bar chart comparing core classification metrics."""
    w, h = 500, 240
    metrics_keys = ["Accuracy", "Precision", "Recall", "F1-Score", "ROC-AUC"]
    svm_vals = [svm_m["accuracy"], svm_m["precision"], svm_m["recall"], svm_m["f1"], svm_m["roc_auc"]]
    vqc_vals = [vqc_m["accuracy"], vqc_m["precision"], vqc_m["recall"], vqc_m["f1"], vqc_m["roc_auc"]]

    pad_l, pad_b, pad_t = 40, 40, 30
    group_w = (w - pad_l - 20) / len(metrics_keys)
    bar_w = 26
    chart_h = h - pad_b - pad_t

    bars_svg = []
    for i, name in enumerate(metrics_keys):
        gx = pad_l + i * group_w + group_w / 2
        # SVM bar
        s_val = max(0.0, min(1.0, svm_vals[i]))
        s_h = s_val * chart_h
        s_y = pad_t + chart_h - s_h
        s_x = gx - bar_w - 2
        bars_svg.append(f'<rect x="{s_x:.1f}" y="{s_y:.1f}" width="{bar_w}" height="{s_h:.1f}" rx="3" fill="#2563eb" />')
        bars_svg.append(f'<text x="{s_x + bar_w/2:.1f}" y="{max(pad_t + 12, s_y - 4):.1f}" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="600" fill="#1e40af">{s_val:.2f}</text>')

        # VQC bar
        v_val = max(0.0, min(1.0, vqc_vals[i]))
        v_h = v_val * chart_h
        v_y = pad_t + chart_h - v_h
        v_x = gx + 2
        bars_svg.append(f'<rect x="{v_x:.1f}" y="{v_y:.1f}" width="{bar_w}" height="{v_h:.1f}" rx="3" fill="#9333ea" />')
        bars_svg.append(f'<text x="{v_x + bar_w/2:.1f}" y="{max(pad_t + 12, v_y - 4):.1f}" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="600" fill="#6b21a8">{v_val:.2f}</text>')

        # Group label
        bars_svg.append(f'<text x="{gx:.1f}" y="{h - 15}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">{name}</text>')

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%" class="rounded-lg bg-white p-2">
  <style>
    .title {{ font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; fill: #0f172a; text-anchor: middle; }}
    .grid {{ stroke: #e2e8f0; stroke-dasharray: 3,3; stroke-width: 1; }}
  </style>
  <text x="{w/2}" y="18" class="title">Metric Comparison (Classical SVM vs Hybrid VQC)</text>
  <!-- Grid Lines -->
  <line x1="{pad_l}" y1="{pad_t}" x2="{w - 20}" y2="{pad_t}" class="grid" />
  <line x1="{pad_l}" y1="{pad_t + chart_h/2}" x2="{w - 20}" y2="{pad_t + chart_h/2}" class="grid" />
  <line x1="{pad_l}" y1="{pad_t + chart_h}" x2="{w - 20}" y2="{pad_t + chart_h}" stroke="#cbd5e1" stroke-width="1.5" />
  <!-- Ticks -->
  <text x="{pad_l - 8}" y="{pad_t + 4}" text-anchor="end" font-family="sans-serif" font-size="9" fill="#94a3b8">1.0</text>
  <text x="{pad_l - 8}" y="{pad_t + chart_h/2 + 4}" text-anchor="end" font-family="sans-serif" font-size="9" fill="#94a3b8">0.5</text>
  <text x="{pad_l - 8}" y="{pad_t + chart_h + 4}" text-anchor="end" font-family="sans-serif" font-size="9" fill="#94a3b8">0.0</text>
  <!-- Bars -->
  {''.join(bars_svg)}
</svg>"""
    return svg


def run_benchmark(mode: str = "REAL") -> Dict[str, Any]:
    """
    Execute full classical vs hybrid quantum benchmark on held-out test data.
    Saves JSON results and SVG plots.
    """
    data_dir = Path("./data/quantum_features").resolve()
    model_dir = Path(config.MODEL_DIR).resolve()
    benchmarks_dir = Path("./data/benchmarks").resolve()
    frontend_benchmarks_dir = Path("./frontend/public/benchmarks").resolve()

    benchmarks_dir.mkdir(parents=True, exist_ok=True)
    frontend_benchmarks_dir.mkdir(parents=True, exist_ok=True)

    # 1. Check for real quantum features
    train_feat_path = data_dir / "train_pca_features.npy"
    train_lbl_path = data_dir / "train_labels.npy"
    test_feat_path = data_dir / "test_pca_features.npy"
    test_lbl_path = data_dir / "test_labels.npy"

    if train_feat_path.exists() and test_feat_path.exists():
        X_train = np.load(train_feat_path)
        y_train = np.load(train_lbl_path)
        X_test = np.load(test_feat_path)
        y_test = np.load(test_lbl_path)
        dataset_source = "RSNA Knee Abnormality Detection (Real Multi-Slice MRI)"
        execution_mode = "REAL"
    else:
        raise ValueError("Real quantum features not found. Please train models on real dataset first.")

    n_train = len(y_train)
    n_test = len(y_test)
    train_pos = int(np.sum(y_train == 1))
    train_neg = int(np.sum(y_train == 0))
    test_pos = int(np.sum(y_test == 1))
    test_neg = int(np.sum(y_test == 0))

    # 2. Train and Evaluate Classical SVM
    svm = ClassicalSVM(random_seed=42)
    svm.fit_and_tune(X_train, y_train)
    svm_eval = svm.evaluate(X_test, y_test)
    svm.save(model_dir)

    # Measure latency
    t_svm0 = time.perf_counter()
    for _ in range(min(20, len(X_test))):
        _ = svm.predict_sample(X_test[0])
    svm_lat = (time.perf_counter() - t_svm0) / min(20, len(X_test)) * 1000.0
    svm_eval["latency_ms"] = float(svm_lat)

    # 3. Load or Train Hybrid Quantum VQC
    vqc = get_vqc_model()
    if vqc is None or not vqc.is_trained:
        vqc = VariationalQuantumClassifier(n_qubits=4, depth=2, backend_name="default.qubit", random_seed=42)
        vqc.train(X_train, y_train, epochs=20, lr=0.05)
        vqc.save(model_dir)

    vqc_eval_raw = vqc.evaluate(X_test, y_test)
    vqc_preds, vqc_probs = vqc.predict_batch(X_test)

    # Confusion matrix for VQC
    tp_q = int(np.sum((vqc_preds == 1) & (y_test == 1)))
    fp_q = int(np.sum((vqc_preds == 1) & (y_test == 0)))
    fn_q = int(np.sum((vqc_preds == 0) & (y_test == 1)))
    tn_q = int(np.sum((vqc_preds == 0) & (y_test == 0)))
    spec_q = float(tn_q / (tn_q + fp_q)) if (tn_q + fp_q) > 0 else 0.0

    # Latency for VQC
    t_vqc0 = time.perf_counter()
    for _ in range(min(10, len(X_test))):
        _ = vqc.forward(X_test[0])
    vqc_lat = (time.perf_counter() - t_vqc0) / min(10, len(X_test)) * 1000.0

    vqc_eval = {
        "accuracy": vqc_eval_raw["accuracy"],
        "precision": vqc_eval_raw["precision"],
        "recall": vqc_eval_raw["recall"],
        "f1": vqc_eval_raw["f1"],
        "specificity": spec_q,
        "roc_auc": vqc_eval_raw["roc_auc"],
        "confusion_matrix": {"tp": tp_q, "fp": fp_q, "tn": tn_q, "fn": fn_q},
        "sample_count": n_test,
        "latency_ms": float(vqc_lat),
    }

    # 4. ROC Curves
    _, svm_probs = svm.predict_batch(X_test)
    svm_roc = _compute_roc_points(y_test, svm_probs)
    vqc_roc = _compute_roc_points(y_test, vqc_probs)

    # 5. Generate Visual Charts (SVG)
    roc_svg = _generate_roc_svg(svm_roc, vqc_roc, svm_eval["roc_auc"], vqc_eval["roc_auc"])
    cm_svg = _generate_confusion_matrix_svg(svm_eval["confusion_matrix"], vqc_eval["confusion_matrix"])
    bar_svg = _generate_metrics_bar_svg(svm_eval, vqc_eval)

    # Save SVGs to disk and frontend public folder
    for folder in [benchmarks_dir, frontend_benchmarks_dir]:
        with open(folder / "roc_curve.svg", "w", encoding="utf-8") as f:
            f.write(roc_svg)
        with open(folder / "confusion_matrices.svg", "w", encoding="utf-8") as f:
            f.write(cm_svg)
        with open(folder / "metrics_comparison.svg", "w", encoding="utf-8") as f:
            f.write(bar_svg)

    # 6. Format Comprehensive Benchmark Payload
    dataset_info = {
        "dataset_name": dataset_source,
        "mode": execution_mode,
        "total_studies": n_train + n_test,
        "train_samples": n_train,
        "test_samples": n_test,
        "class_distribution": {
            "train": {"abnormal": train_pos, "normal": train_neg, "imbalance_ratio": f"{train_pos}:{train_neg}"},
            "test": {"abnormal": test_pos, "normal": test_neg, "imbalance_ratio": f"{test_pos}:{test_neg}"},
        },
        "small_sample_warning": n_test < 50,
        "scientific_note": "Experimental comparison under exploratory research conditions. Small evaluation set size precludes claims of quantum advantage.",
    }

    results = [
        {
            "model_name": "ClassicalSVM",
            "model_family": "Classical Baseline",
            "mode": execution_mode,
            "sample_count": n_test,
            "accuracy": svm_eval["accuracy"],
            "precision_score": svm_eval["precision"],
            "recall": svm_eval["recall"],
            "f1": svm_eval["f1"],
            "specificity": svm_eval["specificity"],
            "roc_auc": svm_eval["roc_auc"],
            "latency_ms": svm_eval["latency_ms"],
            "confusion_matrix": svm_eval["confusion_matrix"],
            "model_configuration": {
                "model": "Support Vector Machine",
                "kernel": svm.best_params.get("kernel", "rbf"),
                "C": svm.best_params.get("C", 1.0),
                "gamma": svm.best_params.get("gamma", "scale"),
            },
        },
        {
            "model_name": "HybridVQC",
            "model_family": "Hybrid Quantum-Classical",
            "mode": "SIMULATION",
            "sample_count": n_test,
            "accuracy": vqc_eval["accuracy"],
            "precision_score": vqc_eval["precision"],
            "recall": vqc_eval["recall"],
            "f1": vqc_eval["f1"],
            "specificity": vqc_eval["specificity"],
            "roc_auc": vqc_eval["roc_auc"],
            "latency_ms": vqc_eval["latency_ms"],
            "confusion_matrix": vqc_eval["confusion_matrix"],
            "model_configuration": {
                "model": "Variational Quantum Classifier",
                "qubits": 4,
                "depth": 2,
                "encoding": "Angle Encoding (RY)",
                "ansatz": "RZ-RX-RZ + Circular CNOT",
                "backend": vqc.active_backend,
            },
        },
    ]

    benchmark_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "mode": execution_mode,
        "dataset_information": dataset_info,
        "results": results,
        "charts": {
            "roc_curve_svg": "/benchmarks/roc_curve.svg",
            "confusion_matrices_svg": "/benchmarks/confusion_matrices.svg",
            "metrics_comparison_svg": "/benchmarks/metrics_comparison.svg",
        },
        "random_seed": 42,
    }

    # Save to JSON
    with open(benchmarks_dir / "benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(benchmark_payload, f, indent=2)
    with open(frontend_benchmarks_dir / "benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(benchmark_payload, f, indent=2)

    return benchmark_payload