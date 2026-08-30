# Q-Knee Project Technical Audit

**Project**: Q-Knee — Hybrid Quantum Machine Learning Platform for Knee Abnormality Detection  
**Document Version**: 1.0.0  
**Audit Date**: August 30, 2026  
**Status**: Comprehensive Codebase Audit & Gap Analysis

---

## A. Current Architecture

The project employs a decoupled 3-tier service architecture:

1. **Client / Frontend Tier (`frontend/`)**:
   - **Framework**: React 19 + TypeScript + Vite + TailwindCSS 4.
   - **Routing**: `react-router-dom` v7 with Protected Route guards.
   - **State / API**: Axios client with JWT request interceptors, React Context (`AuthContext`).
   - **Key Pages**: `DashboardPage`, `StudiesPage`, `UploadPage`, `StudyDetailPage`, `ExplainabilityPage`, `BenchmarkPage`, `SettingsPage`, `LoginPage`, `SignupPage`.

2. **Backend API Tier (`backend/`)**:
   - **Framework**: Node.js + Express 4 + TypeScript (`ts-node-dev`).
   - **Database**: PostgreSQL with direct `pg` connection pooling.
   - **File Handling**: `multer` storing uploads in `storage/uploads/`.
   - **Security**: `helmet`, `express-rate-limit`, `bcryptjs` (password hashing), `jsonwebtoken` (session tokens).
   - **Endpoints**: `/api/auth`, `/api/studies`, `/api/predictions`, `/api/explanations`, `/api/benchmarks`, `/api/dashboard`.

3. **ML & Quantum Microservice (`ml-service/`)**:
   - **Framework**: Python 3 + FastAPI + Uvicorn.
   - **Classical Feature Extraction**: PyTorch + Torchvision ResNet18 (ImageNet weights, FC layer truncated).
   - **Dimensionality Reduction**: Scikit-Learn `PCA(n_components=4)`.
   - **Classical Baseline**: Scikit-Learn `CalibratedClassifierCV(SVC(kernel='rbf'))`.
   - **Quantum Engine**: PennyLane (`default.qubit` statevector simulator) with 4 qubits, $RY$ angle encoding, $RZ/RX$ rotations, CNOT ladder, and Pauli-$Z$ measurement on qubit 0.
   - **XAI Engine**: PyTorch hook-based Grad-CAM from ResNet18 `layer4` + Sensitivity-based feature attribution on the 4 PCA dimensions.

---

## B. Existing Working Features

1. **Authentication & Session Management**:
   - JWT generation, validation, password hashing with bcrypt, role management (`researcher` vs `admin`), and route protection in both Express middleware and React frontend.
2. **PostgreSQL Database Schema & Migrations**:
   - Clean DDL migration script (`backend/src/db/migrate.ts`) creating `users`, `studies`, `predictions`, `explanations`, `experiments`, and `benchmarks` tables.
3. **Study Upload & Storage**:
   - Multi-file drag-and-drop / file selector in React, Multer storage in Express, study record creation in PostgreSQL.
4. **ResNet18 Feature Extraction**:
   - Truncated ResNet18 forward pass extracting exact 512-dimensional embeddings, with slice-level mean pooling.
5. **PCA Dimensionality Reduction**:
   - Functional Scikit-Learn PCA reducing 512D embeddings to 4D feature vectors, with model serialization (`pca.pkl`).
6. **Classical SVM Baseline Classifier**:
   - RBF-kernel SVM with calibrated probabilities (`CalibratedClassifierCV`) predicting abnormal vs normal probabilities.
7. **Variational Quantum Classifier (VQC) Circuit & Optimization**:
   - Mathematically correct PennyLane parameterized quantum circuit with 4 qubits, angle encoding, parameterized rotation gates, CNOT entanglement, Pauli-$Z$ expectation measurement, and parameter-shift gradient descent training loop.
8. **Explainability Visualizations (UI Level)**:
   - 3-panel Grad-CAM image display (Original MRI, Heatmap, Overlay) and PCA feature sensitivity bar charts in React.
9. **Research Benchmarking UI & Storage**:
   - Comparison table displaying Accuracy, Precision, Recall, F1-Score, ROC-AUC, and sample sizes for both models.

---

## C. Partially Implemented Features

1. **DICOM Ingestion (`ml-service/app/services/dicom_service.py`)**:
   - Reads `.dcm` files with `pydicom` and extracts `pixel_array`.
   - *Missing*: Does not handle DICOM windowing/leveling (Window Center / Window Width), Photometric Interpretation (MONOCHROME1 inversion), Rescale Slope/Intercept, or 3D multi-frame series correctly.
