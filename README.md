# Q-Knee: Hybrid Quantum-Classical Medical Diagnostic Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://python.org)
[![TypeScript: 5.6](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![PennyLane: 0.44](https://img.shields.io/badge/PennyLane-0.44-purple.svg)](https://pennylane.ai/)
[![PyTorch: 2.0+](https://img.shields.io/badge/PyTorch-2.0%2B-orange.svg)](https://pytorch.org/)

> **A Hybrid Quantum Machine Learning & Explainable AI (XAI) Platform for Knee Abnormality MRI Screening.**

---

## 1. Project Overview & Problem Statement

Musculoskeletal disorders and knee anterior cruciate ligament (ACL) tears represent one of the most prevalent orthopedic injuries worldwide. Magnetic Resonance Imaging (MRI) is the clinical standard for diagnosis; however, manual volumetric MRI interpretation is labor-intensive and subject to inter-observer variability.

### The Challenge
1. **High Dimensionality**: Multi-slice MRI scans contain hundreds of high-resolution slices with complex anatomical structures.
2. **Quantum Input Constraints**: Near-term quantum circuits (NISQ-era) are restricted to small qubit registers ($4\text{–}8$ qubits).
3. **Interpretability**: "Black-box" deep learning models fail to explain their visual and numerical reasoning to clinicians.

### The Q-Knee Solution
Q-Knee introduces an end-to-end **Hybrid Quantum-Classical (HQML)** diagnostic workflow combining:
- Classical **ResNet18 transfer learning** for spatial feature extraction ($512$D).
- Leak-free **Exact SVD Principal Component Analysis** for dimensionality reduction ($512\text{D} \to 4\text{D}$).
- A **4-Qubit Variational Quantum Classifier (VQC)** utilizing angle encoding, circular CNOT entanglement, and Pauli-Z expectation measurements.
- Multi-level **Explainable AI (XAI)** featuring convolutional **Grad-CAM** visual attention maps and **4D Taylor Gradient Sensitivity** feature attributions.

---

## 2. System Architecture & Pipeline

```
                                  [ Knee MRI Volume ]
                             (DICOM Series / 3D NumPy Arrays)
                                          │
                                          ▼
                         [ Slicing & Preprocessing ]
                 (Physical slice ordering, 128x128 resize, ImageNet norm)
                                          │
                                          ▼
                       [ Feature Extractor: ResNet18 ]
                     (Average-pooled layer4 map: 512D)
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

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Quantum ML & AI** | PennyLane (`default.qubit` simulator), PyTorch (TorchVision ResNet18), NumPy SVD |
| **ML Microservice** | FastAPI, Pydantic, Uvicorn, Python 3.14 / 3.11 |
| **Backend & API** | Node.js, Express, TypeScript, PostgreSQL (`pg`), Multer, JWT, Helmet |
| **Frontend Web App** | React 19, TypeScript, Vite, TailwindCSS |
| **Medical Imaging** | Pure Python DICOM parser & Hounsfield normalizer, 3D NumPy array loader |

---

## 4. Key Features

- **Multi-Format Ingestion**: Supports raw DICOM folders (`.dcm`), 3D NumPy volumes (`.npy`), and standard images with zero patient leakage.
- **Single Source of Truth**: Python ML microservice strictly manages all preprocessing, PCA transforms, VQC inference, and XAI generation.
- **Interactive Medical Viewport (`MriViewer`)**:
  - Orthogonal plane switching (Sagittal primary, Axial/Coronal 3D).
  - Slice navigation slider and keyboard shortcuts ($\leftarrow / \rightarrow$).
  - Window level adjustments (Brightness & Contrast).
  - Real-time Grad-CAM layer toggling (`Original`, `Heatmap`, `Overlay 50%`).
- **Multi-Level Explainability**:
  - **Level 1 (Visual Attention)**: ResNet18 `layer4[1].conv2` Grad-CAM heatmaps.
  - **Level 2 (Feature Attribution)**: Signed Taylor sensitivity showing how each of the 4 PCA dimensions pushed the prediction.
  - **Level 3 (Decision & Risk)**: Calibrated confidence and screening probabilities.
- **Empirical Benchmarking Suite**: Real-data comparison between Classical Support Vector Machine (SVM) and 4-Qubit VQC with vector SVG ROC curves and confusion matrices.

---

## 5. Quickstart & Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- PostgreSQL (or local SQLite/Memory store)

### 1. Clone & Configure
```bash
git clone https://github.com/your-username/q-knee.git
cd q-knee
cp .env.example .env
```

### 2. Python ML Microservice Setup
```bash
cd ml-service
python -m venv venv
# Windows: .\venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

### 3. Backend Setup
```bash
cd ../backend
npm install
npm run build
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run build
```

---

## 6. Running the Platform (3-Tier Services)

Launch each microservice in separate terminal windows:

### Terminal 1: Python ML Microservice (`:8000`)
```bash
cd ml-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Health Check*: `http://localhost:8000/health` & `http://localhost:8000/health/models`

### Terminal 2: Node.js Backend (`:3001`)
```bash
cd backend
npm run dev
```
*Health Check*: `http://localhost:3001/health`

### Terminal 3: React Frontend (`:5173`)
```bash
cd frontend
npm run dev
```
*Web Application*: Open `http://localhost:5173`

---

## 7. Pipeline CLI Commands

```bash
# 1. Prepare leak-free dataset split (70% train / 15% val / 15% test)
python scripts/prepare_dataset.py

# 2. Extract 512D ResNet18 study embeddings
python scripts/extract_features.py

# 3. Fit exact SVD PCA (512D -> 4D) strictly on training data
python scripts/fit_pca.py

# 4. Train 4-qubit Variational Quantum Classifier (VQC)
python scripts/train_quantum.py

# 5. Execute Classical SVM vs Hybrid VQC benchmark
python scripts/benchmark.py

# 6. Verify End-to-End System Integration on real MRI study
python scripts/test_end_to_end_integration.py
```

---

## 8. Complete Test Suites (42 / 42 Tests Passed)

```bash
python ml-service/tests/test_pipeline.py          # 12/12 PASSED (DICOM, windowing, slice ordering)
python ml-service/tests/test_pca_pipeline.py      #  6/6 PASSED (Leak-free 512D -> 4D PCA & scaling)
python ml-service/tests/test_quantum_module.py    #  7/7 PASSED (4-qubit VQC, parameter-shift gradients)
python ml-service/tests/test_benchmark_module.py  #  5/5 PASSED (Classical SVM, ROC curve, SVG generation)
python ml-service/tests/test_xai_module.py        #  4/4 PASSED (Grad-CAM layer4 hooks & feature attribution)
scripts/test_end_to_end_integration.py     #  8/8 PASSED (Complete end-to-end API integration)
```

---

## 9. Documentation Suite

- [**ARCHITECTURE.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/ARCHITECTURE.md): System architecture and component decomposition.
- [**SETUP.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/SETUP.md): Step-by-step installation instructions.
- [**MODEL_CARD.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/MODEL_CARD.md): Model specifications and performance parameters.
- [**DATASET.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/DATASET.md): Dataset structure and leakage prevention methodology.
- [**API.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/API.md): REST API reference documentation.
- [**TESTING.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/TESTING.md): Testing procedures and QA test scripts.
- [**DEPLOYMENT.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/DEPLOYMENT.md): Containerization and production deployment guide.
- [**QA_REPORT.md**](file:///c:/Users/utkar/OneDrive/Desktop/QKNEE/QA_REPORT.md): Complete 36-item production QA test matrix.

---

## 10. Limitations & Scientific Guardrails

- **Quantum Simulation**: Execution is conducted on the PennyLane `default.qubit` simulator. No physical quantum supremacy or hardware execution is claimed.
- **Screening Scope**: Tailored for anterior cruciate ligament (ACL) abnormality screening. Other musculoskeletal pathologies may not be detected.
- **Labels**: Dataset labels are report-derived research annotations and do not represent biopsy ground truth.

---

## 11. Medical & Regulatory Disclaimer

> **IMPORTANT**: This software is an experimental research prototype intended solely for scientific investigation, technical benchmarking, and educational demonstration. It has **NOT** been evaluated, certified, or cleared by the U.S. Food and Drug Administration (FDA), European Medicines Agency (EMA), or any other medical regulatory authority. 
> 
> **Results, probabilities, and Grad-CAM visual attention maps generated by Q-Knee must NEVER be used as a medical diagnosis, clinical finding, or substitute for professional healthcare judgment.**
