# Q-Knee Architecture

Q-Knee implements a modern decoupled microservices architecture with a dedicated Hybrid Quantum Machine Learning (HQML) processing layer.

## System Architecture

```
[React Frontend]
       │ (HTTPS/REST)
       ▼
[Node.js Backend] ◄───► [PostgreSQL Database]
       │ (HTTP/Multipart)
       ▼
[Python ML Service]
```

### 1. Storage & Transport Architecture
To support scalable cloud deployment (e.g., separate serverless instances for Node and Python), Q-Knee does **not** rely on shared Docker volumes.
- When a user uploads a DICOM/NPY study, the Node.js backend streams the actual file bytes via `multipart/form-data` to the ML Service for processing.
- The backend generates a SHA-256 cryptographic hash of the payload before sending, and the ML Service verifies the hash upon receipt to guarantee data integrity.

### 2. Hybrid Quantum ML Pipeline

The prediction and explanation pipeline inside the ML Service operates as follows:

```
[Input Volume (DICOM / NPY)] 
       │
       ▼
[Volume Normalization & Slicing (dicom_service.py)] 
       │ (Returns [D, H, W] tensor)
       ▼
[ResNet18 Feature Extractor] 
       │ (Extracts spatial embeddings from max 16 slices)
       ▼ (512D Latent Vector)
[PCA Dimensionality Reduction] 
       │ (Fitted to capture 95% variance)
       ▼ (4D Latent Vector)
[PennyLane Quantum Circuit (VQC)] 
       │ (Angle Encoding (RY) -> Circular CNOT Entanglement)
       ▼
[Measurement (Pauli-Z Expectation)]
       │
       ▼
[Binary Classification (Abnormal / Normal)]
```

### 3. Explainable AI (XAI) Architecture
Q-Knee provides two distinct levels of explainability:

1. **Spatial Explainability (ResNet18 Grad-CAM)**:
   - Computes gradients purely on the classical `model.layer4[-1].conv2` of the ResNet18 model.
   - Highlights the physical anatomical regions (e.g., meniscus, ACL) that triggered the spatial embeddings.
   - Highly visual, overlaid directly on the MRI slices in the UI.

2. **Quantum Feature Attribution**:
   - Calculates the sensitivity of the VQC output with respect to the 4 input PCA features.
   - Explains *how* the quantum circuit weighed the abstracted latent vectors.

### 4. Database Schema
- `users`: Standard auth credentials and role (`researcher`).
- `studies`: Tracks uploaded volumes, mode (`REAL`/`DEMO`), status, and dynamically extracted metadata (slice count, 3D shape).
- `predictions`: Links a study to its HQML result.
- `explanations`: Links a prediction to its Grad-CAM visual references and attribution arrays.
