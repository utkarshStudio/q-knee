# Q-Knee Live Demonstration Checklist & Troubleshooting Guide

Use this checklist 15 minutes before the hackathon presentation to guarantee a flawless live demonstration.

---

## 📋 Pre-Demo Verification Checklist

- [ ] **1. Python ML Microservice Running**:
  ```bash
  # Check ML service health
  curl -s http://localhost:8000/health
  # Expected: {"status": "ok", "service": "qknee-ml", "quantum_backend": "default.qubit (SIMULATION)", "pca_fitted": true, ...}
  ```

- [ ] **2. Model Artifacts Verified**:
  ```bash
  # Check model health and parameters
  curl -s http://localhost:8000/health/models
  # Expected: quantum_vqc.qubits == 4, pca.n_components == 4
  ```

- [ ] **3. Node.js Backend API Running**:
  ```bash
  curl -s http://localhost:3001/health
  # Expected: {"status": "ok", "service": "qknee-backend", ...}
  ```

- [ ] **4. React Frontend Accessible**:
  - Open `http://localhost:5173` in Chrome/Brave.
  - Verify dashboard loads with 0 console errors.

- [ ] **5. Sample Knee MRI Volume Ready**:
  - Ensure sample file exists on disk:
    `data/sample_mri_dataset/train_series/study_001/volume.npy`
  - Have this folder bookmarked in your file explorer for drag-and-drop.

- [ ] **6. Grad-CAM & XAI Verified**:
  - Run verification script:
    ```bash
    python scripts/test_xai_sample.py
    ```

- [ ] **7. Benchmark SVG Visualizations Loaded**:
  - Check `http://localhost:5173/benchmark` to confirm ROC Curves and Confusion Matrices render cleanly.

- [ ] **8. Full Pipeline End-to-End Test Passed**:
  ```bash
  python scripts/test_end_to_end_integration.py
  # Expected: Ran 8 tests in ~2.3s -> OK
  ```

---

## 🚀 Quick Launch Command Sequence (3 Terminals)

```bash
# Terminal 1: ML Microservice
cd ml-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Backend API
cd backend
npm run dev

# Terminal 3: Frontend UI
cd frontend
npm run dev
```

---

## 🛠️ Common Failure Modes & Troubleshooting

| Issue / Symptom | Root Cause | Immediate Fix |
| :--- | :--- | :--- |
| **Frontend displays "Network Error" on upload** | Backend (`:3001`) or ML service (`:8000`) is offline | Check terminal outputs; ensure all 3 services are active. Test `curl http://localhost:8000/health`. |
| **CORS error in browser console** | Origin mismatch during testing | Backend accepts dynamic origins from `FRONTEND_URL`. Verify `.env` has `FRONTEND_URL=http://localhost:5173`. |
| **"PCA model not fitted" error** | Missing `pca.pkl` artifact | Run `python scripts/fit_pca.py` to regenerate in $< 1\text{ second}$. |
| **Grad-CAM heatmap is blank or gray** | Model was in training mode or zero gradients | Ensure inference uses `model.eval()` and target layer is `ResNet18.layer4[1].conv2`. |
| **PostgreSQL connection refused** | Local Postgres container or service is stopped | The backend automatically operates in fallback mode if database is offline, logging warning while serving predictions. |
| **Volume upload takes > 5 seconds** | Slicing uncompressed DICOM batch on slow disk | Use pre-extracted `volume.npy` sample file for instant sub-second upload and processing during live presentation. |

---

## 💡 Pro Tips for Presenters

1. **Keep Browser Open on Dashboard**: Pre-open tabs for Dashboard (`/`), Upload (`/upload`), and Benchmarks (`/benchmark`).
2. **Use Keyboard Shortcuts**: In the `MriViewer`, use Left/Right arrow keys ($\leftarrow / \rightarrow$) to swiftly scroll through slices.
3. **Point Out Disclaimers**: Judges appreciate clinical safety awareness—explicitly highlight the "AI-assisted screening result" badge and research disclaimer banner.
