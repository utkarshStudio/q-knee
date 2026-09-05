import { useState, useEffect, useCallback } from "react";
import { resolveImageUrl } from "../../lib/utils";
import { Maximize, RotateCcw, ZoomIn, ZoomOut, Eye, Settings2, SlidersHorizontal, Image as ImageIcon, XCircle } from "lucide-react";

interface MriViewerProps {
  studyId?: string | number;
  predictionId?: string | number;
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
  totalSlices = 1,
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
  const effectiveTotal = Math.max(1, totalSlices);
  const [sliceIndex, setSliceIndex] = useState(Math.max(0, Math.min(effectiveTotal - 1, currentSlice)));
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [viewMode, setViewMode] = useState<"original" | "heatmap" | "overlay">(
    overlayImageUrl ? "overlay" : "original"
  );
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(effectiveTotal - 1, currentSlice));
    setSliceIndex(clamped);
  }, [currentSlice, effectiveTotal]);

  useEffect(() => {
    if (overlayImageUrl && viewMode === "original") {
      setViewMode("overlay");
    }
  }, [overlayImageUrl]);

  useEffect(() => {
    setImageLoadError(false);
  }, [originalImageUrl, heatmapImageUrl, overlayImageUrl, sliceIndex, viewMode]);

  const handleSliceChange = useCallback(
    (newIndex: number) => {
      const clamped = Math.max(0, Math.min(effectiveTotal - 1, newIndex));
      setSliceIndex(clamped);
      if (onSliceChange) onSliceChange(clamped);
    },
    [effectiveTotal, onSliceChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (effectiveTotal <= 1) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handleSliceChange(sliceIndex - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        handleSliceChange(sliceIndex + 1);
      }
    },
    [sliceIndex, effectiveTotal, handleSliceChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const hasCam = Boolean(
    viewMode === "heatmap" ? heatmapImageUrl : viewMode === "overlay" ? overlayImageUrl : false
  );

  const rawActiveUrl =
    viewMode === "original"
      ? originalImageUrl
      : viewMode === "heatmap"
      ? heatmapImageUrl || originalImageUrl
      : overlayImageUrl || originalImageUrl;

  const activeImageUrl = resolveImageUrl(rawActiveUrl);

  return (
    <div className={`bg-bg-base text-text-primary rounded-2xl overflow-hidden shadow-2xl border border-border-subtle flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50' : 'relative'}`}>
      
      {/* Viewer Header / Toolbar */}
      <div className="bg-bg-panel px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-4 select-none">
        
        {/* Left: Status & Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-bg-base border border-border-subtle">
            <span className="w-2 h-2 rounded-full bg-clinical-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary font-mono">Workspace</span>
          </div>
          
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-text-muted">
            <span>Slice</span>
            <span className="text-white bg-bg-card px-1.5 py-0.5 rounded ml-1">{sliceIndex + 1}</span>
            <span className="mx-1">/</span>
            <span>{effectiveTotal}</span>
          </div>
        </div>

        {/* Center: Anatomical Planes */}
        <div className="flex items-center bg-bg-base rounded-lg p-1 border border-border-subtle">
          {(["axial", "coronal", "sagittal"] as const).map((plane) => (
            <button
              key={plane}
              type="button"
              disabled={!has3dVolume && plane !== "sagittal"} // Assuming sagittal is default 2D
              onClick={() => onPlaneChange && onPlaneChange(plane)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider transition-all duration-200 ${
                activePlane === plane
                  ? "bg-clinical-600 text-white shadow-md shadow-clinical-900/50"
                  : !has3dVolume && plane !== "sagittal"
                  ? "text-text-disabled opacity-50 cursor-not-allowed"
                  : "text-text-muted hover:text-white hover:bg-bg-card"
              }`}
            >
              {plane}
            </button>
          ))}
        </div>

        {/* Right: View Modes & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-bg-base rounded-lg p-1 border border-border-subtle">
            <button
              type="button"
              onClick={() => setViewMode("original")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                viewMode === "original" ? "bg-bg-active text-white" : "text-text-muted hover:text-white"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Original
            </button>
            <button
              type="button"
              onClick={() => setViewMode("heatmap")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                viewMode === "heatmap" ? "bg-amber-700 text-white" : "text-text-muted hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Heatmap
            </button>
            <button
              type="button"
              onClick={() => setViewMode("overlay")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                viewMode === "overlay" ? "bg-deepblue-600 text-white" : "text-text-muted hover:text-white"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" /> Overlay
            </button>
          </div>
          
          <div className="w-px h-6 bg-bg-card"></div>
          
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-text-muted hover:text-white hover:bg-bg-card rounded-md transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[400px]">
        {/* Subtle background grid for empty/loading states */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-border-subtle"></div>
              <div className="absolute inset-0 rounded-full border-t-2 border-clinical-500 animate-spin"></div>
            </div>
            <span className="text-xs font-mono text-clinical-400 tracking-widest uppercase">Loading Volume Data</span>
          </div>
        ) : activeImageUrl && !imageLoadError ? (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={activeImageUrl}
              alt={`MRI Slice ${sliceIndex + 1}`}
              onError={() => setImageLoadError(true)}
              className="max-w-full max-h-full object-contain transition-opacity duration-300 select-none drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]"
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
              }}
              draggable={false}
            />

            {/* Warning overlay if CAM requested but unavailable */}
            {(viewMode === "heatmap" || viewMode === "overlay") && !hasCam && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-bg-base/80 border border-amber-500/30 px-4 py-2 rounded-lg backdrop-blur-md text-center max-w-[90%] shadow-2xl flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs text-text-secondary">
                  <span className="text-amber-400 font-semibold mr-1">Explainability Unavailable.</span>
                  Showing original slice. Run inference to generate maps.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center z-10">
            {imageLoadError ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-900 flex items-center justify-center text-red-500 mb-2">
                  <XCircle className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white">Preview Unavailable</p>
                <p className="text-xs text-text-muted max-w-xs">Data stream interrupted. Please re-upload or check connection.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full border border-border-subtle flex items-center justify-center mb-2 bg-bg-base">
                  <ImageIcon className="w-6 h-6 text-text-disabled" />
                </div>
                <p className="text-sm font-medium text-text-secondary">No Volumetric Data</p>
              </>
            )}
          </div>
        )}

        {/* HUD Elements */}
        <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-text-secondary border border-white/5">
            PLN: <span className="text-white">{activePlane.toUpperCase()}</span>
          </div>
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-text-secondary border border-white/5">
            MOD: <span className="text-white">{viewMode.toUpperCase()}</span>
          </div>
        </div>
        
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-text-secondary border border-white/5 pointer-events-none">
          IDX: <span className="text-white">{sliceIndex + 1}</span> / {effectiveTotal}
        </div>
        
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-text-secondary border border-white/5 pointer-events-none">
          W/L: <span className="text-white">{brightness}% / {contrast}%</span>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-bg-panel px-6 py-4 border-t border-border-subtle">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          
          {/* Slice Scrubber */}
          <div className="flex-1 w-full flex items-center gap-4">
            <span className="text-[10px] font-mono text-text-muted w-8">Slice</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, effectiveTotal - 1)}
              value={sliceIndex}
              disabled={effectiveTotal <= 1}
              onChange={(e) => handleSliceChange(parseInt(e.target.value, 10))}
              className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all ${
                effectiveTotal <= 1 ? "bg-bg-card opacity-50" : "bg-bg-active hover:bg-border-hover"
              }`}
              style={{
                background: effectiveTotal > 1 
                  ? `linear-gradient(to right, var(--color-clinical-500) ${(sliceIndex / Math.max(1, effectiveTotal - 1)) * 100}%, var(--color-graphite-700) ${(sliceIndex / Math.max(1, effectiveTotal - 1)) * 100}%)`
                  : undefined
              }}
            />
          </div>

          {/* Windowing Tools */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 group relative">
              <SlidersHorizontal className="w-4 h-4 text-text-muted" />
              <input
                type="range"
                min={50} max={150}
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-20 h-1 bg-bg-card rounded appearance-none cursor-pointer"
                title="Brightness"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white to-black border border-border-strong"></div>
              <input
                type="range"
                min={50} max={150}
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                className="w-20 h-1 bg-bg-card rounded appearance-none cursor-pointer"
                title="Contrast"
              />
            </div>
            
            <button
              onClick={() => { setBrightness(100); setContrast(100); }}
              className="p-1.5 text-text-muted hover:text-white rounded-md hover:bg-bg-card transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
