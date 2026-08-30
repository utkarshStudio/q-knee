# Q-Knee Production Deployment Guide

## 1. Production Architecture Overview

The Q-Knee platform is structured as a 4-service production-ready stack:

```
[ Web Clients / Radiologists ]
             │
             ▼
   [ Reverse Proxy / Nginx ]
     ├── /api/*   ──▶  [ Express Backend (:3001) ] ──▶ [ PostgreSQL (:5432) ]
     │                         │
     │                         ▼
     │                 [ Python ML Microservice (:8000) ]
     │                 (PyTorch / PennyLane Simulator)
     └── /*       ──▶  [ Static Frontend SPA (:80 / :5173) ]
```

---

## 2. Model Storage & Artifact Strategy

The hybrid quantum pipeline is engineered for extreme lightweight portability:
- **ResNet18 Backbone**: 44 MB weights downloaded automatically on first startup via `torchvision.models.resnet18(weights=DEFAULT)` and cached in `~/.cache/torch/hub/checkpoints/`.
- **PCA Model (`pca.pkl` + `pca_metrics.json`)**: < 20 KB exact SVD projection matrix.
- **Quantum VQC Model (`vqc_weights.npy` + `vqc_config.json`)**: < 2 KB variational angle rotation parameters.
- **Classical SVM Baseline (`svm_classifier.pkl`)**: < 10 KB calibrated support vector parameters.

Because all custom model artifacts total **less than 100 KB**, they are safely version-controlled and instantly initialized in containerized environments without requiring external S3/GCS bucket dependencies.

---

## 3. One-Command Containerized Deployment (Docker Compose)

The easiest and most reliable way to run the full production stack is using Docker Compose:

```bash
# 1. Clone repository
git clone https://github.com/utkarshStudio/q-knee.git
cd q-knee

# 2. Configure environment
cp .env.example .env

# 3. Build and launch all services in background
docker compose up --build -d

# 4. View service logs
docker compose logs -f
```

### Container Endpoints:
- **Frontend SPA**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001` (`/health`)
- **ML Microservice**: `http://localhost:8000` (`/health` & `/health/models`)
- **PostgreSQL**: `localhost:5432`

---

## 4. Multi-Platform Cloud Deployment

### Option A: PaaS (Render / Railway / Fly.io)

1. **Python ML Microservice**:
   - Environment: Python 3.11+
   - Build Command: `pip install -r ml-service/requirements.txt`
   - Start Command: `cd ml-service && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/health`

2. **Express Backend**:
   - Environment: Node.js 20+
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
   - Environment Variables:
     - `DATABASE_URL`: Managed PostgreSQL connection string
     - `ML_SERVICE_URL`: URL of the deployed ML microservice
     - `FRONTEND_URL`: URL of the deployed frontend
     - `JWT_SECRET`: 64-character random string

3. **React Frontend (Vercel / Cloudflare Pages / Netlify)**:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variable:
     - `VITE_API_URL`: URL of the deployed Express backend

---

## 5. Security & Production Checklist

- [x] **CORS Configuration**: Dynamic whitelist supporting production domain and staging origins.
- [x] **Zero Hardcoded URLs**: All endpoints resolve dynamically via `VITE_API_URL` and `ML_SERVICE_URL`.
- [x] **Path Traversal Protection**: Parameter validation and absolute path restrictions on file/image serving.
- [x] **Zero Stack Trace Leakage**: Standardized JSON error bodies without internal stack dumps.
- [x] **Rate Limiting**: Configured at 200 requests / 15 minutes per IP.
- [x] **Payload Limits**: Ingestion capped at 200 MB for MRI volumes.
- [x] **Medical Disclaimer**: Rendered prominently across all diagnostic views.
