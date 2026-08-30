import { useState, useEffect, useCallback } from "react";

interface MriViewerProps {
  studyId?: string;
  predictionId?: string;
  totalSlices?: number;
  currentSlice?: number;
  onSliceChange?: (sliceIndex: number) => void;
  originalImageUrl?: string;
  heatmapImageUrl?: string;
  overlayImageUrl?: string;
  has3dVolume?: boolean;
  activePlane?: "sagittal" | "axial" | "coronal";
  onPlaneChange?: (plane: "sagittal" | "axial" | "coronal") => void;
  isLoading?: boolean;
}

export function MriViewer({
  totalSlices = 8,
  currentSlice = 0,
  onSliceChange,
  originalImageUrl,
  heatmapImageUrl,
  overlayImageUrl,
  has3dVolume = false,
  activePlane = "sagittal",
  onPlaneChange,
  isLoading = false,
}: MriViewerProps) {
  const [viewMode, setViewMode] = useState<"original" | "heatmap" | "overlay">("overlay");
  const [sliceIndex, setSliceIndex] = useState(currentSlice);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  useEffect(() => {
    setSliceIndex(currentSlice);
  }, [currentSlice]);

  const handleSliceChange = useCallback(
    (newIndex: number) => {
      const clamped = Math.max(0, Math.min(totalSlices - 1, newIndex));
      setSliceIndex(clamped);
      if (onSliceChange) onSliceChange(clamped);
    },
    [totalSlices, onSliceChange]
  );

  // Keyboard navigation for slice stepping
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        handleSliceChange(sliceIndex - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        handleSliceChange(sliceIndex + 1);
      }
    },
    [sliceIndex, handleSliceChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeImageUrl =
    viewMode === "original"
      ? originalImageUrl
      : viewMode === "heatmap"
      ? heatmapImageUrl || originalImageUrl
      : overlayImageUrl || originalImageUrl;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex flex-col">
      {/* Viewer Header / Toolbar */}
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">MRI Viewport</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Slice {sliceIndex + 1} / {totalSlices}
          </span>
        </div>

        {/* Anatomical Plane Selection */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => onPlaneChange && onPlaneChange("sagittal")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activePlane === "sagittal"
                ? "bg-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Sagittal View (Standard knee ACL evaluation plane)"
          >
            Sagittal
          </button>
          <button
            type="button"
            disabled={!has3dVolume}
            onClick={() => has3dVolume && onPlaneChange && onPlaneChange("axial")}
            className={`px-3 py-1 rounded-md transition-colors ${
              !has3dVolume
                ? "text-slate-600 cursor-not-allowed"
                : activePlane === "axial"
                ? "bg-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title={has3dVolume ? "Axial Plane" : "Axial reconstruction disabled for 2D single-series"}
          >
            Axial {!has3dVolume && "(2D)"}
          </button>
          <button
            type="button"
            disabled={!has3dVolume}
            onClick={() => has3dVolume && onPlaneChange && onPlaneChange("coronal")}
            className={`px-3 py-1 rounded-md transition-colors ${
              !has3dVolume
                ? "text-slate-600 cursor-not-allowed"
                : activePlane === "coronal"
                ? "bg-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title={has3dVolume ? "Coronal Plane" : "Coronal reconstruction disabled for 2D single-series"}
          >
            Coronal {!has3dVolume && "(2D)"}
          </button>
        </div>

        {/* Layer / CAM Toggle */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("original")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "original" ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => setViewMode("heatmap")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "heatmap" ? "bg-amber-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Heatmap
          </button>
          <button
            type="button"
            onClick={() => setViewMode("overlay")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "overlay" ? "bg-blue-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Overlay (CAM)
          </button>
        </div>
      </div>

      {/* Main Image Display */}
      <div className="relative aspect-square max-h-[460px] bg-black flex items-center justify-center overflow-hidden select-none">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            <span className="text-xs text-slate-400">Loading Slice &amp; Grad-CAM...</span>
          </div>
        ) : activeImageUrl ? (
          <img
            src={activeImageUrl}
            alt={`MRI Slice ${sliceIndex + 1} - ${viewMode}`}
            className="w-full h-full object-contain transition-all duration-150"
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-slate-500">
            <svg className="w-12 h-12 stroke-current opacity-30" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
            </svg>
            <p className="text-sm font-medium">No MRI image slice loaded</p>
            <p className="text-xs text-slate-600">Upload a study or select a representative slice</p>
          </div>
        )}

        {/* Viewport HUD Overlays */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 pointer-events-none">
          Plane: {activePlane.toUpperCase()} | Mode: {viewMode.toUpperCase()}
        </div>
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 pointer-events-none">
          Slice: {sliceIndex + 1}/{totalSlices} (Use &#8592; / &#8594; keys)
        </div>
      </div>

      {/* Slice Navigation & Window Controls */}
      <div className="bg-slate-950 p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleSliceChange(sliceIndex - 1)}
            disabled={sliceIndex <= 0}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition-colors"
          >
            &#9664; Prev
          </button>

          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, totalSlices - 1)}
              value={sliceIndex}
              onChange={(e) => handleSliceChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSliceChange(sliceIndex + 1)}
            disabled={sliceIndex >= totalSlices - 1}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition-colors"
          >
            Next &#9654;
          </button>
        </div>

        {/* Quick Window Level Adjustments */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
          <div className="flex items-center gap-3">
            <span>Brightness: {brightness}%</span>
            <input
              type="range"
              min={50}
              max={150}
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              className="w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <span>Contrast: {contrast}%</span>
            <input
              type="range"
              min={50}
              max={150}
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value))}
              className="w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-400"
            />
            <button
              type="button"
              onClick={() => {
                setBrightness(100);
                setContrast(100);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline ml-1"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
