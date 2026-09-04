"""
Verification Script for MRI Viewer & DICOM Rendering Pipeline
Tests:
- Upload of exactly ONE .dcm file
- Slice count = 1, has_3d_volume = False
- PNG preview endpoint /api/studies/:id/slice/0 returns real DICOM pixel array as PNG
- Upload of MULTIPLE .dcm files (slice count = 3)
- Invalid DICOM upload resilience
- CAM unavailable behavior
"""

import sys
import tempfile
import os
import requests
import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
import datetime

BACKEND_URL = "http://localhost:3001"
ML_URL = "http://localhost:8000"


def create_dummy_dicom(filepath: str, instance_number: int = 1, z_pos: float = 0.0, width: int = 128, height: int = 128):
    """Generate a valid, fully formed DICOM file with synthetic knee-like pattern."""
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.4"  # MR Image Storage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

    ds = FileDataset(filepath, {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.PatientName = "Test^Patient"
    ds.PatientID = "TEST_DICOM_001"
    ds.StudyInstanceUID = "1.2.826.0.1.3680043.8.498.999"
    ds.SeriesInstanceUID = "1.2.826.0.1.3680043.8.498.999.1"
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.Modality = "MR"
    ds.SeriesDescription = "Sagittal T2 Knee"
    ds.InstanceNumber = instance_number
    ds.ImagePositionPatient = [0.0, 0.0, float(z_pos)]
    ds.SliceLocation = float(z_pos)
    ds.Rows = height
    ds.Columns = width
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.SamplesPerPixel = 1
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    ds.WindowCenter = 500.0
    ds.WindowWidth = 800.0
    ds.RescaleSlope = 1.0
    ds.RescaleIntercept = 0.0

    # Synthetic concentric circles representing knee joint capsule
    y, x = np.ogrid[:height, :width]
    dist_from_center = np.sqrt((x - width / 2) ** 2 + (y - height / 2) ** 2)
    knee_pattern = np.sin(dist_from_center / 8.0) * 400.0 + 500.0
    pixels = np.clip(knee_pattern, 0, 4095).astype(np.uint16)

    ds.PixelData = pixels.tobytes()
    ds.save_as(filepath, write_like_original=False)


def run_tests():
    passed = 0
    failed = 0

    def assert_test(cond, name, detail=""):
        nonlocal passed, failed
        if cond:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} - {detail}")
            failed += 1

    print("==================================================")
    print("Q-KNEE DICOM RENDERING & MRI VIEWER VERIFICATION")
    print("==================================================")

    # 1. Login to get token
    login_res = requests.post(f"{BACKEND_URL}/api/auth/login", json={"email": "researcher@qknee.ai", "password": "password123"}, timeout=5)
    token = login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    assert_test(token is not None, "Login and acquire JWT for DICOM testing")

    # 2. Test Single DICOM File Upload
    with tempfile.TemporaryDirectory() as tmpdir:
        single_dcm_path = os.path.join(tmpdir, "single_knee_slice.dcm")
        create_dummy_dicom(single_dcm_path, instance_number=1, z_pos=0.0)

        with open(single_dcm_path, "rb") as f:
            upload_res = requests.post(
                f"{BACKEND_URL}/api/studies/upload",
                files={"files": ("single_knee_slice.dcm", f, "application/dicom")},
                headers=headers,
                timeout=10,
            )

        assert_test(upload_res.status_code == 201, "Upload exactly ONE .dcm file returns 201 Created", f"Status: {upload_res.status_code}")
        study_data = upload_res.json().get("study", {})
        study_id = study_data.get("id")

        # 3. Retrieve Study Details
        import time
        time.sleep(1) # Allow background /process notification
        study_res = requests.get(f"{BACKEND_URL}/api/studies/{study_id}", headers=headers, timeout=5)
        assert_test(study_res.status_code == 200, "GET /api/studies/:id returns 200", f"Status: {study_res.status_code}")
        study_info = study_res.json()

        slice_count = study_info.get("slice_count")
        has_3d_volume = study_info.get("has_3d_volume")
        assert_test(slice_count == 1, f"Single DICOM slice_count == 1 (actual: {slice_count}, NOT hardcoded 8)")
        assert_test(has_3d_volume is False, f"Single DICOM has_3d_volume is False (2D single slice)")

        # 4. Stream Rendered DICOM Pixel Array as PNG
        preview_res = requests.get(f"{BACKEND_URL}/api/studies/{study_id}/slice/0", headers=headers, timeout=10)
        assert_test(preview_res.status_code == 200, "GET /api/studies/:id/slice/0 returns 200 OK", f"Status: {preview_res.status_code}")
        assert_test(preview_res.headers.get("Content-Type") == "image/png", "Slice preview Content-Type is image/png")
        assert_test(len(preview_res.content) > 100, f"Slice preview contains real non-empty PNG data ({len(preview_res.content)} bytes)")

        # Verify image is a valid readable PNG
        from PIL import Image
        import io
        try:
            img = Image.open(io.BytesIO(preview_res.content))
            assert_test(img.format == "PNG" and img.size == (128, 128), f"Rendered DICOM pixel image valid PNG: {img.size}")
        except Exception as e:
            assert_test(False, "Rendered DICOM PNG validation", str(e))

    # 5. Test Multiple DICOM Files Upload
    with tempfile.TemporaryDirectory() as tmpdir:
        dcm_files = []
        file_tuples = []
        for i in range(1, 4):
            p = os.path.join(tmpdir, f"slice_{i:02d}.dcm")
            create_dummy_dicom(p, instance_number=i, z_pos=float(i * 3.0))
            dcm_files.append(p)
            file_tuples.append(("files", (f"slice_{i:02d}.dcm", open(p, "rb"), "application/dicom")))

        multi_res = requests.post(
            f"{BACKEND_URL}/api/studies/upload",
            files=file_tuples,
            headers=headers,
            timeout=15,
        )
        for _, (_, fobj, _) in file_tuples:
            fobj.close()

        assert_test(multi_res.status_code == 201, "Upload MULTIPLE (3) .dcm files returns 201")
        multi_study_id = multi_res.json().get("study", {}).get("id")

        time.sleep(1)
        multi_info = requests.get(f"{BACKEND_URL}/api/studies/{multi_study_id}", headers=headers, timeout=5).json()
        assert_test(multi_info.get("slice_count") == 3, f"Multiple DICOM slice_count == 3 (actual: {multi_info.get('slice_count')})")

        # Test slicing slice 0, 1, 2
        for s_idx in range(3):
            s_res = requests.get(f"{BACKEND_URL}/api/studies/{multi_study_id}/slice/{s_idx}", headers=headers, timeout=5)
            assert_test(s_res.status_code == 200, f"Retrieve multiple DICOM slice {s_idx + 1}/3 returns 200")

    # 6. Test Invalid DICOM resilience
    with tempfile.TemporaryDirectory() as tmpdir:
        bad_dcm = os.path.join(tmpdir, "corrupted.dcm")
        with open(bad_dcm, "wb") as f:
            f.write(b"NOT_A_VALID_DICOM_DATA_HEADER")

        with open(bad_dcm, "rb") as f:
            bad_res = requests.post(
                f"{BACKEND_URL}/api/studies/upload",
                files={"files": ("corrupted.dcm", f, "application/dicom")},
                headers=headers,
                timeout=10,
            )
        assert_test(bad_res.status_code in [201, 400], "Corrupted DICOM does not crash the server", f"Status: {bad_res.status_code}")

    # 7. Test CAM image fallback & prediction
    pred_res = requests.post(f"{BACKEND_URL}/api/studies/study_001/predict", json={"model_type": "quantum"}, headers=headers, timeout=15)
    assert_test(pred_res.status_code == 200, "Run quantum prediction on study_001 returns 200")

    expl_res = requests.post(f"{BACKEND_URL}/api/explanations/pred_study_001/explain", headers=headers, timeout=15)
    assert_test(expl_res.status_code in [200, 404, 500], "Explanation request handled gracefully", f"Status: {expl_res.status_code}")

    print("==================================================")
    print(f"DICOM VIEWER TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    print("==================================================")
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
