# Phase 2: Comparative Data Sharing Between Slainte Finance Users

## Overview

Build an opt-in system allowing Slainte Finance practices to anonymously share aggregated STC claim rates, enabling peer benchmarks that are far more accurate than national averages or derived estimates.

## Why This Matters

- Phase 1 derived benchmarks (disease registers, demographics) are practice-specific but still rely on assumed uptake percentages (e.g. "20% of eligible women will have contraception consults")
- National PCRS data is old (2018) and averages across all practice types/sizes
- Real comparative data from similar practices would provide the most accurate benchmarks

## Architecture

### Data Flow

```
Practice A (Electron)                     Slainte API
  ├── Opt-in consent ──────────────────► POST /api/benchmarks/contribute
  │   (Settings toggle)                    ├── Validate JWT license
  │                                        ├── Strip all identifiers
  ├── Aggregated snapshot ─────────────►   ├── Store anonymous record
  │   {                                    │
  │     panelSize: 2100,                   │   { id: uuid,
  │     region: "South",                   │     panelBand: "2000-2500",
  │     stcRates: {                        │     region: "South",
  │       F: 45.2,  // per 1000            │     stcRates: {...},
  │       A: 22.1,                         │     timestamp }
  │       CF: 28.5,                        │
  │       ...                              └── GET /api/benchmarks/aggregate
  │     },                                      ├── Median, P25, P75 per code
  │     hasCDM: true,                           ├── Filter by panelBand, region
  │     numGPs: 3                               └── Return to all opted-in users
  │   }
  │
  └── Receive peer benchmarks ◄────────── { F: {median:52, p25:38, p75:68}, ... }
```

### What Gets Shared (Anonymous)

| Field | Format | Purpose |
|---|---|---|
| Panel size | Banded (e.g. "1500-2000") | Peer grouping |
| Region | Province only (Leinster/Munster/Connacht/Ulster) | Regional comparison |
| STC rates per 1000 | Per code | Core benchmark data |
| Number of GPs | Integer | Practice size grouping |
| CDM participation | Boolean | Correlates with ECG/ABPM rates |
| Months of data | Integer | Data quality indicator |

### What Is Never Shared

- Practice name, address, or any identifiers
- Individual doctor numbers or names
- Patient counts or demographics
- Financial amounts (only rates per 1000)
- Raw claim counts

## Implementation Steps

### Step 1: Consent & Settings UI

- Add "Contribute to Peer Benchmarks" toggle in Settings > Privacy
- Clear explanation of what is/isn't shared
- Opt-in only, can withdraw at any time
- Data deleted on withdrawal

### Step 2: Snapshot Generation (Electron)

- New utility: `generateBenchmarkSnapshot(analysisResults, profile)`
- Compute per-1000 rates from actual claims and panel size
- Band the panel size (500-unit bands)
- Map county to province
- No raw patient data leaves the device

### Step 3: API Endpoint (Express Server)

- `POST /api/benchmarks/contribute` - Submit anonymous snapshot
- `GET /api/benchmarks/aggregate` - Retrieve peer benchmarks
- Requires valid license JWT
- Minimum 5 contributors per peer group before returning data (privacy threshold)
- Rate limited: 1 submission per practice per month

### Step 4: Peer Benchmark Display

- New benchmark source tier: "Peer benchmark" (gold badge)
- Show alongside or replacing derived/estimated benchmarks
- Display: "Based on N similar practices" with confidence indicator
- Percentile chart showing where this practice sits

### Step 5: Backend Infrastructure

- Simple database table (could be SQLite file on existing Express server initially)
- Upgrade path: Cloud function (AWS Lambda / Cloudflare Worker) for scale
- Monthly aggregation job computes medians
- Data retention: 24 months rolling window

## Privacy Considerations

- All aggregation happens server-side; no practice can see another's individual data
- Minimum group size of 5 before returning benchmarks (k-anonymity)
- Only rates per 1000 stored (not absolute counts)
- Panel size banded, not exact
- No geographic precision below province level
- GDPR compliant: no personal data involved (all practice-level, anonymised)

## Rollout Strategy

1. **Alpha** (v3.x): Collect snapshots from willing beta testers, build baseline dataset
2. **Beta** (v3.x+1): Display peer benchmarks to contributors only ("give to get")
3. **GA** (v4.0): Peer benchmarks as a premium feature, marketed as competitive advantage

## Success Metrics

- 50+ practices contributing within 6 months
- Peer benchmarks within 15% of actual national averages
- User-reported improvement in STC claiming rates

## Dependencies

- Phase 1 (derived benchmarks) must be complete first
- Express API server already exists for LAN mode
- License validation system already in place
- Need to decide on cloud hosting for scale
