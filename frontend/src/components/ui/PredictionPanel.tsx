import { Link } from "react-router-dom";
import { formatPercent, formatDate } from "../../lib/utils";
import { Brain, Cpu, ArrowRight, Activity, ShieldAlert, CheckCircle2 } from "lucide-react";

interface PredictionProps {
  prediction: any;
}

export function PredictionPanel({ prediction }: PredictionProps) {
  const isAbnormal = prediction.predicted_class === "abnormal";
  const isQuantum = prediction.model_type === "quantum" || prediction.model_name?.toLowerCase().includes("quantum") || prediction.model_name?.toLowerCase().includes("vqc");

  return (
    <div className="card p-6 relative overflow-hidden group">
      {/* Background Decor */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none transition-opacity duration-700 ${
        isAbnormal ? "bg-amber-500" : "bg-emerald-500"
      }`}></div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
        
        {/* Left Side: Verdict */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-graphite-900 border border-graphite-700 shadow-md">
              <Activity className="w-5 h-5 text-graphite-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-graphite-400 uppercase tracking-widest mb-0.5">AI Analysis Result</h3>
              <div className="text-[10px] text-graphite-500 font-mono">{formatDate(prediction.created_at)}</div>
            </div>
          </div>
          
          <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
            isAbnormal ? "bg-amber-950/30 border-amber-900/50" : "bg-emerald-950/30 border-emerald-900/50"
          }`}>
            {isAbnormal ? (
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            <span className={`text-lg font-bold tracking-tight ${isAbnormal ? "text-amber-400" : "text-emerald-400"}`}>
              {isAbnormal ? "ACL Abnormality Detected" : "Normal ACL Architecture"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-graphite-900 border border-graphite-800 text-graphite-300">
              {isQuantum ? <Cpu className="w-3.5 h-3.5 text-quantum-400" /> : <Brain className="w-3.5 h-3.5 text-clinical-400" />}
              {prediction.model_name}
            </span>
            <span className="px-2.5 py-1 rounded bg-graphite-900 border border-graphite-800 text-graphite-300 font-mono">
              Conf: {formatPercent(prediction.confidence)}
            </span>
          </div>
        </div>

        {/* Right Side: Metrics & Action */}
        <div className="flex flex-col items-end justify-between gap-4 border-t sm:border-t-0 sm:border-l border-graphite-800 pt-4 sm:pt-0 sm:pl-6 min-w-[200px]">
          
          <div className="w-full space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-graphite-500 uppercase tracking-widest">p(Abnormal)</span>
              <span className="text-lg font-mono font-bold text-white">{formatPercent(prediction.abnormal_probability)}</span>
            </div>
            {/* Probability Bar */}
            <div className="w-full h-1.5 bg-graphite-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${isAbnormal ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${(prediction.abnormal_probability || 0) * 100}%` }}
              ></div>
            </div>
          </div>

          <Link
            to={`/predictions/${prediction.id}/explain`}
            className="w-full btn-primary text-xs mt-2 justify-between group"
          >
            Inspect Explainability
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>

        </div>
      </div>
    </div>
  );
}
