# Q-Knee Setup & Installation Guide

This guide provides step-by-step instructions to set up and run the Q-Knee Hybrid Classical-Quantum Diagnostic Platform from a clean environment.

---

## System Requirements

- **Operating System**: Windows 10/11, macOS, or Ubuntu 20.04+
- **Python**: 3.10, 3.11, or 3.14 (Virtual environment recommended)
- **Node.js**: v18.0+ or v20.0+ (with npm)
- **PostgreSQL**: v14+ (or SQLite local fallback for prototype testing)

---

## 1. Clone & Environment Configuration

```bash
git clone https://github.com/your-username/q-knee.git
cd q-knee

# Copy environment template
cp .env.example .env
```

Review and adjust `.env` variables as needed (e.g. database credentials, ports).

---

## 2. Python ML Microservice Setup

```bash
# Navigate to ML service directory
cd ml-service

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Run ML Service Unit Tests
```bash
python -m unittest discover tests
```

---

## 3. Backend Setup

```bash
# Navigate to backend directory
cd ../backend

# Install Node.js dependencies
npm install

# Build TypeScript
npm run build
```

---

## 4. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Build production bundle
npm run build
```

---

## 5. Running the 3-Tier Platform

Start each microservice in separate terminal windows:

### Terminal 1: Python ML Microservice
```bash
cd ml-service
# Activate virtual environment
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Health Check*: `http://localhost:8000/health`

### Terminal 2: Node.js / Express Backend
```bash
cd backend
npm run dev
```
*Health Check*: `http://localhost:3001/health`

### Terminal 3: React Frontend (Vite)
```bash
cd frontend
npm run dev
```
*Web Application*: Open `http://localhost:5173` in your browser.

---

## 6. End-to-End Verification

To verify full pipeline execution on real sample data:

```bash
python scripts/test_end_to_end_integration.py
```
All 8 integration tests should return `OK`.
