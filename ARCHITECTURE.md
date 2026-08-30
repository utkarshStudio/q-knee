# Q-Knee System Architecture & Technical Specification

## Overview

**Q-Knee** is a hybrid classical-quantum medical AI demonstration platform designed for automated anterior cruciate ligament (ACL) knee abnormality screening from MRI volumes. It integrates transfer learning with dimensionality reduction, variational quantum circuits (VQC), and visual/numerical explainability (XAI).

---

## End-to-End Pipeline Architecture

```
                                  [ MRI Input Data ]
                             (DICOM Series / 3D NumPy Volumes)
                                          │
                                          ▼
                         [ Preprocessing & Slicing ]
                 (Physical slice ordering, 128x128 resize, ImageNet norm)
                                          │
                                          ▼
                       [ Feature Extractor: ResNet18 ]
                    (layer4 convolutional feature map: 512D)
                                          │
                                          ▼
                      [ Latent Compression: Exact SVD PCA ]
                (Fitted strictly on train split -> 4 features in [-1.0, 1.0])
                                          │
                                          ▼
                     [ Hybrid Quantum Classifier: 4-Qubit VQC ]
                (Angle encoding RY(πx) + Rotations + Circular CNOT + ⟨Z₀⟩)
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
          [ Decision & Risk Output ]                 [ Explainability Engine (XAI) ]
     (p(Abnormal), p(Normal), Confidence)       (Grad-CAM layer4[1].conv2 + 4D Attribution)
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                         [ Node.js / Express Backend ]
                           (PostgreSQL Data Store)
                                          │
                                          ▼
                      [ React 19 Clinical Research Interface ]
               (Interactive MriViewer, Risk Bars, CAM Overlays & Benchmarks)
```

---

## Component Breakdown

### 1. Classical Components (Classical Computing)
- **Ingestion & DICOM Windowing**: `ml-service/app/services/dicom_service.py`
  - Safely reads DICOM metadata (`ImagePositionPatient`, `SliceLocation`, `RescaleSlope`, `RescaleIntercept`, `WindowCenter`, `WindowWidth`).
  - Normalizes intensity values into $[0, 255]$ with Hounsfield / MRI contrast enhancement.
- **Deep Feature Extractor**: `ml-service/app/pipeline/feature_extractor.py`
  - ResNet18 convolutional backbone pretrained on ImageNet.
  - Generates 512-dimensional study feature embeddings via representative slice pooling.
- **Dimensionality Reduction**: `ml-service/app/pipeline/pca_handler.py`
  - Exact SVD Principal Component Analysis fitted strictly on training data with zero validation/test leakage.
  - Deterministically scales 4 principal components to $[-1.0, 1.0]$.
- **Classical Baseline**: `ml-service/app/pipeline/classical_model.py`
  - Support Vector Machine (SVM) with RBF kernel and Platt probability calibration for empirical benchmarking.

### 2. Quantum Machine Learning Components (Simulation)
- **Quantum Backend**: **PennyLane `default.qubit` Simulator**
  - Configurable 4-qubit statevector simulator.
  - Note: Execution is strictly simulator-based for reproducible algorithmic research. No physical quantum hardware execution or unverified quantum supremacy is claimed.
- **Quantum Circuit Architecture**: `ml-service/app/pipeline/quantum_model.py`
  - **Feature Encoding**: Angle encoding mapping $x_i \in [-1.0, 1.0] \to RY(\pi \cdot x_i)$.
  - **Parameterized Ansatz**: 2-layer variational ansatz consisting of arbitrary single-qubit rotations ($RZ(\theta_1) \cdot RY(\theta_2) \cdot RZ(\theta_3)$).
  - **Entanglement**: Circular CNOT ladder between adjacent qubits.
  - **Measurement**: Pauli-Z expectation value on wire 0: $\langle Z_0 \rangle \in [-1.0, 1.0]$.
  - **Classification Mapping**: $P(\text{abnormal}) = \frac{\langle Z_0 \rangle + 1}{2}$.
  - **Optimization**: Analytical Parameter-Shift Rule gradients ($f'(x) = \frac{f(x + s) - f(x - s)}{2\sin(s)}$).

### 3. Explainability Engine (XAI)
- **Visual Attention (Grad-CAM)**: `ml-service/app/pipeline/gradcam.py`
  - Hooks forward activations and backward gradients at `ResNet18.layer4[1].conv2`.
  - Performs gradient-weighted pooling to generate high-resolution class activation maps.
  - Renders Original MRI, pure NumPy Jet Heatmap, and 50% Blended Overlay.
- **Numerical Feature Attribution**: `ml-service/app/pipeline/attribution.py`
  - Evaluates Taylor-expansion partial derivatives $\frac{\partial P}{\partial x_i} \cdot (x_i - \bar{x}_i)$ around baseline $\bar{x} = 0$.
  - Decomposes output score into signed contributions for `feature_1`, `feature_2`, `feature_3`, `feature_4`.

### 4. Backend Tier
- **Express & PostgreSQL**: `backend/src/`
  - User authentication (JWT, bcrypt).
  - Study and prediction persistence.
  - Single-responsibility proxy delegating all ML operations to the Python ML service.
  - Security hardening: Helmet, rate limiting, path traversal mitigation, and sanitized error responses.

### 5. Frontend Interface
- **React 19, Vite, TailwindCSS**: `frontend/src/`
  - Interactive `MriViewer` with slice navigation slider and keyboard shortcuts.
  - Anatomical plane switching (Sagittal default, Axial/Coronal enabled for 3D volumes).
  - Side-by-side and focus views for Grad-CAM overlays.
  - Head-to-head benchmarking metrics table and vector SVG ROC/confusion matrix charts.
  - Prominent scientific research disclaimer banners across all views.
