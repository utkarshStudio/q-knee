# Q-Knee Deployment Guide

This document covers deploying Q-Knee via Docker Compose for production or staging environments.

## Docker Deployment Architecture

The application is containerized into three primary services:
1. `frontend`: Nginx serving the built React static files.
2. `backend`: Node.js Express API.
3. `ml-service`: Python FastAPI application (heavy lifting).

Database:
- `postgres`: PostgreSQL 15 database.

## Prerequisites
- Docker (v20+)
- Docker Compose (v2+)

## Quick Start (Docker Compose)

1. **Environment Configuration**
   Ensure your `.env` file at the root contains the correct settings:
   ```env
   # Database
   POSTGRES_USER=qknee_user
   POSTGRES_PASSWORD=qknee_pass
   POSTGRES_DB=qknee_db

   # Backend Secrets
   JWT_SECRET=super_secure_jwt_secret_change_in_production
   
   # Networking (Internal Docker DNS)
   ML_SERVICE_URL=http://ml-service:8000
   DATABASE_URL=postgres://qknee_user:qknee_pass@postgres:5432/qknee_db
   ```

2. **Build and Run**
   ```bash
   docker-compose up --build -d
   ```

3. **Verify Deployment**
   - Frontend: `http://localhost`
   - Backend API: `http://localhost:3001`
   - ML Service: `http://localhost:8000`

## Production Notes

### Scaling the ML Service
The ML Service performs computationally heavy tensor operations. Since the backend streams files over the network without relying on local shared volumes, the ML Service can be deployed as a separate Auto-Scaling Group (ASG) or serverless container (e.g., AWS ECS, Google Cloud Run) independently of the Node.js backend.

### Quantum Hardware Considerations
By default, the `ml-service` runs PennyLane in `default.qubit` mode (a CPU simulator). 
To run on real quantum hardware (e.g., IBM Q, AWS Braket), you must update `ml-service/app/models/quantum_model.py` to point to a hardware backend plugin and provide the necessary API keys in the environment variables.

### Database Persistence
The `docker-compose.yml` mounts a volume to `/var/lib/postgresql/data`. Ensure this volume is backed up regularly if running on a single host.
