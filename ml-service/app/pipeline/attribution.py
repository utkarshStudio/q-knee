"""
Q-Knee 4D Quantum & Classical Feature Attribution Module
Computes signed feature attributions for the 4 PCA/quantum features:
feature_1 (PC1), feature_2 (PC2), feature_3 (PC3), feature_4 (PC4).
Uses Taylor-expansion sensitivity around baseline to decompose prediction score.
"""

from typing import Callable, Dict, Any, List, Optional
import numpy as np


def compute_feature_attribution(
    pca_features: np.ndarray,
    predict_fn: Callable[[np.ndarray], float],
    baseline: Optional[np.ndarray] = None,
    delta: float = 1e-3,
) -> Dict[str, Any]:
    """
    Decompose model prediction into signed attributions for the 4 PCA features.
    
    Attribution for feature i:
      a_i = (∂P / ∂x_i) * (x_i - baseline_i)
    
    Where:
      - Positive a_i (>0): Feature pushes prediction toward Abnormal (ACL Abnormality)
      - Negative a_i (<0): Feature pushes prediction toward Normal
      - Magnitude |a_i|: Relative importance of the feature in the decision
    """
    x = np.asarray(pca_features, dtype=np.float32).reshape(-1)[:4]
    n_features = len(x)

    if baseline is None:
        baseline = np.zeros(n_features, dtype=np.float32)
    else:
        baseline = np.asarray(baseline, dtype=np.float32).reshape(-1)[:4]

    # Baseline and current probabilities
    base_prob = float(predict_fn(baseline))
    final_prob = float(predict_fn(x))

    attributions: List[Dict[str, Any]] = []
    gradients: List[float] = []

    # Compute numerical partial derivatives: ∂P / ∂x_i
    for i in range(n_features):
        x_pos = x.copy()
        x_pos[i] += delta
        prob_pos = float(predict_fn(x_pos))

        x_neg = x.copy()
        x_neg[i] -= delta
        prob_neg = float(predict_fn(x_neg))

        grad_i = (prob_pos - prob_neg) / (2.0 * delta)
        gradients.append(grad_i)

        diff_i = float(x[i] - baseline[i])
        attr_i = float(grad_i * diff_i)

        attributions.append({
            "feature_name": f"feature_{i + 1}",
            "feature_label": f"PC{i + 1}",
            "feature_idx": i,
            "input_value": float(x[i]),
            "baseline_value": float(baseline[i]),
            "gradient": float(grad_i),
            "attribution_score": attr_i,
            "abs_attribution": abs(attr_i),
            "direction": "positive_abnormal" if attr_i >= 0 else "negative_normal",
            "contribution_description": (
                f"Pushes toward Abnormal (+{attr_i:.3f})"
                if attr_i >= 0
                else f"Pushes toward Normal ({attr_i:.3f})"
            ),
        })

    # Compute relative importance percentages
    total_abs = sum(a["abs_attribution"] for a in attributions) + 1e-8
    for a in attributions:
        a["relative_importance_pct"] = float((a["abs_attribution"] / total_abs) * 100.0)

    # Sort descending by absolute magnitude
    sorted_attributions = sorted(attributions, key=lambda a: a["abs_attribution"], reverse=True)
    dominant_feat = sorted_attributions[0]["feature_name"] if sorted_attributions else "feature_1"

    return {
        "attribution_method": "Taylor Gradient Sensitivity (Linear Attribution)",
        "base_probability": base_prob,
        "final_probability": final_prob,
        "dominant_feature": dominant_feat,
        "features": attributions,
        "sorted_by_importance": sorted_attributions,
        "scientific_disclaimer": "Feature attributions describe the mathematical influence of PCA latent components on the classifier output. They do not correlate 1:1 with specific anatomical tissue pathologies.",
    }