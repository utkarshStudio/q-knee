"""
FastAPI application for Q-Knee ML Microservice.
Endpoints for Prediction, Grad-CAM Visual Explainability,
4D PCA Feature Attribution, and Benchmarking.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import hashlib
from PIL import Image

from app.config import config
from app.services.dicom_service import (
    load_study_slices,
    load_npy_volume,
    load_image_from_path,
    read_dicom_slice,
    load_npy_volume_from_array,
)
from app.pipeline.feature_extractor import extract_features_from_image, extract_study_features
import app.pipeline.pca_handler as pca_handler
import app.pipeline.classical_model as classical_model
import app.pipeline.quantum_model as quantum_model
from app.pipeline.gradcam import compute_gradcam_for_volume, compute_gradcam_on_slice, compute_gradcam_for_slices
from app.pipeline.attribution import compute_feature_attribution
from app.services.benchmark_service import run_benchmark


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing Q-Knee ML Service...")
    pca_loaded = pca_handler.load_pca()
    svm_loaded = classical_model.load_classifier()
    vqc_loaded = quantum_model.load_vqc()

    if not pca_loaded or not svm_loaded or not vqc_loaded:
        print("CRITICAL: One or more ML models (PCA, SVM, VQC) could not be loaded from disk.")
        print("You must train the models using a real dataset before running the ML service.")
        # We don't exit(1) immediately to allow the service to be healthy enough to run /train or benchmark endpoints if we build one, but we shouldn't serve demo predictions.
        # Alternatively, we could raise an exception here. Let's just warn loudly.
        
    print("Q-Knee ML Service initialized and ready.")
    yield
    print("Q-Knee ML Service shutdown.")


app = FastAPI(title="Q-Knee ML Service", version="1.0.0", lifespan=lifespan)


@app.get("/")
def root():
    return {
        "service": "Q-Knee Hybrid Quantum ML Service",
        "version": "1.0.0",
        "status": "online",
        "interactive_docs": "http://localhost:8000/docs",
        "health_check": "http://localhost:8000/health",
        "model_health": "http://localhost:8000/health/models",
        "frontend_ui": "http://localhost:5173"
    }


class PredictRequest(BaseModel):
    study_id: str
    file_paths: List[str]
    model_type: str = "quantum"
    mode: str = "DEMO"


class BenchmarkRequest(BaseModel):
    mode: str = "REAL"


class ExplainRequest(BaseModel):
    prediction_id: str
    study_id: str
    file_paths: List[str]
    model_type: str = "quantum"
    slice_idx: Optional[int] = None


class GradcamRequest(BaseModel):
    prediction_id: str
    study_id: str
    file_paths: List[str]
    slice_idx: Optional[int] = None
    label_idx: int = 1


import io
import base64
import io
from fastapi.responses import Response

class SlicePreviewRequest(BaseModel):
    study_id: Optional[str] = None
    file_paths: List[str] = []
    slice_idx: int = 0


class BufferPreviewRequest(BaseModel):
    study_id: Optional[str] = None
    file_b64: Optional[str] = None
    files_b64: Optional[List[str]] = None
    slice_idx: int = 0


class ProcessRequest(BaseModel):
    study_id: str
    file_paths: List[str] = []
    mode: str = "REAL"
    files_b64: Optional[List[str]] = None


class FeatureAttributionRequest(BaseModel):
    file_paths: Optional[List[str]] = None
    pca_features: Optional[List[float]] = None
    model_type: str = "quantum"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "qknee-ml",
        "mode": config.current_mode,
        "quantum_backend": "default.qubit (SIMULATION)",
        "qubits": config.QUANTUM_QUBITS,
        "quantum_depth": config.QUANTUM_DEPTH,
        "pca_fitted": pca_handler.is_fitted(),
        "classical_model_ready": classical_model.is_fitted(),
        "quantum_model_ready": quantum_model.is_trained(),
    }


@app.get("/health/models")
def model_health():
    return {
        "status": "ok",
        "feature_extractor": {
            "model": "ResNet18",
            "weights": "ImageNet1K_V1",
            "feature_dim": 512,
            "target_layer": "ResNet18.layer4[1].conv2",
        },
        "pca": {
            "fitted": pca_handler.is_fitted(),
            "n_components": config.PCA_COMPONENTS,
            "metrics": pca_handler.get_pca_metrics(),
        },
        "classical_svm": {
            "fitted": classical_model.is_fitted(),
            "model_type": "SupportVectorMachine",
            "kernel": "rbf",
            "probability_calibration": True,
        },
        "quantum_vqc": {
            "trained": quantum_model.is_trained(),
            "qubits": config.QUANTUM_QUBITS,
            "depth": config.QUANTUM_DEPTH,
            "encoding": "Angle (RY)",
            "entanglement": "Circular CNOT",
            "measurement": "Pauli-Z Expectation",
            "backend": "PennyLane default.qubit (SIMULATION)",
        },
    }


@app.post("/preview/buffer")
async def preview_buffer(req: BufferPreviewRequest):
    """Render and return a specific slice directly from base64-encoded DICOM/NPY buffer."""
    try:
        raw_items = []
        if req.files_b64:
            raw_items = req.files_b64
        elif req.file_b64:
            raw_items = [req.file_b64]

        if not raw_items:
            raise HTTPException(status_code=400, detail="No file data provided in request")

        slices = []
        for item in raw_items:
            # Strip data URI prefix if present
            if "," in item:
                item = item.split(",", 1)[1]
            data_bytes = base64.b64decode(item)

            # Try DICOM decode
            img, _ = read_dicom_slice(data_bytes)
            if img is not None:
                slices.append(img)
                continue

            # Try NPY decode
            try:
                buf = io.BytesIO(data_bytes)
                arr = np.load(buf)
                npy_slices = load_npy_volume_from_array(arr)
                if npy_slices:
                    slices.extend(npy_slices)
                    continue
            except Exception:
                pass

            # Try standard PIL image decode
            try:
                img = Image.open(io.BytesIO(data_bytes)).convert("RGB")
                slices.append(img)
            except Exception:
                pass

        if not slices:
            raise HTTPException(status_code=422, detail="Unable to process uploaded MRI volume")

        idx = max(0, min(len(slices) - 1, req.slice_idx))
        target_img = slices[idx]

        out_buf = io.BytesIO()
        target_img.save(out_buf, format="PNG")
        out_buf.seek(0)
        return Response(content=out_buf.getvalue(), media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Buffer preview failed: {str(e)}")


@app.post("/preview/slice")
async def preview_slice(request: Request):
    """
    Render and return a specific slice from uploaded DICOM/NPY files as PNG.
    Accepts:
    1. multipart/form-data:
       - file: UploadFile (actual .dcm file bytes)
       - slice_idx: int (default 0)
       - study_id: Optional[str]
    2. application/json:
       - file_b64: Optional[str]
       - file_paths: Optional[List[str]]
       - slice_idx: int
       - study_id: Optional[str]
    3. application/octet-stream / application/dicom:
       - raw DICOM binary stream in body
    """
    try:
        content_type = request.headers.get("content-type", "").lower()
        slices = []
        slice_idx = 0
        study_id = None
        plane = "axial"

        # 1. Handle multipart/form-data (actual file upload bytes)
        if "multipart/form-data" in content_type:
            form = await request.form()
            slice_idx = int(form.get("slice_idx", 0))
            study_id = form.get("study_id")
            plane = form.get("plane", "axial")

            for key in ["file", "files"]:
                field_val = form.get(key)
                if field_val is not None:
                    if hasattr(field_val, "read"):
                        raw_data = await field_val.read()
                        if raw_data:
                            img, _ = read_dicom_slice(raw_data)
                            if img is not None:
                                slices.append(img)
                            else:
                                try:
                                    arr = np.load(io.BytesIO(raw_data))
                                    npy_slices = load_npy_volume_from_array(arr, plane=plane)
                                    if npy_slices: slices.extend(npy_slices)
                                except Exception:
                                    try:
                                        img = Image.open(io.BytesIO(raw_data)).convert("RGB")
                                        slices.append(img)
                                    except Exception:
                                        pass
                    elif isinstance(field_val, bytes):
                        img, _ = read_dicom_slice(field_val)
                        if img is not None:
                            slices.append(img)

        # 2. Handle raw DICOM binary stream in body
        elif "application/octet-stream" in content_type or "application/dicom" in content_type:
            raw_data = await request.body()
            if raw_data:
                img, _ = read_dicom_slice(raw_data)
                if img is not None:
                    slices.append(img)

        # 3. Handle JSON payload
        else:
            try:
                body = await request.json()
            except Exception:
                body = {}

            slice_idx = int(body.get("slice_idx", 0))
            study_id = body.get("study_id")
            plane = body.get("plane", "axial")

            # Check for base64 encoded file
            if "file_b64" in body and body["file_b64"]:
                raw_b64 = body["file_b64"]
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                data_bytes = base64.b64decode(raw_b64)
                img, _ = read_dicom_slice(data_bytes)
                if img is not None:
                    slices.append(img)

            # Check for file paths (if local on ML container)
            file_paths = body.get("file_paths", [])
            if not slices and file_paths:
                try:
                    # TODO: load_study_slices needs to support plane if it loads NPY
                    # Wait, load_study_slices is for a directory of DICOMs, which we don't transpose easily here.
                    # We will just pass plane to load_npy_volume via load_image_from_path if it's a single file.
                    if len(file_paths) == 1 and str(file_paths[0]).endswith((".npy", ".npz")):
                        slices = load_npy_volume(file_paths[0], plane=plane)
                    else:
                        slices = load_study_slices(file_paths)
                except Exception:
                    slices = []
                if not slices:
                    for p_str in file_paths:
                        img = load_image_from_path(p_str)
                        if img is not None:
                            slices.append(img)

        # 4. Fail if no slices could be read directly
        if not slices:
            raise HTTPException(status_code=422, detail="Unable to process uploaded MRI volume")

        total = len(slices)
        idx = max(0, min(total - 1, slice_idx))
        target_img = slices[idx]

        buf = io.BytesIO()
        target_img.save(buf, format="PNG")
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render slice preview: {str(e)}")


@app.get("/preview/sample/{study_id}/{slice_idx}")
def get_sample_slice(study_id: str, slice_idx: int = 0):
    """Retrieve slice from sample dataset volumes or generate high-contrast realistic MRI slice."""
    project_root = Path(__file__).parent.parent.parent.resolve()
    sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / study_id / "volume.npy"
    if not sample_path.exists():
        sample_path = project_root / "data" / "sample_mri_dataset" / "train_series" / "study_001" / "volume.npy"

    slices = []
    if sample_path.exists():
        slices = load_npy_volume(sample_path)

    if not slices:
        raise HTTPException(status_code=404, detail="Sample slice not found")

    idx = max(0, min(len(slices) - 1, slice_idx))
    buf = io.BytesIO()
    slices[idx].save(buf, format="PNG")
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="image/png")


async def extract_slices_and_fields(request: Request):
    content_type = request.headers.get("content-type", "").lower()
    slices = []
    fields = {}
    if "multipart/form-data" in content_type:
        form = await request.form()
        fields["study_id"] = form.get("study_id")
        fields["mode"] = form.get("mode")
        fields["model_type"] = form.get("model_type")
        for key in ["file", "files"]:
            for field_val in form.getlist(key):
                if hasattr(field_val, "read"):
                    raw_data = await field_val.read()
                    if raw_data:
                        file_hash = hashlib.sha256(raw_data).hexdigest()
                        print(f"ML RECEIVED HASH (multipart file): {file_hash}")
                        img, _ = read_dicom_slice(raw_data)
                        if img: slices.append(img)
                        else:
                            try:
                                arr = np.load(io.BytesIO(raw_data))
                                npy_slices = load_npy_volume_from_array(arr)
                                if npy_slices: slices.extend(npy_slices)
                            except Exception:
                                try:
                                    slices.append(Image.open(io.BytesIO(raw_data)).convert("RGB"))
                                except Exception: pass
    else:
        try:
            body = await request.json()
            fields = body
            file_paths = body.get("file_paths", [])
            if file_paths:
                try: slices = load_study_slices(file_paths)
                except Exception: slices = []
                if not slices:
                    for p in file_paths:
                        img = load_image_from_path(p)
                        if img: slices.append(img)
        except Exception:
            pass
    return fields, slices


@app.post("/process")
async def process_study(request: Request):
    """Single source of truth for volume parsing, format validation, and preprocessing metadata."""
    try:
        fields, slices = await extract_slices_and_fields(request)
        study_id = fields.get("study_id")
        
        if not slices and not fields.get("file_paths"):
            return {
                "study_id": study_id,
                "status": "error",
                "error": "No file data received",
                "slice_count": 0,
                "has_3d_volume": False,
            }

        slice_count = len(slices)
        img_size = [128, 128]
        if slice_count > 0:
            img_size = list(slices[0].size)

        return {
            "study_id": study_id,
            "status": "ready",
            "slice_count": slice_count,
            "has_3d_volume": slice_count > 3,
            "image_size": img_size,
            "target_dimensions": [128, 128],
            "normalization": "Zero-mean ImageNet std scaling",
            "format": "DICOM/NPY/Multipart",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
async def predict(request: Request):
    try:
        fields, slices = await extract_slices_and_fields(request)
        study_id = fields.get("study_id")
        model_type = fields.get("model_type", "quantum")
        mode = fields.get("mode", "DEMO")

        if slices:
            features_512d = extract_study_features(slices, max_slices=16, aggregation="mean")
        else:
            raise HTTPException(status_code=422, detail="Unable to process uploaded MRI volume for prediction")

        # 2. PCA Feature Reduction (512D -> 4D)
        pca_features = pca_handler.transform(features_512d.reshape(1, -1))[0]

        # 3. Model Inference
        if model_type == "quantum":
            result = quantum_model.predict(pca_features)
            model_name = "Hybrid Quantum VQC"
        else:
            result = classical_model.predict(pca_features)
            model_name = "Classical SVM"

        return {
            "study_id": study_id,
            "model_name": model_name,
            "predicted_class": result["predicted_class"],
            "abnormal_probability": result["abnormal_probability"],
            "normal_probability": result["normal_probability"],
            "confidence": result["confidence"],
            "pca_features": pca_features.tolist(),
            "mode": "SIMULATION" if model_type == "quantum" else mode,
            "raw_output": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explanations/gradcam")
async def get_gradcam(request: Request):
    """Compute visual Grad-CAM explanations for specified slice or volume."""
    try:
        fields, slices = await extract_slices_and_fields(request)
        prediction_id = fields.get("prediction_id", "unknown_pred")
        study_id = fields.get("study_id", "unknown_study")
        slice_idx = int(fields.get("slice_idx", 0)) if fields.get("slice_idx") is not None else None
        label_idx = int(fields.get("label_idx", 1))

        gradcam_dir = Path(config.UPLOAD_DIR) / "explanations" / prediction_id
        if slices:
            res = compute_gradcam_for_slices(
                slices,
                output_dir=gradcam_dir,
                slice_idx=slice_idx,
                label_idx=label_idx,
            )
        elif fields.get("file_paths"):
            res = compute_gradcam_for_volume(
                fields.get("file_paths"),
                output_dir=gradcam_dir,
                slice_idx=slice_idx,
                label_idx=label_idx,
            )
        else:
            raise HTTPException(status_code=400, detail="files or file_paths required for gradcam")

        return {
            "prediction_id": prediction_id,
            "study_id": study_id,
            **res,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grad-CAM error: {str(e)}")


@app.post("/explanations/features")
async def get_feature_attribution(req: FeatureAttributionRequest):
    """Compute signed feature attributions for 4 PCA components."""
    try:
        # Determine 4D features
        if req.pca_features is not None:
            pca_features = np.asarray(req.pca_features, dtype=np.float32)[:4]
        elif req.file_paths:
            slices = []
            for path_str in req.file_paths:
                img = load_image_from_path(path_str)
                if img is not None:
                    slices.append(img)
            if slices:
                feat_512 = extract_study_features(slices)
            else:
                raise ValueError("Unable to extract features from provided paths")
            pca_features = pca_handler.transform(feat_512.reshape(1, -1))[0]
        else:
            pca_features = np.zeros(4, dtype=np.float32)

        # Select prediction probability function
        if req.model_type == "quantum" and quantum_model.is_trained():
            def pred_fn(x):
                return quantum_model.predict(x)["abnormal_probability"]
        else:
            def pred_fn(x):
                return classical_model.predict(x)["abnormal_probability"]

        attribution_res = compute_feature_attribution(pca_features, pred_fn)
        return attribution_res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature attribution error: {str(e)}")


@app.post("/explain")
async def explain(request: Request):
    """Unified explanation endpoint: returns Grad-CAM + 4D Feature Attribution with graceful degradation."""
    gradcam_data = None
    attribution_data = None
    error_notes = []

    fields, slices = await extract_slices_and_fields(request)
    prediction_id = fields.get("prediction_id", "unknown_pred")
    study_id = fields.get("study_id", "unknown_study")
    model_type = fields.get("model_type", "quantum")
    slice_idx = int(fields.get("slice_idx", 0)) if fields.get("slice_idx") is not None else None
    
    gradcam_dir = Path(config.UPLOAD_DIR) / "explanations" / prediction_id

    # 1. Attempt Grad-CAM
    try:
        if slices:
            gradcam_data = compute_gradcam_for_slices(
                slices,
                output_dir=gradcam_dir,
                slice_idx=slice_idx,
                label_idx=1,
            )
        elif fields.get("file_paths"):
            gradcam_data = compute_gradcam_for_volume(
                fields.get("file_paths"),
                output_dir=gradcam_dir,
                slice_idx=slice_idx,
                label_idx=1,
            )
        else:
            raise HTTPException(status_code=400, detail="files or file_paths required for explanation")
    except Exception as e:
        error_notes.append(f"Grad-CAM unavailable: {str(e)}")
        gradcam_data = None

    # 2. Attempt Feature Attribution
    try:
        if slices:
            feat_512 = extract_study_features(slices)
            pca_features = pca_handler.transform(feat_512.reshape(1, -1))[0]
        elif fields.get("file_paths"):
            file_paths = fields.get("file_paths")
            temp_slices = []
            for path_str in file_paths:
                img = load_image_from_path(path_str)
                if img is not None:
                    temp_slices.append(img)
            if temp_slices:
                feat_512 = extract_study_features(temp_slices)
            else:
                raise ValueError("Unable to extract features from provided paths")
            pca_features = pca_handler.transform(feat_512.reshape(1, -1))[0]
        else:
            pca_features = np.zeros(4, dtype=np.float32)

        if model_type == "quantum" and quantum_model.is_trained():
            def pred_fn(x):
                return quantum_model.predict(x)["abnormal_probability"]
        else:
            def pred_fn(x):
                return classical_model.predict(x)["abnormal_probability"]

        attribution_data = compute_feature_attribution(pca_features, pred_fn)
    except Exception as e:
        error_notes.append(f"Feature attribution error: {str(e)}")

    # Format Grad-CAM file paths for database compatibility
    gradcam_paths = {}
    if gradcam_data and "original" in gradcam_data:
        gradcam_paths = {
            "original": gradcam_data.get("original"),
            "heatmap": gradcam_data.get("heatmap"),
            "overlay": gradcam_data.get("overlay"),
            "selected_slice_index": gradcam_data.get("selected_slice_index", 0),
            "total_volume_slices": gradcam_data.get("total_volume_slices", 1),
        }

    return {
        "prediction_id": req.prediction_id,
        "study_id": req.study_id,
        "gradcam": gradcam_paths,
        "gradcam_details": gradcam_data,
        "attribution": attribution_data.get("sorted_by_importance", []) if attribution_data else [],
        "attribution_details": attribution_data,
        "errors": error_notes,
        "scientific_disclaimer": "Visualizations and feature attributions are research interpretability aids and do not establish a medical or radiological diagnosis.",
    }


@app.get("/explanations/{prediction_id}/image/{image_type}")
def get_explanation_image(prediction_id: str, image_type: str):
    allowed = {"original", "heatmap", "overlay"}
    if image_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid image type")
    img_path = Path(config.UPLOAD_DIR) / "explanations" / prediction_id / f"{image_type}.png"
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(img_path), media_type="image/png")


@app.post("/benchmark")
async def benchmark(req: BenchmarkRequest):
    try:
        result = run_benchmark(mode=req.mode)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))