"""
Q-Knee Ingestion & Preprocessing Service
Comprehensive loader for DICOM (.dcm), NumPy (.npy, .npz), and standard image files (.png, .jpg).
Supports metadata-based physical slice sorting, window leveling (VOI LUT), photometric interpretation,
and consistent normalization for medical MRI studies.
"""

import io
import os
from pathlib import Path
from typing import List, Optional, Tuple, Union
import numpy as np
from PIL import Image

def apply_dicom_windowing(
    pixel_array: np.ndarray,
    window_center: Optional[Union[float, List[float]]] = None,
    window_width: Optional[Union[float, List[float]]] = None,
    rescale_slope: float = 1.0,
    rescale_intercept: float = 0.0,
    photometric_interpretation: str = "MONOCHROME2"
) -> np.ndarray:
    """
    Apply standard DICOM rescale slope/intercept and VOI window leveling.
    Returns normalized float32 array in [0.0, 1.0].
    """
    arr = pixel_array.astype(np.float32)

    # 1. Apply Modality Rescale Slope and Intercept (Hounsfield / linear scale)
    if rescale_slope != 1.0 or rescale_intercept != 0.0:
        arr = arr * rescale_slope + rescale_intercept

    # 2. Extract scalar window values if lists/multi-values provided
    if isinstance(window_center, (list, tuple, np.ndarray)):
        window_center = window_center[0] if len(window_center) > 0 else None
    if isinstance(window_width, (list, tuple, np.ndarray)):
        window_width = window_width[0] if len(window_width) > 0 else None

    # 3. Apply Window Leveling if available
    if window_center is not None and window_width is not None and float(window_width) > 0:
        c = float(window_center)
        w = float(window_width)
        lower = c - 0.5 - (w - 1.0) / 2.0
        upper = c - 0.5 + (w - 1.0) / 2.0
        arr = np.clip(arr, lower, upper)
        arr = (arr - lower) / (upper - lower + 1e-8)
    else:
        # Fallback: robust percentile min-max normalization (ignore extremes)
        p_low, p_high = np.percentile(arr, (0.5, 99.5))
        if p_high > p_low:
            arr = np.clip((arr - p_low) / (p_high - p_low), 0.0, 1.0)
        else:
            min_val = np.min(arr)
            max_val = np.max(arr)
            if max_val > min_val:
                arr = (arr - min_val) / (max_val - min_val)
            else:
                arr = np.zeros_like(arr)

    # 4. Invert MONOCHROME1 (where minimum value is intended to be displayed as white)
    if str(photometric_interpretation).upper() == "MONOCHROME1":
        arr = 1.0 - arr

    return np.clip(arr, 0.0, 1.0)


def read_dicom_slice(source: Union[str, Path, io.BytesIO, bytes]) -> Tuple[Optional[Image.Image], Optional[dict]]:
    """
    Safely load a single DICOM slice with metadata extraction and window normalization.
    Accepts file path (str/Path), BytesIO stream, or raw bytes.
    Returns (PIL Image, metadata_dict) or (None, None) if corrupted/invalid.
    """
    try:
        import pydicom
        if isinstance(source, bytes):
            source = io.BytesIO(source)

        ds = pydicom.dcmread(source, force=True)
        if not hasattr(ds, "pixel_array"):
            return None, None

        raw_pixels = ds.pixel_array
        # Handle 3D multi-frame arrays within a single DICOM file
        if raw_pixels.ndim == 3:
            mid = raw_pixels.shape[0] // 2
            raw_pixels = raw_pixels[mid]

        slope = float(getattr(ds, "RescaleSlope", 1.0))
        intercept = float(getattr(ds, "RescaleIntercept", 0.0))
        wc = getattr(ds, "WindowCenter", None)
        ww = getattr(ds, "WindowWidth", None)
        photo = str(getattr(ds, "PhotometricInterpretation", "MONOCHROME2"))

        norm_arr = apply_dicom_windowing(raw_pixels, wc, ww, slope, intercept, photo)
        uint8_arr = (norm_arr * 255.0).astype(np.uint8)
        img = Image.fromarray(uint8_arr).convert("RGB")

        # Extract spatial ordering metadata
        metadata = {
            "instance_number": getattr(ds, "InstanceNumber", None),
            "slice_location": getattr(ds, "SliceLocation", None),
            "image_position": getattr(ds, "ImagePositionPatient", None),
            "series_uid": getattr(ds, "SeriesInstanceUID", None),
            "study_uid": getattr(ds, "StudyInstanceUID", None),
            "rows": getattr(ds, "Rows", None),
            "columns": getattr(ds, "Columns", None),
            "photometric_interpretation": photo,
        }
        return img, metadata
    except Exception as e:
        print(f"[Warning] Failed to read DICOM source: {e}")
        return None, None


