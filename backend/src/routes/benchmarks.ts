import { Router, Response } from "express";
import axios from "axios";
import { pool } from "../db/pool";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// List benchmarks
router.get("/", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM benchmarks ORDER BY created_at DESC LIMIT 100");
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err) {
    // Database query failed, continue to fallback
  }

  // Fallback to local stored benchmark_results.json
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const jsonPath = path.resolve(__dirname, "../../../data/benchmarks/benchmark_results.json");
    const raw = await fs.readFile(jsonPath, "utf-8");
    const payload = JSON.parse(raw);
    const rows = (payload.results || []).map((r: any, idx: number) => ({
      id: idx + 1,
      experiment_id: 1,
      mode: r.mode || payload.mode || "REAL",
      model_name: r.model_name,
      accuracy: r.accuracy,
      precision_score: r.precision_score,
      recall: r.recall,
      f1: r.f1,
      roc_auc: r.roc_auc,
      sample_count: r.sample_count,
      dataset_information: payload.dataset_information,
      model_configuration: r.model_configuration,
      created_at: payload.timestamp || new Date().toISOString(),
    }));
    return res.json(rows);
  } catch (e) {
    return res.json([]);
  }
});

// List experiments (GET /api/experiments resolves here)
router.get("/experiments-list", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM experiments ORDER BY created_at DESC LIMIT 50");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Run benchmark
router.post("/run", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";
    const datasetConfigured = !!(process.env.RSNA_DATA_DIR && process.env.RSNA_DATA_DIR !== "" && process.env.RSNA_DATA_DIR !== "/path/to/rsna/knee/dataset");
    const mlRes = await axios.post(
      `${mlUrl}/benchmark`,
      { mode: datasetConfigured ? "REAL" : "DEMO" },
      { timeout: 300000 }
    );

    const data = mlRes.data;

    // Create experiment record
    const expResult = await pool.query(
      "INSERT INTO experiments (name, description, mode, model_configuration, dataset_information) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [
        `Benchmark ${new Date().toISOString()}`,
        "Automated classical vs quantum benchmark",
        data.mode || "DEMO",
        JSON.stringify(data.model_configuration || {}),
        JSON.stringify(data.dataset_information || {}),
      ]
    );
    const experimentId = expResult.rows[0].id;

    // Store individual model results
    for (const result of data.results || []) {
      await pool.query(
        `INSERT INTO benchmarks (experiment_id, mode, model_name, accuracy, precision_score, recall, f1, roc_auc, sample_count, dataset_information, model_configuration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          experimentId, result.mode || data.mode || "DEMO",
          result.model_name,
          result.accuracy ?? null, result.precision ?? null,
          result.recall ?? null, result.f1 ?? null, result.roc_auc ?? null,
          result.sample_count ?? null,
          JSON.stringify(data.dataset_information || {}),
          JSON.stringify(result.model_configuration || {}),
        ]
      );
    }

    res.json({ message: `Benchmark complete. ${data.results?.length || 0} model(s) evaluated.`, data });
  } catch (err: any) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      res.status(503).json({ error: "ML service unavailable. Please start the ML service first." });
      return;
    }
    console.error("Benchmark error:", err.message);
    res.status(500).json({ error: err?.response?.data?.detail || "Benchmark failed" });
  }
});

export default router;
