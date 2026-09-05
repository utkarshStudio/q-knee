"""
Q-Knee ResNet18 Grad-CAM Explainability Module
Generates visual class activation maps targeting the final convolutional layer of ResNet18 (layer4).
Produces original slice, colormapped heatmap, and blended overlay.
Supports multi-slice volume inspection and slice selection using pure NumPy colormaps.
"""

import os
import sys
import io
import base64
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from app.pipeline.feature_extractor import get_model_for_gradcam, preprocess_slice
from app.services.dicom_service import load_image_from_path, load_study_slices, load_npy_volume


# In-memory explanation cache
_gradcam_cache: Dict[str, Dict[str, Any]] = {}


def _apply_jet_colormap(cam_norm: np.ndarray) -> np.ndarray:
    """
    Exact Jet colormap conversion using pure NumPy without external library dependencies.
    Maps 2D float array in [0.0, 1.0] -> (H, W, 3) uint8 RGB array.
    """
    v = np.clip(cam_norm, 0.0, 1.0)
    # Red: clip(1.5 - |4v - 3|, 0, 1)
    r = np.clip(1.5 - np.abs(4.0 * v - 3.0), 0.0, 1.0)
    # Green: clip(1.5 - |4v - 2|, 0, 1)
    g = np.clip(1.5 - np.abs(4.0 * v - 2.0), 0.0, 1.0)
    # Blue: clip(1.5 - |4v - 1|, 0, 1)
    b = np.clip(1.5 - np.abs(4.0 * v - 1.0), 0.0, 1.0)

    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255.0).astype(np.uint8)


def _image_to_base64(pil_img: Image.Image) -> str:
    """Convert PIL image to base64 PNG data URI."""
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


def compute_gradcam_on_slice(
    pil_image: Image.Image,
    output_dir: Optional[Union[str, Path]] = None,
    label_idx: int = 1,
) -> Dict[str, Any]:
    """
    Compute Grad-CAM for a single 2D PIL image using ResNet18 layer4.
    Target layer: model.layer4[-1].conv2 (final conv layer of ResNet18).
    Returns dictionary with image paths, base64 data, and activation statistics.
    """
    model, transform = get_model_for_gradcam()

    # Target the last residual block conv layer
    target_layer = model.layer4[-1].conv2

    activations: Dict[str, torch.Tensor] = {}
    gradients: Dict[str, torch.Tensor] = {}

    def forward_hook(module, input_tensor, output_tensor):
        activations["value"] = output_tensor.detach()

    def backward_hook(module, grad_input, grad_output):
        gradients["value"] = grad_output[0].detach()

    handle_fwd = target_layer.register_forward_hook(forward_hook)
    handle_bwd = target_layer.register_full_backward_hook(backward_hook)

    try:
        # Preprocessing exactly matching feature extraction pipeline (128x128, ImageNet norm)
        tensor = transform(pil_image).unsqueeze(0)
        tensor.requires_grad_(True)

        output = model(tensor)
        model.zero_grad()

        # Score for target class (1: Abnormal, 0: Normal)
        score = output[0, label_idx]
        score.backward()
    finally:
        handle_fwd.remove()
        handle_bwd.remove()

    # 1. Global average pooling of gradients: α_k = 1/Z ∑∑ ∂y^c / ∂A^k_ij
    act = activations["value"].squeeze(0)    # (512, H_act, W_act)
    grad = gradients["value"].squeeze(0)     # (512, H_act, W_act)
    weights = grad.mean(dim=(1, 2))          # (512,)

    # 2. Linear combination + ReLU: L_Grad-CAM = ReLU(∑ α_k A^k)
    cam = torch.relu((weights[:, None, None] * act).sum(dim=0))  # (H_act, W_act)
    cam_np = cam.cpu().numpy()

    # 3. Normalize heatmap to [0.0, 1.0]
    cam_min, cam_max = cam_np.min(), cam_np.max()
    if cam_max > cam_min:
        cam_norm = (cam_np - cam_min) / (cam_max - cam_min + 1e-8)
    else:
        cam_norm = np.zeros_like(cam_np)

    # 4. Upsample to original image resolution
    img_w, img_h = pil_image.size
    cam_pil = Image.fromarray((cam_norm * 255.0).astype(np.uint8)).resize((img_w, img_h), Image.BILINEAR)
    cam_resized = np.array(cam_pil, dtype=np.float32) / 255.0

    # 5. Generate Colormapped Heatmap via Pure NumPy Jet
    heatmap_rgb = _apply_jet_colormap(cam_resized)
    heatmap_pil = Image.fromarray(heatmap_rgb)

    # 6. Generate 50/50 Overlay with Grayscale MRI
    orig_rgb = pil_image.convert("RGB").resize((img_w, img_h))
    orig_np = np.array(orig_rgb, dtype=np.float32)
    overlay_np = (0.5 * orig_np + 0.5 * heatmap_rgb.astype(np.float32)).astype(np.uint8)
    overlay_pil = Image.fromarray(overlay_np)

    result: Dict[str, Any] = {
        "max_activation": float(cam_max),
        "mean_activation": float(cam_norm.mean()),
        "target_layer": "ResNet18.layer4[1].conv2",
        "target_class": "abnormal" if label_idx == 1 else "normal",
        "image_size": [img_w, img_h],
        "original_b64": _image_to_base64(orig_rgb),
        "heatmap_b64": _image_to_base64(heatmap_pil),
        "overlay_b64": _image_to_base64(overlay_pil),
    }

    # Save to disk if output_dir provided
    if output_dir is not None:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        orig_file = out_path / "original.png"
        heat_file = out_path / "heatmap.png"
        over_file = out_path / "overlay.png"

        orig_rgb.save(orig_file)
        heatmap_pil.save(heat_file)
        overlay_pil.save(over_file)

        result["original"] = str(orig_file)
        result["heatmap"] = str(heat_file)
        result["overlay"] = str(over_file)

    return result


