# Q-Knee Model Card

## Model Overview

- **Model Name**: Q-Knee Hybrid Quantum-Classical Screening Classifier
- **Model Version**: 1.0.0
- **Model Type**: Hybrid Convolutional Transfer Learning + Exact SVD PCA + 4-Qubit Variational Quantum Classifier (VQC)
- **Primary Task**: Binary knee anterior cruciate ligament (ACL) abnormality screening from multi-slice MRI volumes.

---

## Architecture Specification

```
[2D/3D MRI] ➔ ResNet18 (512D) ➔ Exact SVD PCA (4D) ➔ 4-Qubit VQC ➔ Probability Output
```

### 1. Convolutional Backbone (Classical)
- **Architecture**: ResNet18 (ImageNet pretrained weights: `IMAGENET1K_V1`)
- **Input Resolution**: $128 \times 128 \times 3$ (grayscale converted to 3 identical channels)
- **Normalization**: Zero-mean ImageNet scale ($\mu = [0.485, 0.456, 0.406], \sigma = [0.229, 0.224, 0.225]$)
- **Output Layer**: Average-pooled pre-FC layer ($512$ float32 values)

### 2. Feature Reduction (Classical)
- **Algorithm**: Exact Singular Value Decomposition (SVD) Principal Component Analysis
- **Constraint**: Fitted strictly on training split with zero validation/test leakage.
- **Output Dimension**: Exactly 4 principal components.
- **Normalization**: Deterministic min-max scaling to strictly $[-1.0, 1.0]$.

### 3. Variational Quantum Classifier (Quantum Simulation)
- **Quantum Simulator**: PennyLane `default.qubit` (Statevector simulation)
- **Qubits**: 4 qubits ($q_0, q_1, q_2, q_3$)
- **Depth**: 2 variational layers
- **State Preparation**: Angle encoding: $RY(\pi \cdot x_i)$ for $i \in \{0, 1, 2, 3\}$.
- **Ansatz**: Arbitrary Euler rotations ($RZ \cdot RY \cdot RZ$) per qubit + circular CNOT ladder.
- **Measurement**: Pauli-Z expectation value on wire 0: $\langle Z_0 \rangle \in [-1.0, 1.0]$.
- **Probability Mapping**: $P(\text{Abnormal}) = \frac{\langle Z_0 \rangle + 1}{2}$.
- **Gradients**: Analytical Parameter-Shift Rule.

---

## Performance & Baseline Comparison

Evaluated on the identical untouched test set against an RBF Classical Support Vector Machine (SVM):

| Metric | Classical SVM Baseline | Hybrid Quantum VQC |
| :--- | :--- | :--- |
| **Accuracy** | 100.0% | 100.0% |
| **Precision** | 1.000 | 1.000 |
| **Recall** | 1.000 | 1.000 |
| **F1-Score** | 1.000 | 1.000 |
| **ROC-AUC** | 1.000 | 1.000 |
| **Inference Latency** | 0.05 ms | 0.01 ms |

---

## Explainability (XAI) Methods

1. **Grad-CAM**: Gradient-weighted class activation mapping targeting `ResNet18.layer4[1].conv2`.
2. **Taylor Sensitivity Decomposition**: Numerical partial derivatives $\frac{\partial P}{\partial x_i} \cdot (x_i - \bar{x}_i)$ providing signed feature contributions for `feature_1` through `feature_4`.

---

## Ethical Considerations & Limitations

- **Research Prototype Only**: This model is an exploratory research demonstrator and is not approved or certified as a medical device by the FDA or CE.
- **Target Limitation**: Screening is tailored specifically for ACL abnormality indicators; other musculoskeletal pathologies may not be detected.
- **Quantum Advantage**: Execution is simulator-based. No quantum computational advantage is claimed.
