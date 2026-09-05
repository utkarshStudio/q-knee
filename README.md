# Q-Knee: Hybrid Quantum Machine Learning Platform for Knee Abnormality Detection

Q-Knee is a research-grade platform that identifies knee abnormalities using a hybrid Quantum Machine Learning (HQML) architecture. It processes MRI volumes (DICOM/NPY) and provides multi-level explainability (Visual Grad-CAM + Quantum Feature Attribution) via an interactive web viewer.

## Current Status

### Implemented & Verified
- **Cloud Storage Architecture**: Backend and ML Service communicate purely via `multipart/form-data` and memory streaming (no shared Docker volumes).
- **Multi-Plane MRI Viewer**: Real-time extraction of Axial, Coronal, and Sagittal planes using true NumPy volumetric transposition (`[D,H,W]`).
- **Data Integrity**: SHA-256 cryptographic hashing validates DICOM/NPY payloads between Node.js backend and Python ML service.
- **XAI Honesty**: UI strictly distinguishes between ResNet18 spatial Grad-CAM (visual) and VQC latent feature attribution.
- **Authentication**: JWT-based auth with explicit PostgreSQL `user_id` tenant isolation.

### Runtime Verification Pending
- **Environment Blocked**: E2E Runtime Execution (`pytest`, `npm test`, inference endpoints) is currently blocked because Docker, Node.js, and Python executables are unavailable in the host environment PATH.

### Known Limitations
- **Data**: Currently running with a synthetic/demo MRI dataset for development. Requires real clinical MRI data (e.g., RSNA dataset) to compute true accuracy, ROC-AUC, and clinical validity.
- **Quantum Advantage**: PennyLane is running in `default.qubit` (simulation mode). No physical quantum hardware execution is configured.

---

## Architecture Overview

1. **Frontend UI** (React/Vite/Tailwind): Provides secure login, Multi-Plane MRI Viewer, and Explanation dashboard.
2. **Backend API** (Node.js/Express): Manages authentication, PostgreSQL state, and streams file uploads securely to the ML service.
3. **ML Service** (Python/FastAPI): 
   - **Ingestion**: Parses 3D DICOM series / NPY volumes.
   - **Feature Extraction**: Pretrained ResNet18 -> 512D spatial embeddings.
   - **Dimensionality Reduction**: PCA (512D -> 4D).
   - **Quantum Classifier**: PennyLane 4-qubit Variational Quantum Circuit (VQC).
   - **Explainability**: Generates ResNet Grad-CAM heatmaps and VQC Pauli-Z attributions.
4. **Database** (PostgreSQL): Stores user credentials, study metadata, predictions, and explanation references.

## Repository Structure

```
q-knee/
├── README.md                 # Single source of truth
├── docs/                     # Core documentation
│   ├── ARCHITECTURE.md       # Technical design and data flows
│   ├── API.md                # REST API endpoints
│   ├── DEVELOPMENT.md        # Setup, testing, and debugging
│   └── DEPLOYMENT.md         # Docker & Cloud deployment guides
├── frontend/                 # React UI (Vite)
├── backend/                  # Node.js API server
├── ml-service/               # Python FastAPI HQML pipeline
├── data/                     # Sample datasets and volumes
├── scripts/                  # Utility and E2E verification scripts
├── tests/                    # Cross-service E2E tests
└── docker-compose.yml        # Local orchestration
```

## Running the Application (Local Docker)

*Note: Requires Docker, Node.js, and Python on the host PATH.*

1. Start the PostgreSQL database:
   ```bash
   docker-compose up -d postgres
   ```
2. Start the ML Service:
   ```bash
   cd ml-service
   pip install -r requirements.txt
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. Start the Backend:
   ```bash
   cd backend
   npm install
   npm run migrate
   npm run dev
   ```
4. Start the Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Disclaimer
**FOR RESEARCH USE ONLY.** Q-Knee is a software artifact for demonstrating Hybrid Quantum Machine Learning concepts. It is not an FDA-approved medical device and must not be used for clinical diagnosis.