def sort_dicom_paths(file_paths: List[Union[str, Path]]) -> List[str]:
    """
    Sort DICOM file paths physically along the anatomical slice axis.
    Priority: ImagePositionPatient[2] (Z-coordinate) -> SliceLocation -> InstanceNumber -> filename.
    """
    parsed = []
    for p in file_paths:
        p_str = str(p)
        if not p_str.lower().endswith((".dcm", ".dicom")):
            parsed.append((p_str, 0.0, 0))
            continue

        try:
            import pydicom
            # Fast header-only read (stop_before_pixels=True)
            ds = pydicom.dcmread(p_str, stop_before_pixels=True, force=True)
            pos = getattr(ds, "ImagePositionPatient", None)
            loc = getattr(ds, "SliceLocation", None)
            inst = getattr(ds, "InstanceNumber", 0)

            if pos is not None and len(pos) >= 3:
                z_coord = float(pos[2])
            elif loc is not None:
                z_coord = float(loc)
            else:
                z_coord = float(inst if inst is not None else 0)

            parsed.append((p_str, z_coord, int(inst) if inst is not None else 0))
        except Exception:
            parsed.append((p_str, 0.0, 0))

    # Sort primarily by physical z-coordinate, secondarily by instance number
    parsed.sort(key=lambda x: (x[1], x[2], x[0]))
    return [x[0] for x in parsed]


def load_npy_volume(path: Union[str, Path]) -> List[Image.Image]:
    """
    Load a NumPy array (.npy or .npz) containing 2D or 3D MRI volume data.
    Supports shapes (D, H, W), (H, W, D), or (H, W).
    Returns list of slice PIL Images.
    """
    path_str = str(path)
    try:
        if path_str.lower().endswith(".npz"):
            with np.load(path_str) as data:
                # Pick first array in archive
                key = list(data.keys())[0]
                arr = data[key]
        else:
            arr = np.load(path_str)

        arr = arr.astype(np.float32)

        # Normalize volume to [0.0, 1.0]
        min_v = np.min(arr)
        max_v = np.max(arr)
        if max_v > min_v:
            arr = (arr - min_v) / (max_v - min_v)
        else:
            arr = np.zeros_like(arr)

        slices = []
        if arr.ndim == 2:
            # Single 2D slice
            u8 = (arr * 255.0).astype(np.uint8)
            slices.append(Image.fromarray(u8).convert("RGB"))
        elif arr.ndim == 3:
            # Determine depth axis (usually smallest or first dimension)
            if arr.shape[0] < arr.shape[1] and arr.shape[0] < arr.shape[2]:
                # (D, H, W)
                num_slices = arr.shape[0]
                for i in range(num_slices):
                    u8 = (arr[i] * 255.0).astype(np.uint8)
                    slices.append(Image.fromarray(u8).convert("RGB"))
            elif arr.shape[2] < arr.shape[0] and arr.shape[2] < arr.shape[1]:
                # (H, W, D)
                num_slices = arr.shape[2]
                for i in range(num_slices):
                    u8 = (arr[:, :, i] * 255.0).astype(np.uint8)
                    slices.append(Image.fromarray(u8).convert("RGB"))
            else:
                # Default to slice along axis 0
                for i in range(arr.shape[0]):
                    u8 = (arr[i] * 255.0).astype(np.uint8)
                    slices.append(Image.fromarray(u8).convert("RGB"))
        elif arr.ndim == 4:
            # (D, H, W, C) or (1, D, H, W)
            arr = arr.squeeze()
            return load_npy_volume_from_array(arr)

        return slices
    except Exception as e:
        print(f"[Warning] Failed to load NPY volume {path}: {e}")
        return []


