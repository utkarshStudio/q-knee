import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";

const ALLOWED_EXTENSIONS = [".dcm", ".dicom", ".npy", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE_MB = 100;

export default function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const steps = [
    { title: "Upload Files", desc: "Transmitting study data to server" },
    { title: "Volume Parsing", desc: "Reading DICOM/NPY metadata & slice ordering" },
    { title: "Preprocessing", desc: "128x128 spatial resizing & intensity normalization" },
    { title: "Feature Extraction", desc: "Generating ResNet18 512D study embeddings" },
  ];

  const validateFiles = (newFiles: File[]): { valid: File[]; errorMsg?: string } => {
    const valid: File[] = [];
    for (const f of newFiles) {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: [], errorMsg: `Unsupported file type: ${f.name}. Please upload DICOM (.dcm), NPY (.npy), or PNG/JPEG.` };
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        return { valid: [], errorMsg: `File ${f.name} exceeds max size of ${MAX_FILE_SIZE_MB}MB.` };
      }
      valid.push(f);
    }
    return { valid };
  };

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    setError("");
    const droppedFiles = Array.from(e.dataTransfer.files);
    const { valid, errorMsg } = validateFiles(droppedFiles);
    if (errorMsg) {
      setError(errorMsg);
    } else {
      setFiles((prev) => [...prev, ...valid]);
    }
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setError("");
      const selectedFiles = Array.from(e.target.files);
      const { valid, errorMsg } = validateFiles(selectedFiles);
      if (errorMsg) {
        setError(errorMsg);
      } else {
        setFiles((prev) => [...prev, ...valid]);
      }
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!files.length) {
      setError("Please select at least one valid MRI file (DICOM, NPY, or Image).");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    setCurrentStep(0);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      // Simulate step progression for responsive UX
      const timer1 = setTimeout(() => setCurrentStep(1), 400);
      const timer2 = setTimeout(() => setCurrentStep(2), 900);
      const timer3 = setTimeout(() => setCurrentStep(3), 1400);

      const res = await api.post("/api/studies/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setCurrentStep(4);

      setSuccess("Study uploaded and preprocessed successfully! Directing to analysis view...");
      setTimeout(() => navigate("/studies/" + res.data.study.id), 1200);
    } catch (err: any) {
      const userMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Upload failed. Please ensure the backend and ML microservice are operational.";
      setError(userMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upload MRI Study</h1>
          <p className="text-slate-500 text-sm mt-1">
            Clinical-research workflow: Upload knee MRI volumes in DICOM (.dcm), NPY (.npy), or standard image formats.
          </p>
        </div>

        <DisclaimerBanner />

        {/* Upload Dropzone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`card p-10 text-center border-2 border-dashed transition-all cursor-pointer ${
            dragging
              ? "border-blue-500 bg-blue-50/70"
              : "border-slate-300 hover:border-blue-400 bg-white"
          }`}
        >
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-slate-800 font-semibold text-base">Drag and drop MRI files here</p>
          <p className="text-slate-400 text-xs mt-1">
            Supported formats: DICOM series (<code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">.dcm</code>), 3D NumPy Volumes (<code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">.npy</code>), PNG, JPEG
          </p>
          <label className="mt-5 btn-primary inline-flex items-center gap-2 cursor-pointer text-xs">
            <span>Browse Files</span>
            <input
              type="file"
              multiple
              accept=".dcm,.dicom,.npy,.png,.jpg,.jpeg,image/*"
              onChange={onFileChange}
              className="sr-only"
            />
          </label>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="card p-5 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-sm">
                Selected Series ({files.length} {files.length === 1 ? "file" : "files"})
              </h3>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-xs text-red-500 hover:underline"
              >
                Clear all
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-slate-400">#{i + 1}</span>
                    <span className="font-medium text-slate-800 truncate">{f.name}</span>
                    <span className="text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-slate-400 hover:text-red-500 ml-2"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Stepper if Uploading */}
        {uploading && (
          <div className="card p-6 bg-slate-50 border border-blue-200 space-y-4">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span>Automated Ingestion &amp; Feature Extraction Pipeline</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    idx < currentStep
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : idx === currentStep
                      ? "bg-blue-50 border-blue-400 text-blue-900 shadow-sm"
                      : "bg-white border-slate-200 text-slate-400"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{idx < currentStep ? "✓" : `${idx + 1}.`}</span>
                    <span>{step.title}</span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-80">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
            <span className="font-bold">Success:</span> {success}
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/studies")}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !files.length}
            className="btn-primary text-xs"
          >
            {uploading ? "Ingesting & Extracting Features..." : "Upload & Preprocess Study"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}