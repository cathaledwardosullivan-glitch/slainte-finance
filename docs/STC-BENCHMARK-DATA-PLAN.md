# STC Benchmark Data: Findings & Plan

## Goal
Replace estimated STC benchmarks with real national PCRS data to give practices credible "expected claims" targets.

## What We Have

### 2013 National Data (from PCRS Annual Report via IMT)
| Service | Total Claims | Per GP (~2,500) | Per 1000 GMS (~1.85M) |
|---------|-------------|-----------------|----------------------|
| Excisions (Code A) | 156,085 | ~62 | ~84 |
| ECG (Code F) | 137,726 | ~55 | ~74 |
| Flu vaccinations (SIS) | 372,694 | ~149 | ~201 |
| **All special services** | **926,105** | **~370** | **~500** |
| Remaining codes (B,K,L,etc.) | ~260,000 | ~104 | ~140 |

### 2019 Aggregate (from IMT)
- ~1.3M total special service claims
- ~€32M total expenditure
- ~2,609 GPs, ~2.28M GMS patients

### Current Benchmarks vs Reality
| Code | Service | Our Benchmark (per 1000) | 2013 National (per 1000) | Gap |
|------|---------|-------------------------|--------------------------|-----|
| A | Excisions | 25 | ~84 | **3.4x too low** |
| F | ECG | 55 | ~74 | Slightly low |
| B | Suturing | 12 | ? | Unknown |
| K | Nebuliser | 8 | ? | Unknown |
| L | Catheterisation | 5 | ? | Unknown |
| AD | ABPM | 25 | ? | Unknown (newer code) |
| CF-CQ | Contraception | 8-30 | ? | Unknown (post-2022 scheme) |
| X,Y,Z | Paediatric | 2-5 | ? | Unknown |

## What We're Missing

The full per-code STC breakdown is published in the PCRS Annual Report PDFs but is **not available** in any web-accessible format. Specifically:

### PCRS Annual Report Tables Needed
The report contains tables like "Payment to Doctors for Special Type Consultations" with per-code claim counts and expenditure. The most useful would be:

1. **2023 or 2024 report** — most current data including Free Contraception Scheme and CDM codes
2. **2019 report** — last pre-COVID year (avoids pandemic distortion)

### Key Data Points Needed Per Code
For each STC code (A, B, F, K, L, AD, AL, AM, CF, CG, CH, CI, CJ, CK, CL, CM, CN, CO, CQ, X, Y, Z, AB, AC):
- Total claims nationally
- Total expenditure
- (Ideally) number of GPs claiming each code

## How to Get This Data

### Option 1: PCRS Annual Report PDF (Recommended)
1. Download from: https://www.hse.ie/eng/staff/pcrs/pcrs-publications/
   - File: `hse-annual-report-2024.pdf` (or 2023)
2. Find the GP section — look for table titled "Special Type Consultations" or "Payment to Doctors for Special Type Consultations"
3. Extract the per-code claims and expenditure columns
4. Share the table (screenshot or typed values) and I'll calculate per-GP and per-1000 rates

### Option 2: PCRS Online Dashboard
1. Visit: https://www.sspcrs.ie/portal/annual-reporting/report/gp
2. The GP reports section has monthly and annual data
3. Look for the STC breakdown by code
4. Export or screenshot the relevant table

### Option 3: HSE Open Data Portal
1. Visit: https://data.ehealthireland.ie/dataset/primary-care-reimbursement-service-number-of-claims-by-general-practitioners
2. Download the CSV file(s)
3. Note: This may only have aggregate STC totals (not per-code), grouped by CHO area and month

### Option 4: Direct Request
- Email: PCRS.ReportQueries@hse.ie
- Request: Per-code STC claim volumes for 2023 or 2024

## What I'll Do With the Data

Once we have per-code national claim totals, I'll:

1. **Calculate per-1000 rates** using the 2024 GMS patient count (1,561,730)
2. **Calculate per-GP rates** using ~2,544 GMS GPs
3. **Update `gmsRates.js` benchmarks** with real national figures
4. **Set benchmark tier** — use perhaps 50-60% of national average as the "expected" rate (since distribution is skewed — some GPs do many more procedures than others)
5. **Update basis text** to cite "PCRS national data [year]" instead of vague estimates
6. **Adjust derived benchmarks** — the practice-specific derived calculations (from disease registers) would remain as Tier 1, with the national data as a more credible Tier 2 fallback

## Sources
- [IMT: PCRS 2013 breakdown](https://www.imt.ie/news/pcrs-payments-gps-continue-fall-20-04-2015/) — 156K excisions, 138K ECGs, 926K total
- [IMT: PCRS 2019 aggregate](https://www.imt.ie/news/pcrs-pays-3-billion-2019-primary-care-services-28-07-2020/) — 1.3M claims, €32M
- [CSO: GP Claims 2017-2021](https://www.cso.ie/en/releasesandpublications/ep/p-hftc/hsefundedprimarycaretreatmentsandclaims2017-2021/gpclaims/) — GP/patient counts
- [HSE: PCRS Publications](https://www.hse.ie/eng/staff/pcrs/pcrs-publications/) — PDF annual reports
- [PCRS Dashboard](https://www.sspcrs.ie/portal/annual-reporting/report/gp) — Online GP reports
- [HSE Open Data](https://data.ehealthireland.ie/dataset/primary-care-reimbursement-service-number-of-claims-by-general-practitioners) — CSV data
- [Gov.ie: Free Contraception Scheme](https://www.gov.ie/en/press-release/60f91-minister-for-health-announces-strong-uptake-of-the-expanded-free-contraception-scheme-in-2024/) — ~245K women accessing (Jan-Sept 2024)
