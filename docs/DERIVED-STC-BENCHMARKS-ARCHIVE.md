# Derived STC Benchmarks — Archive

**Removed:** March 2026
**Reason:** The practice-specific derived benchmarks consistently produced targets ~30-50% of the national flat-rate benchmarks (PCRS 2018). The percentage assumptions (e.g. "40% of HF patients need an ECG annually") lacked clinical guideline backing and compounded to create less accurate targets than the national averages. Decision was made to use national flat-rate benchmarks only.

## Original Function: `calculateDerivedSTCBenchmarks(panelSize, healthCheckData)`

Located in `src/utils/healthCheckCalculations.js`. This function used disease register counts, demographics, and STC-specific demographics to calculate practice-specific expected annual claim counts for certain STC codes.

### Inputs
- `panelSize` — Total GMS panel size
- `healthCheckData.diseaseRegisters` — heartFailure, atrialFibrillation, ihd, stroke, hypertension, asthma, copd
- `healthCheckData.demographics` — over70, under6
- `healthCheckData.stcDemographics` — gmsFemale17to35, gmsFemale36to44

### Per-Code Formulas

#### ECG (Code F)
```
rawTotal = (HF × 40%) + (AF × 50%) + (IHD × 25%) + (Stroke × 20%) + (HTN × 10%)
expected = rawTotal × 0.65  (35% comorbidity overlap discount)
```
Rationale: Per-condition annual ECG probability. NICE does not recommend serial ECGs for routine monitoring; these rates assumed symptom-driven/medication-change indications.

#### ABPM (Code AD)
```
expected = (hypertension × 15%) + (over-70s × 5%)
```
Rationale: Hypertension reassessment + elderly screening for white coat/masked hypertension.

#### Nebuliser (Code K)
```
expected = (asthma + COPD) × 5%
```
Rationale: Assumed 5% acute presentation rate requiring in-surgery nebuliser treatment.

#### Skin Excisions (Code A)
```
expected = (panelSize × 1.5%) + (over-70s × 2%)
```
Rationale: Base population rate plus higher rate for elderly (actinic keratoses, skin cancers).

#### Paediatric (Codes X, Y, Z)
```
X (Foreign body): under-6s × 0.5%
Y (Suturing):     under-6s × 1%
Z (Abscess):      under-6s × 0.4%
```
Rationale: Conservative GP-managed-only rates.

#### Contraception — Free Scheme (CF, CG, CH)
```
CF (Consultation): GMS females 17-35 × 20% annual uptake
CG (Implant):      GMS females 17-35 × 4%
CH (Coil):         GMS females 17-35 × 6%
```

#### Contraception — GMS/DVC Scheme (CL, CO, CM)
```
CL (Consultation): GMS females 36-44 × 10% annual uptake
CO (Implant):      GMS females 36-44 × 2%
CM (Coil):         GMS females 36-44 × 4%
```

### Why These Were Removed

1. **Systematic underestimation**: Derived targets were ~30-50% of national flat-rate benchmarks for the same codes, because the model only counted patients on formal disease registers and missed "background" STC activity (new presentations, pre-op, insurance medicals, unregistered patients).

2. **No guideline backing**: The specific percentages (40% HF ECG rate, 5% nebuliser rate, etc.) were clinical intuition, not derived from NICE, ICGP, or other published guidelines.

3. **Compounding assumptions**: ECG alone had 7 assumptions (5 condition rates + overlap factor + register-only assumption). Each introduces error that compounds multiplicatively.

4. **Misleading performance indicators**: A practice doing well nationally could show as "above target" under the derived model, giving a false green light and masking genuine growth opportunities.
