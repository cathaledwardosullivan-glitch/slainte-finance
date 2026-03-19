# Sláinte Box — Concept Document

*March 2026 — Early Exploration*

## Overview

The "Sláinte Box" is a concept for a dedicated hardware device (e.g. Mac Mini with 32-64GB unified memory) that ships pre-installed with the Sláinte suite and a powerful local AI model. All inference runs on-device — no data ever leaves the building.

Two distinct use cases have been identified, with very different value propositions.

---

## Use Case 1: Local AI for Sláinte Finance

### Concept
Replace Claude API calls in Sláinte Finance with a local open-source model, allowing practices that prefer fully offline operation to still access AI-powered tools (Finn chat, report generation, categorisation, agentic workflows).

### Current AI Architecture
- All AI calls route through `src/utils/claudeAPI.js` — two key functions: `callClaude()` (single-shot) and `callClaudeWithTools()` (agentic loop)
- Finn uses a 9-tool agentic workflow orchestrated in `src/context/FinnContext.jsx`
- Three model tiers used: Haiku (fast/cheap tasks), Sonnet (reports/analysis), Opus (complex reasoning)
- Tool-calling (structured JSON function calls) is essential, not optional

### Feasibility Assessment (as of March 2026)
- **Local models have improved dramatically.** MoE architectures (e.g. Qwen3-235B with only 22B active parameters) deliver near-frontier quality at fraction of the compute.
- **Mac Mini M4 Pro (36GB, ~€1,650)** can run these models at usable speeds via Ollama/llama.cpp.
- **Tool calling is now well-supported** in top open models (Qwen3, Llama 4, Mistral).
- **Main limitations:** Token generation speed (~15-25 tok/s for large models), long report generation times (60-90s vs 10-15s cloud), and occasional tool-calling reliability gaps vs Claude.
- **Verdict:** Technically feasible today for most features, but UX is noticeably slower and quality has a small but real gap. By early 2027, this gap will likely be negligible.

### Recommended Preparation
Even before shipping hardware, the codebase could be prepared:
1. Abstract `callClaude()` / `callClaudeWithTools()` behind a provider interface
2. Add an Ollama/llama.cpp backend that speaks the same interface
3. Allow a local/cloud toggle in settings
4. This also enables power users to bring their own local setup before any hardware ships

---

## Use Case 2: Sláinte Clinical Assistant (Screen-Reading CDS)

### Concept
A clinical decision support tool that runs on the Sláinte Box alongside the GP's EHR. Rather than integrating with each EHR system via APIs (which are fragmented and largely closed), the assistant **reads the GP's screen** — effectively looking over their shoulder at whatever patient data is currently displayed.

The assistant passively analyses what's on screen and surfaces relevant observations: potential drug interactions, differential diagnoses, relevant guidelines, screening reminders, etc.

### Why This Needs Local Hardware
Unlike the finance use case, this isn't about saving API costs — it's about **data sovereignty**. Patient consultation data (demographics, medications, diagnoses, lab results) cannot be sent to cloud APIs under any reasonable interpretation of GDPR/HIQA requirements. Local inference isn't a compromise here; it's a hard requirement.

### Technical Architecture

```
┌─────────────────┐     ┌─────────────────────────────────┐
│   Screen 1       │     │   Screen 2                       │
│   (EHR - any)    │     │   (Sláinte Clinical Assistant)   │
│                  │     │                                   │
│  Patient chart,  │────>│  Passive sidebar with:            │
│  medications,    │ OCR/│  - Key observations               │
│  lab results,    │Vision│  - Drug interaction flags         │
│  notes...        │     │  - Guideline references           │
│                  │     │  - "Have you considered..." notes  │
└─────────────────┘     └─────────────────────────────────┘
        │                            ▲
        │    ┌──────────────────┐    │
        └───>│  Sláinte Box      │───┘
             │  (Mac Mini)       │
             │                   │
             │  Screen capture   │
             │  → OCR / Vision   │
             │  → Local LLM      │
             │  → Clinical CDS   │
             └──────────────────┘
```

**Flow:**
1. GP opens patient chart in their EHR (any system)
2. Sláinte Box captures the EHR screen (on hotkey press or periodic polling)
3. OCR or multimodal vision model extracts clinical content from the screenshot
4. Local LLM analyses extracted data with clinical prompt/guidelines
5. Observations displayed passively on the second screen

