import numpy as np
import pytest
from app.services.dicom_service import load_npy_volume_from_array

def test_multi_plane_extraction():
    # Create deterministic volume (D=3, H=4, W=5)
    # Value = z*100 + y*10 + x
    volume = np.zeros((3, 4, 5), dtype=np.float32)
    for z in range(3):
        for y in range(4):
            for x in range(5):
                volume[z, y, x] = z*100 + y*10 + x
                
    # Axial (default)
    slices_axial = load_npy_volume_from_array(volume, plane="axial")
    assert len(slices_axial) == 3
    # Axial slices along Z. The shape of each slice image is (W, H) in PIL, but the array is (H, W) -> (4, 5).
    # Since load_npy_volume_from_array normalizes everything to 0-1 and scales to 255, we can't easily check exact values
    # but we can check lengths.
    assert slices_axial[0].size == (5, 4)
    
    # Coronal
    slices_coronal = load_npy_volume_from_array(volume, plane="coronal")
    assert len(slices_coronal) == 4
    # Expected Image shape for coronal is (W, D) -> (5, 3)
    assert slices_coronal[0].size == (5, 3)
    
    # Sagittal
    slices_sagittal = load_npy_volume_from_array(volume, plane="sagittal")
    assert len(slices_sagittal) == 5
    # Expected Image shape for sagittal is (D, H) -> (3, 4)
    assert slices_sagittal[0].size == (3, 4)
    
def test_invalid_plane():
    volume = np.zeros((3, 4, 5), dtype=np.float32)
    # Should default to axial
    slices = load_npy_volume_from_array(volume, plane="invalid")
    assert len(slices) == 3
    assert slices[0].size == (5, 4)
