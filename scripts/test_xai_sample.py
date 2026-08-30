"""
End-to-End XAI Verification Script:
Tests Grad-CAM and 4D PCA Feature Attribution on real MRI volume sample.
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

from app.pipeline.gradcam import compute_gradcam_for_volume
from app.pipeline.attribution import compute_feature_attribution
import app.pipeline.quantum_model as quantum_model
import app.pipeline.pca_handler as pca_handler
from app.pipeline.feature_extractor import extract_study_features
from app.services.dicom_service import load_study_slices


def main():
    sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"
    print("=" * 65)
    print("Q-KNEE EXPLAINABILITY (XAI) VALIDATION ON REAL MRI SAMPLE")
    print("=" * 65)
    print(f"Sample Path: {sample_path.resolve()}")

    if not sample_path.exists():
        print(f"[Error] Sample file not found: {sample_path}")
        sys.exit(1)

    out_dir = project_root / "data" / "sample_mri_dataset" / "study_001_xai"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Grad-CAM Computation
    print("\n[1] Computing Visual Grad-CAM Attention Maps...")
    gradcam_res = compute_gradcam_for_volume(
        [str(sample_path)],
        output_dir=out_dir,
        slice_idx=4,
        label_idx=1,
    )

    print(f"  Target Layer:       {gradcam_res['target_layer']}")
    print(f"  Target Class:       {gradcam_res['target_class']}")
    print(f"  Selected Slice:     {gradcam_res['selected_slice_index']} (Volume Slice Index: {gradcam_res['volume_slice_index']} of {gradcam_res['total_volume_slices']})")
    print(f"  Max Activation:     {gradcam_res['max_activation']:.4f}")
    print(f"  Mean Activation:    {gradcam_res['mean_activation']:.4f}")
    print(f"  Original Image:     {gradcam_res['original']}")
    print(f"  Grad-CAM Heatmap:   {gradcam_res['heatmap']}")
    print(f"  Grad-CAM Overlay:   {gradcam_res['overlay']}")

    # 2. Feature Attribution Computation
    print("\n[2] Computing 4D Latent Feature Attributions...")
    pca_handler.load_pca()
    slices = load_study_slices([str(sample_path)])
    feat_512 = extract_study_features(slices)
    pca_feat = pca_handler.transform(feat_512.reshape(1, -1))[0]

    vqc = quantum_model.get_vqc_model()
    if vqc is None or not vqc.is_trained:
        quantum_model.load_vqc()
        vqc = quantum_model.get_vqc_model()

    def pred_fn(x):
        return vqc.predict_sample(x)["abnormal_probability"]

    attr_res = compute_feature_attribution(pca_feat, pred_fn)

    print(f"  Attribution Method: {attr_res['attribution_method']}")
    print(f"  Dominant Feature:   {attr_res['dominant_feature']}")
    print(f"  Base Probability:   {attr_res['base_probability']:.4f}")
    print(f"  Final Probability:  {attr_res['final_probability']:.4f}")
    print("\n  Per-Feature Attributions:")
    for f in attr_res["features"]:
        print(f"    {f['feature_name']} ({f['feature_label']}): input={f['input_value']:+.3f} | attribution={f['attribution_score']:+.4f} | {f['direction']} ({f['relative_importance_pct']:.1f}%)")

    print("\n" + "=" * 65)
    print("XAI VALIDATION COMPLETED SUCCESSFULLY")
    print("=" * 65)


if __name__ == "__main__":
    main()