2. **Slice Aggregation & Selection (`ml-service/app/services/dicom_service.py`)**:
   - Samples up to 5 slices using uniform spacing (`np.linspace`).
   - *Missing*: Does not sort slices by physical spatial metadata (`SliceLocation` or `ImagePositionPatient`), risking out-of-order anatomical slicing.
3. **Grad-CAM Implementation (`ml-service/app/pipeline/gradcam.py`)**:
   - Correct hook architecture on `layer4[-1]`, but backpropagates through an *untrained*, randomly initialized classifier head.

---

## D. Placeholder / Demo / Synthetic Implementations

1. **Synthetic Feature Generation (`ml-service/app/services/demo_service.py`)**:
   - `generate_demo_features()` generates random Gaussian 512D vectors ($N=60$) used for PCA, SVM, and VQC training on startup when no trained model artifacts exist.
2. **Synthetic Evaluation Benchmarks (`ml-service/app/services/benchmark_service.py`)**:
   - Benchmarking creates 80 synthetic samples to compute metrics rather than evaluating on a true held-out clinical test split.
3. **Synthetic Image Generator (`ml-service/app/services/demo_service.py`)**:
   - `generate_demo_image()` produces a synthetic circular pattern when no input image is found.

---

## E. Broken Features

1. **Dangling `/process` Endpoint Call (`backend/src/routes/studies.ts:98`)**:
   - On upload, backend attempts `axios.post('${mlUrl}/process', ...)` to trigger background processing. The FastAPI service has no `/process` route defined. The call fails and is silently caught by `.catch()`.
2. **Grad-CAM Random Weights Gradient Flaw (`ml-service/app/pipeline/feature_extractor.py:37`)**:
   - `get_model_for_gradcam()` sets `model.fc = nn.Linear(512, 2)` without loading trained weights. Backpropagation occurs through random weights, generating non-reproducible heatmaps.

---

## F. Missing Features

1. **NPY Array Ingestion**:
   - `.npy` file format support is completely absent from backend Multer filters (`backend/src/routes/studies.ts`) and ML loaders (`ml-service/app/services/dicom_service.py`).
2. **Interactive Multi-Plane Slice Viewer**:
   - The UI lacks an interactive medical viewer with axial, sagittal, and coronal plane switching and interactive slice scrolling sliders.
3. **End-to-End Real Dataset Training Script**:
   - No offline/batch training script exists to process the full RSNA dataset, extract ResNet features, fit PCA, and train the calibrated SVM and VQC models with persistent artifacts.
4. **Qiskit Aer Backend Integration**:
   - Documentation and requirements mention Qiskit Aer, but the codebase solely uses PennyLane `default.qubit`.

---

## G. Duplicate / Unnecessary Code

1. **Redundant Route Handlers (`backend/src/routes/explanations.ts`)**:
   - Both `/api/explanations/:predictionId` and `/api/explanations/:predictionId/explain` perform duplicate queries.
2. **Vite Template Boilerplate (`frontend/src/assets/`)**:
   - Unused SVG assets (`react.svg`, `vite.svg`) from the initial Vite template.

---

## H. Security Issues

1. **Permissive Multer Storage**:
   - File uploads write directly to local disk without checking for zip bombs or non-image malicious payloads.
2. **Hardcoded Fallback Secrets**:
   - Default JWT secret fallbacks in code if `.env` is unconfigured.
3. **CORS Configuration**:
   - Wildcard or loose localhost configurations need strict environment matching for production deployment.

---

## I. Performance Issues

1. **VQC Training Speed on CPU**:
   - Parameter-shift rule iterates sequentially over every quantum parameter per sample ($2 \times \text{depth} \times \text{qubits} \times \text{parameters} = 32$ circuit evaluations per sample per epoch). On CPU, this makes real-time training slow without batching or JIT compilation (`jax` / `torch` interface).
2. **Synchronous Image Transformation**:
   - ResNet18 feature extraction across multiple DICOM files is executed synchronously during API request handling.

---

## J. Data Pipeline Issues

1. **No Patient-Level Split**:
   - Current benchmark splitting is sample-level, which risks patient leakage if multiple slices or series from the same patient exist in train and test sets.
2. **RSNA Label Column Mapping**:
   - `rsna_service.py` uses heuristic lookups for columns (`study_id` vs `StudyInstanceUID`, `acl_tear` vs `ACL`) which may fail without schema validation.

---

## K. ML Correctness Issues

1. **ResNet18 Grayscale Conversion**:
   - Preprocessing duplicates 1-channel grayscale to 3 channels to feed into ImageNet ResNet18. While standard, fine-tuning or adapting the first convolutional layer (`conv1`) yields better gradient fidelity for medical imaging.
