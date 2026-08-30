# Q-Knee REST API Reference

The Q-Knee platform provides REST APIs spanning both the Node.js Express Backend (`:3001`) and the Python ML Microservice (`:8000`).

---

## 1. Python ML Microservice Endpoints (`http://localhost:8000`)

### `GET /health`
Returns service status, quantum simulation backend, and component readiness.
```json
{
  "status": "ok",
  "service": "qknee-ml",
  "mode": "REAL",
  "quantum_backend": "default.qubit (SIMULATION)",
  "qubits": 4,
  "quantum_depth": 2,
  "pca_fitted": true,
  "classical_model_ready": true,
  "quantum_model_ready": true
}
```

### `GET /health/models`
Returns detailed telemetry for ResNet18, PCA, Classical SVM, and 4-Qubit VQC.

---

### `POST /process`
Single source of truth for volume ingestion, slice counting, format validation, and metadata extraction.
**Request Body**:
```json
{
  "study_id": "study_001",
  "file_paths": ["/path/to/volume.npy"],
  "mode": "REAL"
}
```
**Response**:
```json
{
  "study_id": "study_001",
  "status": "ready",
  "slice_count": 8,
  "image_size": [128, 128],
  "target_dimensions": [128, 128],
  "normalization": "Zero-mean ImageNet std scaling",
  "format": "DICOM/NPY"
}
```

---

### `POST /predict`
Executes ResNet18 512D feature extraction $\to$ PCA 4D compression $\to$ 4-Qubit VQC or Classical SVM inference.
**Request Body**:
```json
{
  "study_id": "study_001",
  "file_paths": ["/path/to/volume.npy"],
  "model_type": "quantum",
  "mode": "REAL"
}
```
**Response**:
```json
{
  "study_id": "study_001",
  "model_name": "Hybrid Quantum VQC",
  "predicted_class": "abnormal",
  "abnormal_probability": 0.884,
  "normal_probability": 0.116,
  "confidence": 0.884,
  "pca_features": [0.35, -0.42, 0.18, -0.71],
  "mode": "SIMULATION"
}
```

---

### `POST /explanations/gradcam`
Computes Grad-CAM for a specified slice or volume.
**Request Body**:
```json
{
  "prediction_id": "pred_001",
  "study_id": "study_001",
  "file_paths": ["/path/to/volume.npy"],
  "slice_idx": 4,
  "label_idx": 1
}
```
**Response**: Returns `original_b64`, `heatmap_b64`, `overlay_b64` (data URIs) and activation statistics.

---

### `POST /explanations/features`
Computes signed Taylor gradient sensitivities for the 4 PCA features.
**Request Body**:
```json
{
  "pca_features": [0.35, -0.42, 0.18, -0.71],
  "model_type": "quantum"
}
```
**Response**:
```json
{
  "attribution_method": "Taylor Gradient Sensitivity (Linear Attribution)",
  "dominant_feature": "feature_2",
  "features": [
    {
      "feature_name": "feature_1",
      "feature_label": "PC1",
      "input_value": 0.35,
      "attribution_score": 0.054,
      "direction": "positive_abnormal",
      "relative_importance_pct": 18.2
    }
  ]
}
```

---

### `POST /explain`
Unified endpoint returning both Grad-CAM and Feature Attribution with graceful degradation.

---

### `POST /benchmark`
Runs evaluation of Classical SVM vs Hybrid Quantum VQC on untouched test split and generates vector SVGs.

---

## 2. Express Backend Endpoints (`http://localhost:3001`)

- `POST /api/auth/signup` & `POST /api/auth/login`: User management with JWT auth.
- `GET /api/studies`: List paginated studies for user.
- `POST /api/studies/upload`: Ingest MRI series (Multer disk storage + `/process` delegation).
- `GET /api/studies/:id`: Study metadata.
- `POST /api/studies/:id/predict`: Trigger prediction run.
- `GET /api/explanations/:predictionId/explain`: Retrieve cached or newly computed explanation.
- `GET /api/explanations/:explanationId/image/:type`: Serve explanation PNG files (`original`, `heatmap`, `overlay`).
- `GET /api/benchmarks` & `POST /api/benchmarks/run`: Retrieve and run benchmarks.