def compute_gradcam_for_volume(
    file_paths: List[Union[str, Path]],
    output_dir: Optional[Union[str, Path]] = None,
    slice_idx: Optional[int] = None,
    label_idx: int = 1,
    max_slices: int = 16,
) -> Dict[str, Any]:
    """
    Compute Grad-CAM across an MRI study volume.
    Supports DICOM series, NPY arrays, and image folders.
    Allows slice selection or automatic selection of peak activation slice.
    """
    slices: List[Image.Image] = []

    # 1. Load study slices via universal loader (DICOM, NPY, images)
    try:
        slices = load_study_slices(file_paths)
    except Exception:
        slices = []

    # 2. Fallback if no images could be read
    if not slices:
        for p in file_paths:
            img = load_image_from_path(str(p))
            if img is not None:
                slices.append(img)

    return compute_gradcam_for_slices(slices, output_dir, slice_idx, label_idx, max_slices)

def compute_gradcam_for_slices(
    slices: List[Image.Image],
    output_dir: Optional[Union[str, Path]] = None,
    slice_idx: Optional[int] = None,
    label_idx: int = 1,
    max_slices: int = 16,
) -> Dict[str, Any]:
    """
    Compute Grad-CAM across pre-loaded MRI study slices.
    """

    # 4. Fallback if no images could be read
    if not slices:
        raise ValueError("No valid MRI slices could be extracted from provided file paths.")

    total_slices = len(slices)

    # Subsample if volume is large
    if total_slices > max_slices:
        step = total_slices / max_slices
        sampled_indices = [int(i * step) for i in range(max_slices)]
        available_slices = [slices[i] for i in sampled_indices]
    else:
        sampled_indices = list(range(total_slices))
        available_slices = slices

    # Determine target slice index
    if slice_idx is not None and 0 <= slice_idx < len(available_slices):
        selected_idx = slice_idx
    else:
        # Default to middle slice
        selected_idx = len(available_slices) // 2

    target_slice = available_slices[selected_idx]
    actual_volume_index = sampled_indices[selected_idx]

    # Compute Grad-CAM on selected slice
    gradcam_res = compute_gradcam_on_slice(target_slice, output_dir=output_dir, label_idx=label_idx)

    return {
        "selected_slice_index": selected_idx,
        "volume_slice_index": actual_volume_index,
        "total_volume_slices": total_slices,
        "available_slices_count": len(available_slices),
        **gradcam_res,
        "scientific_disclaimer": "Grad-CAM visualizes convolutional feature activations of the ResNet18 backbone. It represents exploratory machine attention and does NOT constitute a confirmed medical or radiological diagnosis.",
    }


def compute_gradcam(
    pil_image: Image.Image,
    output_dir: Optional[Union[str, Path]] = None,
    label_idx: int = 1,
) -> Dict[str, Any]:
    """Compatibility wrapper for single image Grad-CAM."""
    return compute_gradcam_on_slice(pil_image, output_dir=output_dir, label_idx=label_idx)