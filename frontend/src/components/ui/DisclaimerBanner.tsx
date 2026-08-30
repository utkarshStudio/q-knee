export function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <svg className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zm-1 4.5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
      </svg>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-amber-900">
          AI-Assisted Screening Research Demonstration
        </p>
        <p className="text-xs text-amber-800 leading-relaxed">
          This system is a research prototype for AI-assisted MRI screening and is not a substitute for professional medical diagnosis. Results and visual attention maps must not be used as clinical ground truth.
        </p>
      </div>
    </div>
  );
}