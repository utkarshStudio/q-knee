# Q-Knee REST API

This document details the primary endpoints exposed by the Node.js backend. The backend securely proxies complex volumetric data and analytical requests to the ML Service.

## Authentication

All endpoints (except login/register) require a Bearer token in the `Authorization` header.

## Endpoints

### Auth
- `POST /api/auth/register`: Register a new researcher.
- `POST /api/auth/login`: Authenticate and receive a JWT.

### Studies
- `GET /api/studies`: List all studies for the authenticated user.
- `GET /api/studies/:id`: Retrieve details for a specific study.
- `POST /api/studies/upload`: Upload a new MRI volume (DICOMs or NPY). Initiates the ML parsing pipeline via `/process` on the ML Service.
- `GET /api/studies/:id/slice/:sliceIdx`: Retrieve a specific slice of the 3D volume as a PNG image.
  - **Query Parameters**: `plane` (axial | coronal | sagittal)

### Predictions
- `POST /api/predictions`: Trigger a prediction on a previously uploaded study.
  - **Body**: `{ study_id: "...", model_type: "quantum" | "classical" }`
- `GET /api/studies/:id/predictions`: List previous predictions for a study.

### Explanations
- `POST /api/explanations/explain`: Generate XAI metrics (Grad-CAM & Attribution) for a prediction.
- `GET /api/explanations/:explanationId/image/heatmap`: Retrieve the raw Grad-CAM heatmap PNG.
- `GET /api/explanations/:explanationId/image/overlay`: Retrieve the Grad-CAM overlaid on the original MRI slice.

## ML Service Internal API (Not directly exposed)
- `POST /process`: Validates, parses, and hashes incoming multipart file bytes. Returns volume dimensions.
- `POST /preview/slice`: Returns transposed image arrays based on `slice_idx` and `plane`.
- `POST /predict`: Generates HQML predictions and returns raw probabilities.
- `POST /explain`: Generates spatial gradients from ResNet and latent attribution from PennyLane.
