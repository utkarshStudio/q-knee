# Q-Knee Testing & Verification Guide

This document details the test suites, verification commands, and quality metrics across the Q-Knee codebase.

---

## Complete Test Suite Execution (42 Tests)

To run all backend, ML, and integration unit test suites:

```bash
# 1. Medical Imaging & Windowing Pipeline Tests (12 tests)
python ml-service/tests/test_pipeline.py

# 2. PCA & Feature Reduction Tests (6 tests)
python ml-service/tests/test_pca_pipeline.py

# 3. 4-Qubit Quantum VQC Tests (7 tests)
python ml-service/tests/test_quantum_module.py

# 4. Classical Baseline & Benchmarking Tests (5 tests)
python ml-service/tests/test_benchmark_module.py

# 5. Explainability (XAI) Tests (4 tests)
python ml-service/tests/test_xai_module.py

# 6. End-to-End System Integration Tests (8 tests)
python scripts/test_end_to_end_integration.py
```

---

## Production QA Pass & Latency Benchmarks

To run the automated production QA suite and measure latencies across all components:

```bash
python scripts/run_production_qa.py
```
This validates:
- Ingestion of valid/corrupt DICOM and 3D NPY volumes
- Exact dimensionality ($512 \to 4 \to 1$)
- Deterministic inference
- Path traversal and security hardening
- Latency benchmarks

---

## Frontend Build & Linter Verification

```bash
cd frontend

# TypeScript type check and production Vite build
npm run build

# Code style and hook linting
npm run lint
```

---

## Backend Build Verification

```bash
cd backend

# TypeScript compilation
npm run build
```
