"""
ResNet18 Feature Extraction Engine
Extracts 512-dimensional spatial embeddings per MRI slice using PyTorch ResNet18.
Provides deterministic study-level aggregation (mean/max/statistical pooling)
and consistent preprocessing between training, evaluation, and inference.
"""

import os
from typing import List, Optional, Union
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

_model = None
_transform = None
_device = None

def get_device() -> torch.device:
    """Return optimal computing device (CUDA if available, else CPU)."""
    global _device
    if _device is None:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _device

def get_resnet_feature_extractor(device: Optional[torch.device] = None):
    """
    Instantiate or return cached PyTorch ResNet18 model without final FC layer.
    Output: 512-dimensional continuous spatial feature representation.
    """
    global _model, _transform
    if device is None:
        device = get_device()

    if _model is None:
        base = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        # Truncate final FC layer: keep up to avgpool
        _model = nn.Sequential(*list(base.children())[:-1])
        _model.to(device)
        _model.eval()

        # Standard consistent medical image preprocessing pipeline:
        # Resize to 128x128 -> Convert Grayscale to 3-channel -> Normalize with ImageNet stats
        _transform = transforms.Compose([
            transforms.Resize((128, 128)),
            transforms.Grayscale(num_output_channels=3),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
    return _model, _transform

def preprocess_slice(image: Image.Image) -> torch.Tensor:
    """Transform a single PIL Image slice into a standardized (3, 128, 128) tensor."""
    _, transform = get_resnet_feature_extractor()
    return transform(image)

def extract_features_from_image(pil_image: Image.Image, device: Optional[torch.device] = None) -> np.ndarray:
    """
    Extract 512D ResNet18 feature vector from a single PIL image slice.
    Returns: (512,) float32 numpy array.
    """
    if device is None:
        device = get_device()

    model, transform = get_resnet_feature_extractor(device)
    tensor = transform(pil_image).unsqueeze(0).to(device)
    with torch.no_grad():
        features = model(tensor)
    return features.squeeze().cpu().numpy().astype(np.float32)

def extract_features_from_batch(images: List[Image.Image], device: Optional[torch.device] = None) -> np.ndarray:
    """
    Extract 512D features from a batch of PIL image slices.
    Returns: (N, 512) float32 numpy array.
    """
    if not images:
        return np.empty((0, 512), dtype=np.float32)

    if device is None:
        device = get_device()

    model, transform = get_resnet_feature_extractor(device)
    tensors = torch.stack([transform(img) for img in images]).to(device)
    with torch.no_grad():
        feats = model(tensors)
    return feats.squeeze(-1).squeeze(-1).cpu().numpy().astype(np.float32)

def aggregate_slice_features(
    slice_features: np.ndarray,
    strategy: str = "mean"
) -> np.ndarray:
    """
    Deterministically aggregate slice-level feature embeddings into a single 512D study vector.
    Strategies:
      - 'mean': Arithmetic average across all slices (default)
      - 'max': Elementwise maximum across slices
    Returns: (512,) float32 vector.
    """
    if slice_features.ndim == 1:
        return slice_features

    if slice_features.shape[0] == 0:
        return np.zeros(512, dtype=np.float32)

    if strategy == "max":
        return np.max(slice_features, axis=0)
    else:
        # Default: mean pooling
        return np.mean(slice_features, axis=0)

def extract_features_from_paths(
    file_paths: list,
    max_slices: int = 5,
    aggregation: str = "mean",
    device: Optional[torch.device] = None
) -> np.ndarray:
    """
    End-to-end extraction from a list of DICOM/NPY/image file paths:
    1. Loads and sorts slices along anatomical axis
    2. Samples up to max_slices representative slices
    3. Extracts 512D ResNet18 features per slice
    4. Aggregates to 512D study vector
    Returns: (512,) float32 vector.
    """
    from app.services.dicom_service import load_study_slices, select_representative_slices

    slices = load_study_slices(file_paths)
    if not slices:
        return np.zeros(512, dtype=np.float32)

    rep_slices = select_representative_slices(slices, max_slices=max_slices)
    batch_features = extract_features_from_batch(rep_slices, device=device)
    study_feature = aggregate_slice_features(batch_features, strategy=aggregation)
    return study_feature

def extract_study_features(
    slices: List[Image.Image],
    max_slices: int = 16,
    aggregation: str = "mean",
    device: Optional[torch.device] = None,
) -> np.ndarray:
    """Extract aggregated 512D feature vector from a list of PIL slices."""
    if not slices:
        return np.zeros(512, dtype=np.float32)
    from app.services.dicom_service import select_representative_slices
    rep_slices = select_representative_slices(slices, max_slices=max_slices)
    batch_features = extract_features_from_batch(rep_slices, device=device)
    return aggregate_slice_features(batch_features, strategy=aggregation)

def get_model_for_gradcam():
    """
    Return full ResNet18 model for Grad-CAM.
    Maintains identical preprocessing and layer4 hook target.
    """
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    model.fc = nn.Linear(512, 2)
    model.eval()
    transform = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    return model, transform