# Q-Knee Cloud Deployment Strategy & Platform Guide

This document outlines the recommended cloud platforms, architecture tradeoffs, and step-by-step deployment instructions for hosting the complete **Q-Knee** diagnostic platform.

---

## 🏆 Recommended Platform Matrix

| Platform Strategy | Target Use Case | Frontend | Backend API | Python ML Microservice | Database | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Option 1: Free Multi-Cloud (Recommended for Hackathons)** | Fast, free tier, zero server maintenance | **Vercel** / **Netlify** | **Render** / **Railway** | **Render** / **Railway** | **Neon** / **Supabase** / Local Fallback | **$0.00 / month (Free)** |
| **Option 2: Single Linux VPS (Docker Compose)** | Production control, 1-command deployment | **Nginx Container** | **Node.js Container** | **Python Container** | **PostgreSQL Container** | **$4 - $6 / month** (DigitalOcean / Hetzner) |
| **Option 3: Enterprise Serverless (GCP / AWS)** | High scalability, auto-scaling | **Firebase / S3** | **Google Cloud Run** | **Google Cloud Run** | **Google Cloud SQL** | **Pay-per-request** |

---

## 🌟 Option 1: Free Multi-Cloud Deployment Walkthrough (Step-by-Step)

This setup requires **no credit card** and gives you dedicated HTTPS URLs for all microservices:

```
┌───────────────────────────────┐
│       React Frontend          │
│   (Hosted on Vercel)          │
│   https://qknee.vercel.app    │
└───────────────┬───────────────┘
                │ API Requests (VITE_API_URL)
                ▼
┌───────────────────────────────┐
│     Express Backend API       │
│   (Hosted on Render)          │
│   https://qknee-api.onrender  │
└───────────────┬───────────────┘
                │ Internal Inference (ML_SERVICE_URL)
                ▼
┌───────────────────────────────┐
│    Python ML Microservice     │
│   (Hosted on Render)          │
│   https://qknee-ml.onrender   │
└───────────────────────────────┘
```

### Step 1: Deploy Python ML Microservice on Render (Free)
1. Go to [**Render.com**](https://render.com) and create a **New Web Service**.
2. Connect your GitHub repository: `https://github.com/utkarshStudio/q-knee.git`.
3. Configure the service:
   - **Name**: `qknee-ml-service`
   - **Root Directory**: `ml-service`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. Click **Create Web Service**.
5. *Copy the generated ML service URL (e.g., `https://qknee-ml-service.onrender.com`)*.

---

### Step 2: Deploy Express Backend API on Render (Free)
1. On [**Render.com**](https://render.com), create another **New Web Service**.
2. Select the same GitHub repository: `https://github.com/utkarshStudio/q-knee.git`.
3. Configure the service:
   - **Name**: `qknee-backend-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Add **Environment Variables**:
   - `NODE_ENV`: `production`
   - `ML_SERVICE_URL`: `https://qknee-ml-service.onrender.com` *(from Step 1)*
   - `FRONTEND_URL`: `https://qknee.vercel.app` *(or your Vercel URL)*
   - `JWT_SECRET`: `your-random-32-character-secret-key-string`
5. Click **Create Web Service**.
6. *Copy the generated Backend API URL (e.g., `https://qknee-backend-api.onrender.com`)*.

---

### Step 3: Deploy Frontend on Vercel (Free)
1. Go to [**Vercel.com**](https://vercel.com) and click **Add New Project**.
2. Import `https://github.com/utkarshStudio/q-knee.git`.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL`: `https://qknee-backend-api.onrender.com` *(from Step 2)*
5. Click **Deploy**.

---

## 🐳 Option 2: 1-Command VPS Deployment (DigitalOcean / AWS / GCP)

If deploying to any standard Linux VM (Ubuntu 22.04 LTS):

```bash
# 1. Connect to your VPS server
ssh root@your-server-ip

# 2. Install Docker & Docker Compose (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Clone the Q-Knee repository
git clone https://github.com/utkarshStudio/q-knee.git
cd q-knee

# 4. Copy environment configuration
cp .env.example .env

# 5. Launch all 4 containers with Docker Compose
docker compose up --build -d

# 6. Verify all containers are healthy
docker compose ps
```

---

## 🔒 Post-Deployment Verification Checklist

Once deployed, test your live production environment:

```bash
# 1. Test ML Service Health
curl https://<your-ml-service-url>/health

# 2. Test Backend API Health
curl https://<your-backend-url>/health

# 3. Test Full Pipeline Inference
curl -X POST https://<your-ml-service-url>/predict \
  -H "Content-Type: application/json" \
  -d '{"study_id":"study_001","file_paths":[],"model_type":"quantum","mode":"DEMO"}'
```