2. **Grad-CAM Linear Head Calibration**:
   - The classification head used for Grad-CAM must match the trained classifier weights.

---

## L. Deployment Issues

1. **Missing Containerization**:
   - No `Dockerfile` or `docker-compose.yml` exists to orchestrate PostgreSQL, the Express API, the Python ML microservice, and the Vite frontend.
2. **Local Path Dependencies**:
   - Path resolution across Windows/Linux path separators in `.env` and `storage/uploads` needs cross-platform normalization.

---

## Requirement Matrix

| Requirement | Current Status | File(s) | Required Action | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **DICOM Loading** | PARTIAL | `ml-service/app/services/dicom_service.py` | Add VOI LUT / window leveling, rescale slope/intercept, handle PhotometricInterpretation | High |
| **NPY Loading** | MISSING | `backend/src/routes/studies.ts`, `dicom_service.py` | Add `.npy` upload support and 3D array slice slicing | High |
| **MRI Preprocessing** | DONE | `ml-service/app/pipeline/feature_extractor.py` | Maintain 128x128 resizing, grayscale normalization, and ImageNet standardization | Medium |
| **Slice Handling** | PARTIAL | `dicom_service.py` | Implement physical slice sorting by `SliceLocation` / `ImagePositionPatient` | High |
| **ResNet18 Feature Extraction** | DONE | `feature_extractor.py` | Truncate final FC, output 512D embedding per slice | High |
| **512-D Embedding** | DONE | `feature_extractor.py` | Mean-pool across selected representative slices | High |
| **PCA 512 $\to$ 4** | DONE | `pca_handler.py` | Fit PCA on 512D features to produce exact 4 classical features | High |
| **PCA Persistence** | DONE | `pca_handler.py` | Save and load `pca.pkl` model artifact | Medium |
| **4-Qubit Quantum Circuit** | DONE | `quantum_model.py` | Configure 4-wire quantum register on PennyLane | High |
| **Angle Encoding** | DONE | `quantum_model.py` | Encode 4 classical features using $RY(\pi \cdot x_i)$ gates | High |
| **CNOT Entanglement** | DONE | `quantum_model.py` | Linear CNOT ladder across wires $0 \to 1 \to 2 \to 3$ | High |
| **Pauli-Z Expectation** | DONE | `quantum_model.py` | Measure $\langle Z_0 \rangle$ and map to probability $[0, 1]$ | High |
| **VQC Training** | DONE | `quantum_model.py` | Parameter-shift gradient descent optimizing MSE loss | High |
| **SVM Baseline** | DONE | `classical_model.py` | RBF kernel SVM with calibrated probabilities | Medium |
| **Real Dataset Training Script** | MISSING | `ml-service/train_offline.py` (to create) | Build standalone training script on RSNA dataset | High |
| **Model Persistence** | DONE | `quantum_model.py`, `classical_model.py` | Save `vqc_weights.npy`, `classical_svm.pkl`, `pca.pkl` | Medium |
| **Inference Pipeline** | DONE | `ml-service/app/main.py:68-98` | End-to-end inference from uploaded study to prediction | High |
| **Grad-CAM** | PARTIAL | `gradcam.py` | Fix random linear head; hook to trained feature weights | High |
| **Feature Attribution** | DONE | `attribution.py` | Sensitivity perturbation analysis on 4 PCA components | Medium |
| **ROC-AUC & Metrics** | DONE | `benchmark_service.py` | Accuracy, Precision, Recall, F1, ROC-AUC calculation | Medium |
| **Frontend Upload** | DONE | `UploadPage.tsx` | Drag-and-drop multi-file upload with validation | High |
| **Prediction Display** | DONE | `StudyDetailPage.tsx` | Risk score, class, confidence, mode badges | High |
| **Explainability Visualization**| DONE | `ExplainabilityPage.tsx` | 3-image Grad-CAM panel and PCA delta bar charts | High |
| **Multi-Plane Controls** | MISSING | `StudyDetailPage.tsx` / `MRIViewer.tsx` | Implement slice slider and orientation plane selector | Medium |
| **API Integration** | DONE | `backend/src/routes/` | Express $\leftrightarrow$ FastAPI proxy and PostgreSQL persistence | High |
| **Database Persistence** | DONE | `backend/src/db/migrate.ts` | PostgreSQL tables for users, studies, predictions, benchmarks | High |
| **Deployment Configuration** | PARTIAL | `package.json`, `.env.example` | Create Dockerfile / docker-compose and cross-platform setup | Medium |

---
