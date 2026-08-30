"""
FastAPI application for Q-Knee ML Microservice.
Endpoints for Prediction, Grad-CAM Visual Explainability,
4D PCA Feature Attribution, and Benchmarking.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np

from app.config import config
from app.services.dicom_service import load_study_slices, load_npy_volume, load_image_from_path
from app.services.demo_service import generate_demo_features, generate_demo_image
from app.pipeline.feature_extractor import extract_features_from_image, extract_study_features
import app.pipeline.pca_handler as pca_handler
import app.pipeline.classical_model as classical_model
import app.pipeline.quantum_model as quantum_model
from app.pipeline.gradcam import compute_gradcam_for_volume, compute_gradcam_on_slice
from app.pipeline.attribution import compute_feature_attribution
from app.services.benchmark_service import run_benchmark


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing Q-Knee ML Service...")
    pca_loaded = pca_handler.load_pca()
    svm_loaded = classical_model.load_classifier()
    vqc_loaded = quantum_model.load_vqc()

    if not pca_loaded:
        print("  Fitting PCA on DEMO data (4 components)...")
        X, _ = generate_demo_features(n_samples=40, seed=42)
        pca_handler.fit_pca(X, n_components=config.PCA_COMPONENTS)

    if not svm_loaded:
        print("  Fitting Classical SVM on DEMO data...")
        X, y = generate_demo_features(n_samples=40, seed=42)
        X_pca = pca_handler.transform(X)
        classical_model.fit_classifier(X_pca, y)

    if not vqc_loaded:
        print("  Training VQC on DEMO data (20 epochs)...")
        X, y = generate_demo_features(n_samples=40, seed=42)
        X_pca = pca_handler.transform(X)
        quantum_model.train_vqc(X_pca, y, epochs=20, lr=0.05)

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


class ProcessRequest(BaseModel):
    study_id: str
    file_paths: List[str]
    mode: str = "REAL"


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


@app.post("/process")
async def process_study(req: ProcessRequest):
    """Single source of truth for volume parsing, format validation, and preprocessing metadata."""
    try:
        slices = []
        if req.file_paths:
            try:
                slices = load_study_slices(req.file_paths)
            except Exception as e:
                return {
                    "study_id": req.study_id,
                    "status": "error",
                    "error": str(e),
                    "slice_count": 0,
                }

        slice_count = len(slices)
        img_size = [128, 128]
        if slice_count > 0:
            img_size = list(slices[0].size)

        return {
            "study_id": req.study_id,
            "status": "ready",
            "slice_count": slice_count,
            "image_size": img_size,
            "target_dimensions": [128, 128],
            "normalization": "Zero-mean ImageNet std scaling",
            "format": "DICOM/NPY" if req.file_paths and any(p.endswith((".dcm", ".npy")) for p in req.file_paths) else "Standard Image",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
async def predict(req: PredictRequest):
    try:
        # 1. Feature Extraction from MRI volume / slices
        slices = []
        if req.file_paths:
            try:
                slices = load_study_slices(req.file_paths)
            except Exception:
                slices = []

        if not slices:
            for path_str in req.file_paths:
                img = load_image_from_path(path_str)
                if img is not None:
                    slices.append(img)

        if slices:
            features_512d = extract_study_features(slices, max_slices=16, aggregation="mean")
        else:
            features_512d = generate_demo_features(n_samples=1, seed=abs(hash(req.study_id)) % 1000)[0][0]

        # 2. PCA Feature Reduction (512D -> 4D)
        pca_features = pca_handler.transform(features_512d.reshape(1, -1))[0]

        # 3. Model Inference
        if req.model_type == "quantum":
            result = quantum_model.predict(pca_features)
            model_name = "Hybrid Quantum VQC"
        else:
            result = classical_model.predict(pca_features)
            model_name = "Classical SVM"

        return {
            "study_id": req.study_id,
            "model_name": model_name,
            "predicted_class": result["predicted_class"],
            "abnormal_probability": result["abnormal_probability"],
            "normal_probability": result["normal_probability"],
            "confidence": result["confidence"],
            "pca_features": pca_features.tolist(),
            "mode": "SIMULATION" if req.model_type == "quantum" else req.mode,
            "raw_output": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explanations/gradcam")
async def get_gradcam(req: GradcamRequest):
    """Compute visual Grad-CAM explanations for specified slice or volume."""
    try:
        gradcam_dir = Path(config.UPLOAD_DIR) / "explanations" / req.prediction_id
        if req.file_paths:
            res = compute_gradcam_for_volume(
                req.file_paths,
                output_dir=gradcam_dir,
                slice_idx=req.slice_idx,
                label_idx=req.label_idx,
            )
        else:
            img = generate_demo_image(128, seed=0)
            res = compute_gradcam_on_slice(img, output_dir=gradcam_dir, label_idx=req.label_idx)
            res["selected_slice_index"] = 0
            res["total_volume_slices"] = 1

        return {
            "prediction_id": req.prediction_id,
            "study_id": req.study_id,
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
                feat_512 = generate_demo_features(n_samples=1, seed=0)[0][0]
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
async def explain(req: ExplainRequest):
    """Unified explanation endpoint: returns Grad-CAM + 4D Feature Attribution with graceful degradation."""
    gradcam_data = None
    attribution_data = None
    error_notes = []

    gradcam_dir = Path(config.UPLOAD_DIR) / "explanations" / req.prediction_id

    # 1. Attempt Grad-CAM
    try:
        if req.file_paths:
            gradcam_data = compute_gradcam_for_volume(
                req.file_paths,
                output_dir=gradcam_dir,
                slice_idx=req.slice_idx,
                label_idx=1,
            )
        else:
            img = generate_demo_image(128, seed=0)
            gradcam_data = compute_gradcam_on_slice(img, output_dir=gradcam_dir, label_idx=1)
    except Exception as e:
        error_notes.append(f"Grad-CAM unavailable: {str(e)}")
        # Fallback dummy image if needed
        try:
            demo_img = generate_demo_image(128, seed=0)
            gradcam_data = compute_gradcam_on_slice(demo_img, output_dir=gradcam_dir, label_idx=1)
        except Exception:
            gradcam_data = None

    # 2. Attempt Feature Attribution
    try:
        if req.file_paths:
            slices = []
            for path_str in req.file_paths:
                img = load_image_from_path(path_str)
                if img is not None:
                    slices.append(img)
            if slices:
                feat_512 = extract_study_features(slices)
            else:
                feat_512 = generate_demo_features(n_samples=1, seed=0)[0][0]
            pca_features = pca_handler.transform(feat_512.reshape(1, -1))[0]
        else:
            pca_features = np.zeros(4, dtype=np.float32)

        if req.model_type == "quantum" and quantum_model.is_trained():
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