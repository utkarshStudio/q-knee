import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { ArrowRight, Activity, BrainCircuit, Scan, Cpu, ShieldCheck, Database } from "lucide-react";

export default function LandingPage({ defaultSection }: { defaultSection?: "technology" | "research" | "about" }) {
  useEffect(() => {
    if (defaultSection) {
      const el = document.getElementById(defaultSection);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [defaultSection]);

  return (
    <div className="min-h-screen bg-graphite-950 text-graphite-50 font-sans selection:bg-clinical-500/30 selection:text-clinical-100">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Cinematic Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-graphite-950/40 via-graphite-950/80 to-graphite-950 z-10"></div>
          {/* Abstract medical imaging texture / grid */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-luminosity"></div>
          
          {/* Subtle quantum/tech overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-50 z-10"></div>
          <div className="scan-line z-10"></div>
          
          {/* Glowing orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-clinical-600/10 rounded-full blur-[100px] z-10"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-deepblue-600/10 rounded-full blur-[120px] z-10"></div>
        </div>

        <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-graphite-900/80 border border-clinical-500/30 text-clinical-400 text-xs font-mono tracking-wide uppercase mb-8 backdrop-blur-sm shadow-[0_0_15px_rgba(45,212,191,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-clinical-500 animate-pulse"></span>
            Public Research Prototype — No Login Required
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            AI-Assisted <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-clinical-400 to-deepblue-400">
              Knee MRI Analysis
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-graphite-300 max-w-2xl mb-10 font-medium leading-relaxed">
            From raw MRI imaging to hybrid quantum intelligence. <br className="hidden md:block"/>
            Advanced feature extraction combined with variational quantum circuits for anterior cruciate ligament diagnostics.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link 
              to="/upload" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-clinical-600 hover:bg-clinical-500 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-clinical-900/50 border border-clinical-500/50 group"
            >
              Analyze MRI
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#technology" 
              className="w-full sm:w-auto inline-flex items-center justify-center bg-graphite-800/80 hover:bg-graphite-700/80 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all border border-graphite-700 backdrop-blur-sm"
            >
              Explore Technology
            </a>
          </div>
        </div>
      </section>

      {/* Trust / Intro Section */}
      <section id="technology" className="py-24 bg-graphite-950 border-t border-graphite-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Medical imaging meets quantum intelligence</h2>
            <p className="text-graphite-300 text-lg">
              Q-Knee is an experimental research platform investigating the potential of hybrid quantum-classical machine learning architectures for complex medical image analysis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-8 bg-graphite-900/50 border-graphite-800">
              <div className="w-12 h-12 bg-deepblue-950/50 border border-deepblue-800/50 rounded-xl flex items-center justify-center mb-6">
                <Scan className="w-6 h-6 text-deepblue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">DICOM & NPY Support</h3>
              <p className="text-graphite-400">
                Directly upload and parse standard medical imaging formats with automated slice extraction and intensity normalization.
              </p>
            </div>
            <div className="card p-8 bg-graphite-900/50 border-graphite-800">
              <div className="w-12 h-12 bg-quantum-900/30 border border-quantum-700/50 rounded-xl flex items-center justify-center mb-6">
                <Cpu className="w-6 h-6 text-quantum-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Hybrid Architecture</h3>
              <p className="text-graphite-400">
                ResNet18 classical feature extraction bottlenecks into a 4-qubit parameterized variational quantum circuit for final classification.
              </p>
            </div>
            <div className="card p-8 bg-graphite-900/50 border-graphite-800">
              <div className="w-12 h-12 bg-amber-950/30 border border-amber-800/50 rounded-xl flex items-center justify-center mb-6">
                <BrainCircuit className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Explainability (Grad-CAM)</h3>
              <p className="text-graphite-400">
                Generate Class Activation Maps to visually interpret which regions of the MRI slice contributed most to the model's prediction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Pipeline / Research */}
      <section id="research" className="py-24 bg-graphite-900 border-t border-graphite-800 relative overflow-hidden">
        <div id="pipeline" className="absolute top-0"></div>
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">From MRI to Quantum Prediction</h2>
            <p className="text-graphite-300 text-lg max-w-2xl">
              The processing pipeline orchestrates data transformation from a raw 3D volume down to a single quantum state measurement.
            </p>
          </div>

          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-graphite-700 before:to-transparent">
            {/* Step 1 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-graphite-900 bg-clinical-600 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                1
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl bg-graphite-800 border border-graphite-700 shadow-xl ml-4 md:ml-0">
                <h3 className="font-bold text-white text-lg mb-1">MRI Acquisition</h3>
                <p className="text-graphite-400 text-sm">Upload standard clinical DICOM series or NPY arrays. The system parses the volumetric data and identifies anatomical planes.</p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-graphite-900 bg-graphite-800 text-graphite-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                2
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl bg-graphite-800/50 border border-graphite-700/50 ml-4 md:ml-0">
                <h3 className="font-bold text-white text-lg mb-1">Image Normalization</h3>
                <p className="text-graphite-400 text-sm">Slices are extracted, resized, and pixel intensities are normalized to standard ranges expected by the neural network.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-graphite-900 bg-graphite-800 text-graphite-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                3
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl bg-graphite-800/50 border border-graphite-700/50 ml-4 md:ml-0">
                <h3 className="font-bold text-white text-lg mb-1">ResNet18 Feature Extraction</h3>
                <p className="text-graphite-400 text-sm">A pre-trained classical ResNet18 model acts as a feature extractor, transforming the 2D image into a high-dimensional feature vector.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-graphite-900 bg-graphite-800 text-graphite-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                4
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl bg-graphite-800/50 border border-graphite-700/50 ml-4 md:ml-0">
                <h3 className="font-bold text-white text-lg mb-1">Quantum Circuit Prediction</h3>
                <p className="text-graphite-400 text-sm">Features are compressed via PCA and encoded into a 4-qubit variational quantum circuit. Pauli-Z measurements produce the final abnormality probability.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-graphite-950 border-t border-graphite-800 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-white mb-3">About Q-Knee Platform</h2>
          <p className="text-graphite-400 text-sm leading-relaxed mb-6">
            Q-Knee is a research-grade demonstrator uniting computer vision and variational quantum circuits (VQC). 
            Access is open for researchers, clinicians, and engineers to evaluate classical vs. quantum knee MRI inference in real time without barriers.
          </p>
          <Link to="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            Analyze Knee MRI Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-graphite-950 border-t border-graphite-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-graphite-500" />
            <span className="font-bold text-graphite-300 tracking-wide text-sm">Q-KNEE</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-graphite-900 border border-graphite-800 text-graphite-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            AI-assisted analysis — not a medical diagnosis.
          </div>
        </div>
      </footer>
    </div>
  );
}
