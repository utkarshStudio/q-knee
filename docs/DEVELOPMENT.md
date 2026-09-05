# Q-Knee Development & Testing Guide

This guide covers setting up the development environment, running tests, and debugging the HQML pipeline.

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- PostgreSQL (15+)
- Docker & Docker Compose (optional for local infra)

## Local Development Setup

1. **Database Setup**
   ```bash
   # Run Postgres via Docker
   docker-compose up -d postgres
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run migrate    # Creates DB schema
   npm run dev        # Starts Node server on port 3001
   ```

3. **ML Service Setup**
   ```bash
   cd ml-service
   python -m venv venv
   source venv/bin/activate  # (or venv\Scripts\activate on Windows)
   pip install -r requirements.txt
   
   # Start FastAPI server on port 8000
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev        # Starts Vite on port 5173
   ```

## Testing

Q-Knee includes comprehensive unit and integration tests across services.

### ML Service Testing
Testing the Python backend ensures the ResNet18 and PennyLane VQC are functioning mathematically correctly, and that DICOM/NPY loaders successfully manipulate multi-dimensional arrays.
```bash
cd ml-service
python -m pytest tests/
```
Key Test Files:
- `test_ml_endpoints.py`: Tests the API router inputs.
- `test_security.py`: Verifies SHA-256 payload validation.
- `test_multi_plane.py`: Validates deterministic 3D volume transposition for the Multi-Plane Viewer.

### Backend Testing
Ensures PostgreSQL models and Auth logic function properly.
```bash
cd backend
npm test
```

## Debugging

- **File Hashes**: Check the terminal logs on both Node.js (`BACKEND RECEIVED HASH`) and FastAPI (`ML RECEIVED HASH`) to ensure payloads are not corrupted over the network.
- **PennyLane**: To inspect the Quantum circuit, look at `app.models.quantum_model.predict`. It currently runs in `default.qubit` simulation mode.