### Key Advantages
- **Completely EHR-agnostic.** Works with Socrates, HealthOne, HPM, CompleteGP, or any future system. If it's on screen, the assistant can read it. Zero vendor integration required.
- **Data never leaves the device.** Full GDPR compliance by design — no network calls, no cloud processing.
- **Natural mental model.** The "looking over your shoulder" metaphor sets correct expectations — the AI sees what you see, when you see it. It hasn't read the full patient history unless you've scrolled through it.
- **Day-one compatibility.** Works with every EHR in Ireland without any integration work.

### UX Considerations
- **Passive by default.** The assistant updates a sidebar quietly. Active interruptions (alerts, popups) should be reserved for high-priority safety items only (e.g. drug interaction with current prescription, allergy flag).
- **GP-initiated deep queries.** The GP can ask follow-up questions about what's on screen: "What are the contraindications for this medication given their history?"
- **Refresh cadence.** Not continuous capture — either hotkey-triggered or polling with change detection to avoid unnecessary processing.
- **Noise filtering.** The vision/OCR layer needs to focus on clinical content and ignore EHR UI chrome, toolbars, menus, system notifications.

### Technical Feasibility (as of March 2026)
- **Screen capture:** Fully supported on macOS via native APIs
- **OCR:** Apple Vision framework handles this locally with high accuracy
- **Multimodal LLMs:** Vision-capable models (Qwen-VL, LLaVA variants) run locally via Ollama
- **Clinical reasoning:** The queries are typically single-round and focused (not complex agentic loops), which is where local models perform best
- **Response time:** 10-15 seconds is acceptable when the GP is mid-consultation
- **Verdict:** Technically very feasible. The bottleneck is not the technology.

---

## Critical Non-Technical Considerations

### Medical Liability
This is the most significant concern and should be investigated **before** any technical development begins.

- A tool that suggests diagnoses or flags interactions based on patient data is likely classified as a **Clinical Decision Support System (CDS)**
- Under EU MDR (Medical Device Regulation), CDS software may be classified as a medical device depending on its intended purpose
- Classification determines regulatory requirements: CE marking, clinical evaluation, quality management systems, post-market surveillance
- The "over the shoulder" access method does not change the classification — it's determined by what the tool *does*, not how it *gets the data*
- **Key question:** Can this be positioned as a "reference tool" (like UpToDate or BNF) rather than a "diagnostic tool"? The framing and feature boundaries matter enormously.

### Regulatory & Compliance
- **GDPR (health data):** Even with local-only processing, the GP practice is the data controller. Processing patient data for CDS purposes needs a lawful basis and likely requires a DPIA (Data Protection Impact Assessment).
- **HIQA:** Irish health information standards and guidance on electronic health records
- **EU AI Act:** Clinical decision support may fall under "high-risk AI systems" requiring conformity assessments
- **Patient consent:** Patients may need to be informed that an AI tool is analysing their data during consultation, even if no data leaves the device

### Recommended Next Steps
1. **Regulatory consultation** — Engage with a regulatory advisor experienced in EU MDR software classification and the EU AI Act. Understand whether the intended use falls under medical device regulation.
2. **Clinical advisory** — Involve practising GPs early to validate the UX concept and identify the highest-value clinical scenarios.
3. **Legal opinion** — GDPR implications of on-device patient data processing for CDS purposes.
4. **Technical proof of concept** — Only after regulatory clarity: build a minimal screen-capture → OCR → LLM pipeline on a Mac Mini to validate speed, accuracy, and UX.

---

## Product Vision Summary

| | Sláinte Finance (Local AI) | Sláinte Clinical Assistant |
|---|---|---|
| **Value proposition** | Offline AI for practices that prefer it | Clinical decision support that's impossible via cloud |
| **Hardware justification** | Nice to have (saves API costs) | Essential (data cannot leave device) |
| **Technical readiness** | Feasible now, great by 2027 | Feasible now for core loop |
| **Regulatory burden** | Minimal | Significant — must be resolved first |
| **EHR dependency** | None | None (screen-reading approach) |
| **Revenue model** | Hardware + software bundle | Hardware + software + potential subscription |

The clinical assistant is the stronger justification for the Sláinte Box hardware. The finance use case alone probably doesn't warrant dedicated hardware for most practices, but it becomes a natural add-on once the box exists for clinical purposes.
