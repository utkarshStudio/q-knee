"""DEMO synthetic data generator for training and testing."""
import numpy as np
from PIL import Image

def generate_demo_features(n_samples: int = 60, n_features: int = 512, seed: int = 42) -> tuple:
    """
    Generate synthetic 512D features and binary labels.
    Class 0=normal, 1=abnormal. Class-conditional Gaussian.
    Returns: X (N, 512), y (N,) in {0,1}, mode="DEMO"
    """
    rng = np.random.default_rng(seed)
    half = n_samples // 2
    X_normal = rng.normal(loc=-0.5, scale=1.0, size=(half, n_features)).astype(np.float32)
    X_abnormal = rng.normal(loc=0.5, scale=1.0, size=(n_samples - half, n_features)).astype(np.float32)
    X = np.vstack([X_normal, X_abnormal])
    y = np.array([0] * half + [1] * (n_samples - half), dtype=int)
    shuffle_idx = rng.permutation(n_samples)
    return X[shuffle_idx], y[shuffle_idx]

def generate_demo_image(size: int = 128, seed: int = 0) -> Image.Image:
    """Generate a synthetic grayscale image for demo purposes."""
    rng = np.random.default_rng(seed)
    arr = rng.integers(100, 200, size=(size, size), dtype=np.uint8)
    # Add some structure
    cx, cy = size // 2, size // 2
    for r in range(20, 40):
        for t in range(0, 360, 5):
            import math
            x = int(cx + r * math.cos(math.radians(t)))
            y = int(cy + r * math.sin(math.radians(t)))
            if 0 <= x < size and 0 <= y < size:
                arr[y, x] = 220
    return Image.fromarray(arr).convert("RGB")