def load_npy_volume_from_array(arr: np.ndarray) -> List[Image.Image]:
    """Helper to slice normalized 3D array into PIL Images."""
    arr = arr.astype(np.float32)
    min_v = np.min(arr)
    max_v = np.max(arr)
    if max_v > min_v:
        arr = (arr - min_v) / (max_v - min_v)
    else:
        arr = np.zeros_like(arr)

    slices = []
    if arr.ndim == 2:
        slices.append(Image.fromarray((arr * 255).astype(np.uint8)).convert("RGB"))
    elif arr.ndim >= 3:
        for i in range(arr.shape[0]):
            slc = arr[i]
            if slc.ndim > 2:
                slc = slc[:, :, 0]
            slices.append(Image.fromarray((slc * 255).astype(np.uint8)).convert("RGB"))
    return slices


def load_image_from_path(path: Union[str, Path]) -> Optional[Image.Image]:
    """
    Unified loader for a single file (.dcm, .npy, or image format).
    Returns RGB PIL Image or None on failure.
    """
    p_str = str(path)
    if p_str.lower().endswith((".dcm", ".dicom")):
        img, _ = read_dicom_slice(p_str)
        return img
    elif p_str.lower().endswith((".npy", ".npz")):
        slices = load_npy_volume(p_str)
        if slices:
            # Pick middle slice for single image representation
            return slices[len(slices) // 2]
        return None
    else:
        # Standard image (PNG, JPEG, BMP)
        try:
            img = Image.open(p_str).convert("RGB")
            return img
        except Exception as e:
            print(f"[Warning] Image load error for {p_str}: {e}")
            return None


def load_study_slices(file_paths: List[Union[str, Path]]) -> List[Image.Image]:
    """
    Load and sort all valid slices for an entire MRI study volume.
    Handles DICOM series, NPY volumes, and image sequences.
    """
    if not file_paths:
        return []

    # 1. Handle NPY file input
    if len(file_paths) == 1 and str(file_paths[0]).lower().endswith((".npy", ".npz")):
        return load_npy_volume(file_paths[0])

    # 2. Handle DICOM series: sort slices along physical Z-axis
    dcm_paths = [p for p in file_paths if str(p).lower().endswith((".dcm", ".dicom"))]
    if dcm_paths:
        sorted_paths = sort_dicom_paths(dcm_paths)
        valid_images = []
        for p in sorted_paths:
            img, _ = read_dicom_slice(p)
            if img is not None:
                valid_images.append(img)
        return valid_images

    # 3. Handle standard images
    valid_images = []
    for p in file_paths:
        img = load_image_from_path(p)
        if img is not None:
            valid_images.append(img)
    return valid_images


def select_representative_slices(
    slices: List[Image.Image],
    max_slices: int = 5
) -> List[Image.Image]:
    """
    Deterministically sample evenly-spaced representative slices from an MRI volume.
    Preserves anatomical coverage from superior to inferior margins.
    """
    n = len(slices)
    if n == 0:
        return []
    if n <= max_slices:
        return slices
    # Uniformly space across volume
    indices = np.linspace(0, n - 1, max_slices, dtype=int)
    return [slices[i] for i in indices]