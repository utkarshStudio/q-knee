# Q-Knee: 2-Minute Live Hackathon Demonstration Script

**Project**: Q-Knee Diagnostic Platform  
**Target Duration**: Exactly 120 seconds (2:00)  
**Presenter Role**: Technical Lead / AI Architect  
**Key Rule**: Speak clearly, keep transitions brisk, and point directly to visual elements on screen.

---

## ⏱️ Live Demonstration Timeline & Speaking Script

```
0:00 ─── [ Problem & Introduction ] ──────── 0:15
0:15 ─── [ MRI Ingestion & Upload ] ──────── 0:30
0:30 ─── [ Preprocessing & ResNet18 ] ────── 0:50
0:50 ─── [ 512D -> 4D PCA Compression ] ─── 1:10
1:10 ─── [ 4-Qubit Variational Quantum ] ─── 1:30
1:30 ─── [ Risk Score & Decision ] ───────── 1:45
1:45 ─── [ Grad-CAM & Feature XAI ] ──────── 1:55
1:55 ─── [ Benchmark & Conclusion ] ──────── 2:00
```

---

### [0:00 – 0:15] Problem & Project Introduction
- **Visual**: Open browser on Dashboard (`http://localhost:5173`) showing clean metrics cards and platform banner.
- **Presenter Speaking**:
  > *"Judges, knee MRI scans contain hundreds of complex slices. Radiologists spend hours screening for ACL tears, while classical deep learning models remain untrustworthy black boxes. We built **Q-Knee**—a hybrid classical-quantum medical screening platform that combines ResNet transfer learning, exact SVD PCA compression, a 4-qubit Variational Quantum Classifier, and dual-layer explainability."*

---

### [0:15 – 0:30] Upload Knee MRI
- **Visual**: Click **Upload Study** in sidebar. Drag and drop `volume.npy` (or select `data/sample_mri_dataset/train_series/study_001/volume.npy`).
- **Presenter Speaking**:
  > *"Let's upload a real multi-slice knee MRI study. Q-Knee supports both raw DICOM folders and 3D NumPy volumes. As we click 'Process & Screen', the Python microservice acts as our single source of truth—validating slice geometry and window leveling in under 1 millisecond."*

---

### [0:30 – 0:50] Preprocessing & ResNet18 Spatial Extraction
- **Visual**: Preprocessing progress stepper animates (`Ingesting` $\to$ `Parsing` $\to$ `Preprocessing` $\to$ `ResNet18`). View navigates to Study Detail View showing the interactive **MriViewer**.
- **Presenter Speaking**:
  > *"Here is our interactive MRI viewport. Notice we can scroll through sagittal slices and adjust window leveling in real time. Under the hood, a pretrained ResNet18 backbone extracts rich spatial representations from representative slices, pooling them into a 512-dimensional study-level feature vector."*

---

### [0:50 – 1:10] 512D $\to$ 4D Latent Compression
- **Visual**: Point to the **Model Architecture Card** in the right panel showing: `512D Embeddings ➔ Exact SVD PCA ➔ 4 Quantum Features`.
- **Presenter Speaking**:
  > *"NISQ-era quantum hardware requires compact feature spaces. Q-Knee uses an exact SVD Principal Component Analysis—fitted strictly on training data with zero patient leakage—to compress 512 deep embeddings down to exactly 4 principal components, normalized deterministically to $[-1.0, 1.0]$."*

---

### [1:10 – 1:30] 4-Qubit Variational Quantum Classifier (VQC)
- **Visual**: Point to the Quantum Circuit summary badge showing `4 Qubits | Angle RY(πx) | Circular CNOT | PennyLane default.qubit`.
- **Presenter Speaking**:
  > *"Those 4 features are mapped into quantum states using angle $RY$ encoding across 4 qubits. We apply a 2-layer parameterized rotational ansatz with circular CNOT entanglement and measure the Pauli-Z expectation value on qubit 0. The circuit trains with analytical parameter-shift gradients on our PennyLane statevector simulator."*

---

### [1:30 – 1:45] Risk Score & AI-Assisted Screening Result
- **Visual**: Highlight the **AI-Assisted Screening Result Card** showing `Predicted Class: Abnormal`, `p(Abnormal): 88.4%`, `Confidence: High`, and the prominent medical disclaimer.
- **Presenter Speaking**:
  > *"The quantum expectation value directly yields our calibrated risk assessment: an 88.4% probability of ACL abnormality. Notice our system is strictly labeled as an 'AI-assisted screening result' alongside mandatory clinical safety disclaimers."*

---

### [1:45 – 1:55] Explainability: Grad-CAM & 4D Feature Attribution
- **Visual**: Click **View Explainability (XAI)** tab. Toggle `Overlay (50%)` to reveal the Jet heatmap highlighting the joint space. Point to the signed feature attribution bars below ($+0.142$ pushing Abnormal, $-0.083$ pushing Normal).
- **Presenter Speaking**:
  > *"Crucially, Q-Knee explains why: Level 1 provides convolutional Grad-CAM showing exact anatomical attention at the joint capsule. Level 2 decomposes the quantum decision into signed Taylor sensitivities, proving which principal components drove the abnormal classification."*

---

### [1:55 – 2:00] Benchmarking & Conclusion
- **Visual**: Switch to **Model Benchmarks** page showing vector SVG ROC Curves and the Classical SVM vs Hybrid VQC comparison table.
- **Presenter Speaking**:
  > *"Finally, our empirical benchmark evaluates both Classical SVM and Quantum VQC on the exact same untouched test split. Q-Knee bridges clinical imaging, quantum machine learning, and transparent explainability. Thank you!"*

---

## 🔬 Mode Distinction: Live Inference vs Cached Demo

| Parameter | Live Inference Mode | Cached Demo Fallback |
| :--- | :--- | :--- |
| **Execution Trigger** | Real-time forward pass via PyTorch & PennyLane | Instant retrieval of pre-screened verification study |
| **Telemetry Badge** | `● LIVE INFERENCE (PyTorch + PennyLane)` | `● CACHED DEMONSTRATION RECORD` |
| **Latency** | $106\text{ ms}$ | $< 5\text{ ms}$ |
| **Usage Scenario** | Standard live demonstration with local ML microservice | Fallback if offline / cloud network latency constrained |
