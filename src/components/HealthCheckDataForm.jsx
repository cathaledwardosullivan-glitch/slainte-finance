import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Check, Users, Stethoscope, Activity, Plus, Trash2, AlertCircle, ChevronDown, HelpCircle, Upload, FileText, CheckCircle2 } from 'lucide-react';
import COLORS from '../utils/colors';
import gmsRates from '../data/gmsRates';
import { parsePracticeDistributionCSV } from '../utils/socratesReportParser';

/**
 * Reusable Disease Field Component - defined outside to prevent re-creation on each render
 */
const DiseaseField = ({ id, label, placeholder, ehrGuide, value, onChange, expandedEHRGuide, setExpandedEHRGuide }) => (
  <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.borderLight }}>
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium" style={{ color: COLORS.textPrimary }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setExpandedEHRGuide(expandedEHRGuide === id ? null : id)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100"
          style={{ color: COLORS.slainteBlue }}
        >
          <HelpCircle className="h-3 w-3" />
          How to find
          <ChevronDown className={`h-3 w-3 transition-transform ${expandedEHRGuide === id ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded"
        style={{ borderColor: COLORS.borderLight }}
        placeholder={placeholder}
      />
    </div>
    {expandedEHRGuide === id && (
      <div className="px-3 pb-3 pt-0">
        <div className="p-3 rounded text-xs" style={{ backgroundColor: COLORS.slainteBlueLight, color: COLORS.infoText }}>
          <p className="font-medium mb-2">How to find this in your EHR:</p>
          <div className="space-y-1" style={{ color: COLORS.slainteBlue }}>
            {ehrGuide.map((step, idx) => (
              <p key={idx}>• {step}</p>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);

/**
 * Reusable Prevention Programme Field Component - defined outside to prevent re-creation on each render
 */
const PPField = ({ id, label, placeholder, ehrGuide, description, value, onChange, expandedEHRGuide, setExpandedEHRGuide }) => (
  <div className="border rounded-lg overflow-hidden mb-3" style={{ borderColor: COLORS.borderLight }}>
    <div className="p-3">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium" style={{ color: COLORS.textPrimary }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setExpandedEHRGuide(expandedEHRGuide === id ? null : id)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100"
          style={{ color: COLORS.slainteBlue }}
        >
          <HelpCircle className="h-3 w-3" />
          How to find
          <ChevronDown className={`h-3 w-3 transition-transform ${expandedEHRGuide === id ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {description && (
        <p className="text-xs mb-2" style={{ color: COLORS.textSecondary }}>{description}</p>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded"
        style={{ borderColor: COLORS.borderLight }}
        placeholder={placeholder}
      />
    </div>
    {expandedEHRGuide === id && (
      <div className="px-3 pb-3 pt-0">
        <div className="p-3 rounded text-xs" style={{ backgroundColor: COLORS.successLight, color: COLORS.successText }}>
          <p className="font-medium mb-2">How to find this in your EHR:</p>
          <div className="space-y-1" style={{ color: COLORS.successText }}>
            {ehrGuide.map((step, idx) => (
              <p key={idx}>• {step}</p>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);

/**
 * Reusable OCF Field Component - defined outside to prevent re-creation on each render
 */
const OCFField = ({ id, label, placeholder, ehrGuide, description, value, onChange, expandedEHRGuide, setExpandedEHRGuide }) => (
  <div className="border rounded-lg overflow-hidden mb-3" style={{ borderColor: COLORS.borderLight }}>
    <div className="p-3">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium" style={{ color: COLORS.textPrimary }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setExpandedEHRGuide(expandedEHRGuide === id ? null : id)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100"
          style={{ color: COLORS.slainteBlue }}
        >
          <HelpCircle className="h-3 w-3" />
          How to find
          <ChevronDown className={`h-3 w-3 transition-transform ${expandedEHRGuide === id ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {description && (
        <p className="text-xs mb-2" style={{ color: COLORS.textSecondary }}>{description}</p>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded"
        style={{ borderColor: COLORS.borderLight }}
        placeholder={placeholder}
      />
    </div>
    {expandedEHRGuide === id && (
      <div className="px-3 pb-3 pt-0">
        <div className="p-3 rounded text-xs" style={{ backgroundColor: COLORS.warningLight, color: COLORS.warningText }}>
          <p className="font-medium mb-2">How to find this in your EHR:</p>
          <div className="space-y-1" style={{ color: COLORS.warningDark }}>
            {ehrGuide.map((step, idx) => (
              <p key={idx}>• {step}</p>
            ))}
          </div>
          <p className="mt-2 font-medium">OCF Risk Factors:</p>
          <p>• Obesity (BMI ≥30) • Current Smoker • Dyslipidaemia</p>
          <p>• Family history of DM or premature CVD • Raised BP</p>
          <p>• Irish Traveller or Roma ethnicity</p>
        </div>
      </div>
    )}
  </div>
);

/**
 * Simple 3-step form to collect Health Check data
 * Integrates with existing practice profile structure
 * Now includes individual staff member details for Practice Support analysis
 */
export default function HealthCheckDataForm({ practiceProfile, paymentAnalysisData, onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedEHRGuide, setExpandedEHRGuide] = useState(null); // Which condition's EHR guide is expanded
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());
  const [showSocratesGuide, setShowSocratesGuide] = useState(false);

  // Detect EHR system from practice profile
  const ehrSystem = practiceProfile?.practiceDetails?.ehrSystem || '';
  const isSocrates = ehrSystem === 'socrates';
  const isHealthOne = ehrSystem === 'healthone';
  const isHPM = ehrSystem === 'practicemanager';
  const isCompleteGP = ehrSystem === 'completegp';

  // EHR-specific CDM guides
  const getCDMGuide = useCallback((conditionId) => {
    const socratesGuides = {
      type2Diabetes: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "The patient count appears at the top of the results list",
        "Alternative: Reports → Patients → Patients with Multiple Conditions → Add ICPC-2 code T90",
        "ICPC-2 code: T90 (Type 2 Diabetes)"
      ],
      asthma: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "Filter for Asthma registrations — count shown at top",
        "Alternative: Patients with Multiple Conditions → ICPC-2 code R96",
        "ICPC-2 code: R96 (Asthma)"
      ],
      copd: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "Filter for COPD registrations — count shown at top",
        "Alternative: Patients with Multiple Conditions → ICPC-2 code R95",
        "ICPC-2 code: R95 (COPD)"
      ],
      heartFailure: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "Filter for Heart Failure registrations — count shown at top",
        "Alternative: Patients with Multiple Conditions → ICPC-2 code K77",
        "ICPC-2 code: K77 (Heart Failure)"
      ],
      atrialFibrillation: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "Filter for AF registrations — count shown at top",
        "Alternative: Patients with Multiple Conditions → ICPC-2 code K78",
        "ICPC-2 code: K78 (Atrial Fibrillation)"
      ],
      ihd: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "Filter for IHD/Coronary registrations — count shown at top",
        "Alternative: Patients with Multiple Conditions → ICPC-2 codes K74 (Angina) or K76 (IHD)",
        "ICPC-2 codes: K74 (Angina), K76 (IHD)"
      ],
      stroke: [
        "In Socrates: My Control Panel → Patient Finder → New List → CDM Registrations",
        "Filter for Stroke/TIA registrations — count shown at top",
        "Alternative: Patients with Multiple Conditions → ICPC-2 code K90",
        "ICPC-2 code: K90 (Stroke/TIA)"
      ],
      hypertension: [
        "In Socrates: Search for patients with ICPC-2 code K86 or K87 (Hypertension)",
        "Use Patient Finder or Patients with Multiple Conditions report",
        "Note: Hypertension-only patients go on Prevention Programme, not CDM Treatment"
      ],
      preDiabetes: [
        "In Socrates: Search for HbA1c results 42-47 mmol/mol in patients 45+",
        "Also search for ICPC-2 code T90 with qualifier 'pre-diabetes' or 'impaired glucose tolerance'",
        "These patients are eligible for Prevention Programme, not CDM Treatment"
      ],
      highCVDRisk: [
        "In Socrates: Search clinical notes for QRISK scores ≥20% in patients 45+",
        "Often identified through OCF assessments — check OCF results",
        "These patients are eligible for Prevention Programme"
      ],
      gestationalDMHistory: [
        "In Socrates: Search past medical history for 'Gestational diabetes' or 'GDM'",
        "Check obstetric history in patient records for women 18+",
        "ICD-10 code O24.4"
      ],
      preEclampsiaHistory: [
        "In Socrates: Search past medical history for 'Pre-eclampsia' or 'PET'",
        "Check obstetric history in patient records for women 18+",
        "ICD-10 code O14.x"
      ],
      ocfEligible: [
        "In Socrates: Use Patient Finder to search for patients 45+ with risk factors",
        "Risk factors: BMI ≥30, Current Smoker, High Cholesterol, Family history of DM/CVD",
        "Exclude patients already on CDM Treatment or Prevention Programme registers",
        "The CDM Finder Tool can help identify eligible-but-uncalled patients"
      ]
    };

    const healthOneGuides = {
      type2Diabetes: [
        "In HealthOne: Analysis → CDM Dashboard → filter by disease to count CDM-registered diabetes patients",
        "Alternative: Analysis → Database Analysis → New → search for 'Diabetes Type 2' in Medical History/Problem",
        "Patients must be coded in their Problem list for the search to find them"
      ],
      asthma: [
        "In HealthOne: Analysis → CDM Dashboard → filter for Asthma reviews",
        "Alternative: Analysis → Database Analysis → New → search for 'Asthma' in Medical History/Problem",
        "Patients must be coded in their Problem list for the search to find them"
      ],
      copd: [
        "In HealthOne: Analysis → CDM Dashboard → filter for COPD reviews",
        "Alternative: Analysis → Database Analysis → New → search for 'COPD' in Medical History/Problem",
        "Patients must be coded in their Problem list for the search to find them"
      ],
      heartFailure: [
        "In HealthOne: Analysis → CDM Dashboard → filter for Heart Failure reviews",
        "Alternative: Analysis → Database Analysis → New → search for 'Heart Failure' in Medical History/Problem",
        "Patients must be coded in their Problem list for the search to find them"
      ],
      atrialFibrillation: [
        "In HealthOne: Analysis → CDM Dashboard → filter for AF reviews",
        "Alternative: Analysis → Database Analysis → New → search for 'Atrial Fibrillation' in Medical History/Problem",
        "Patients must be coded in their Problem list for the search to find them"
      ],
      ihd: [
        "In HealthOne: Analysis → CDM Dashboard → filter for IHD reviews",
        "Alternative: Analysis → Database Analysis → New → search for 'Ischaemic Heart Disease' or 'Angina' in Medical History/Problem",
        "Also check for 'Coronary Artery', 'CABG', 'MI' in Problem list"
      ],
      stroke: [
        "In HealthOne: Analysis → CDM Dashboard → filter for Stroke/TIA reviews",
        "Alternative: Analysis → Database Analysis → New → search for 'Stroke' or 'TIA' in Medical History/Problem",
        "Also check for 'Cerebrovascular Disease' or 'CVA' in Problem list"
      ],
      hypertension: [
        "In HealthOne: Analysis → Database Analysis → New → search for 'Hypertension' in Medical History/Problem",
        "You can add age criteria (18+) to narrow results",
        "Note: Hypertension-only patients go on Prevention Programme, not CDM Treatment"
      ],
      preDiabetes: [
        "In HealthOne: Search lab results for HbA1c 42-47 mmol/mol in patients 45+",
        "Also check Problem list for 'Pre-diabetes' or 'Impaired glucose tolerance'",
        "These patients are eligible for Prevention Programme, not CDM Treatment"
      ],
      highCVDRisk: [
        "In HealthOne: Check OCF review outcomes — patients moved to PP had QRISK ≥20%",
        "Analysis → CDM Dashboard → filter for PP reviews with 'High CVD Risk' indication",
        "These patients are eligible for Prevention Programme"
      ],
      gestationalDMHistory: [
        "In HealthOne: Analysis → Database Analysis → New → search for 'Gestational diabetes' or 'GDM' in Problem list",
        "CDM Phase 3: PP is open to patients with GDM diagnosed since Jan 2023",
        "ICD-10 code O24.4"
      ],
      preEclampsiaHistory: [
        "In HealthOne: Analysis → Database Analysis → New → search for 'Pre-eclampsia' in Problem list",
        "CDM Phase 3: PP is open to patients with pre-eclampsia diagnosed since Jan 2023",
        "ICD-10 code O14.x"
      ],
      ocfEligible: [
        "In HealthOne: Analysis → CDM Dashboard → 'Last Visits' tab → filter for patients not yet assessed",
        "OCF is available for GMS/DVC patients 45+ with risk factors",
        "Risk factors: BMI ≥30, Smoker, High Cholesterol, Family history of DM/CVD",
        "Outcome: Low risk (stay OCF), High risk (move to PP), or Diagnosis (move to CDM)"
      ]
    };

    const hpmGuides = {
      type2Diabetes: [
        "In HPM: Reports → Diagnosis Report → search for 'Diabetes Type 2' → Run",
        "Patient count shown at top of results list",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by Diabetes",
        "Patients must be coded under Medical History for the search to find them"
      ],
      asthma: [
        "In HPM: Reports → Diagnosis Report → search for 'Asthma' → Run",
        "Patient count shown at top of results list",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by Asthma",
        "Patients must be coded under Medical History for the search to find them"
      ],
      copd: [
        "In HPM: Reports → Diagnosis Report → search for 'COPD' → Run",
        "Patient count shown at top of results list",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by COPD",
        "Patients must be coded under Medical History for the search to find them"
      ],
      heartFailure: [
        "In HPM: Reports → Diagnosis Report → search for 'Heart Failure' → Run",
        "Patient count shown at top of results list",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by Heart Failure",
        "Patients must be coded under Medical History for the search to find them"
      ],
      atrialFibrillation: [
        "In HPM: Reports → Diagnosis Report → search for 'Atrial Fibrillation' → Run",
        "Patient count shown at top of results list",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by AF",
        "Patients must be coded under Medical History for the search to find them"
      ],
      ihd: [
        "In HPM: Reports → Diagnosis Report → search for 'Ischaemic Heart Disease' → Run",
        "Also search for 'Angina', 'Coronary Artery Disease' — use 'Show Any' to combine",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by IHD",
        "Patients must be coded under Medical History for the search to find them"
      ],
      stroke: [
        "In HPM: Reports → Diagnosis Report → search for 'Stroke' → Run",
        "Also search for 'TIA', 'Cerebrovascular Disease' — use 'Show Any' to combine",
        "Alternative: Tasks → Claim Tracker → Chronic Disease Tracker → filter by Stroke/TIA",
        "Patients must be coded under Medical History for the search to find them"
      ],
      hypertension: [
        "In HPM: Reports → Diagnosis Report → search for 'Hypertension' → Run",
        "Filter by age 18+ if needed",
        "Note: Hypertension-only patients go on Prevention Programme, not CDM Treatment"
      ],
      preDiabetes: [
        "In HPM: Search lab results for HbA1c 42-47 mmol/mol in patients 45+",
        "Also: Reports → Diagnosis Report → search for 'Pre-diabetes' or 'Impaired glucose tolerance'",
        "These patients are eligible for Prevention Programme, not CDM Treatment"
      ],
      highCVDRisk: [
        "In HPM: Check OCF review outcomes in Claim Tracker — patients moved to PP had QRISK ≥20%",
        "Tasks → Claim Tracker → Chronic Disease Tracker → filter by Prevention Programme",
        "These patients are eligible for Prevention Programme"
      ],
      gestationalDMHistory: [
        "In HPM: Reports → Diagnosis Report → search for 'Gestational diabetes' → Run",
        "Also check Protocols → Maternity for obstetric history in women 18+",
        "ICD-10 code O24.4"
      ],
      preEclampsiaHistory: [
        "In HPM: Reports → Diagnosis Report → search for 'Pre-eclampsia' → Run",
        "Also check Protocols → Maternity for obstetric history in women 18+",
        "ICD-10 code O14.x"
      ],
      ocfEligible: [
        "In HPM: Reports → Patient Reports → filter Age 45+, Patient Type GMS/DVC",
        "Cross-reference with Claim Tracker to exclude patients already on CDM/PP",
        "Risk factors: BMI ≥30, Smoker, High Cholesterol, Family history of DM/CVD",
        "OCF outcome: Low risk (stay OCF), High risk (move to PP), or Diagnosis (move to CDM)"
      ]
    };

    const completeGPGuides = {
      type2Diabetes: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Type 2 Diabetes'",
        "Search by ICD-10 code E11.x, ICPC-2 code T90, or SNOMED term",
        "The patient count is shown at the top of the results",
        "Save the search for future use — searches can be exported and shared"
      ],
      asthma: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Asthma'",
        "Search by ICD-10 code J45.x, ICPC-2 code R96, or SNOMED term",
        "The patient count is shown at the top of the results"
      ],
      copd: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'COPD'",
        "Search by ICD-10 code J44.x, ICPC-2 code R95, or SNOMED term",
        "The patient count is shown at the top of the results"
      ],
      heartFailure: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Heart Failure'",
        "Search by ICD-10 code I50.x, ICPC-2 code K77, or SNOMED term",
        "The patient count is shown at the top of the results"
      ],
      atrialFibrillation: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Atrial Fibrillation'",
        "Search by ICD-10 code I48.x, ICPC-2 code K78, or SNOMED term",
        "The patient count is shown at the top of the results"
      ],
      ihd: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Ischaemic Heart Disease'",
        "Also search for 'Angina', 'MI' — combine searches as needed",
        "Search by ICD-10 codes I20-I25, ICPC-2 codes K74/K76, or SNOMED terms"
      ],
      stroke: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Stroke' or 'TIA'",
        "Also search for 'Cerebrovascular Disease'",
        "Search by ICD-10 codes I60-I69/G45, ICPC-2 code K90, or SNOMED terms"
      ],
      hypertension: [
        "In CompleteGP: Use the Search Tool to find patients coded with 'Hypertension'",
        "Search by ICD-10 code I10, ICPC-2 code K86/K87, or SNOMED term",
        "Note: Hypertension-only patients go on Prevention Programme, not CDM Treatment"
      ],
      preDiabetes: [
        "In CompleteGP: Search for patients with HbA1c results 42-47 mmol/mol (ages 45+)",
        "Also search coded records for 'Pre-diabetes' or 'Impaired glucose tolerance'",
        "These patients are eligible for Prevention Programme, not CDM Treatment"
      ],
      highCVDRisk: [
        "In CompleteGP: Search clinical records for QRISK scores ≥20% in patients 45+",
        "Check OCF review outcomes — patients moved to PP had high CVD risk",
        "These patients are eligible for Prevention Programme"
      ],
      gestationalDMHistory: [
        "In CompleteGP: Search coded records for 'Gestational diabetes' or 'GDM'",
        "ICD-10 code O24.4 — search in obstetric/medical history for women 18+"
      ],
      preEclampsiaHistory: [
        "In CompleteGP: Search coded records for 'Pre-eclampsia'",
        "ICD-10 code O14.x — search in obstetric/medical history for women 18+"
      ],
      ocfEligible: [
        "In CompleteGP: Use the Search Tool to find GMS/DVC patients aged 45+ with risk factors",
        "Cross-reference to exclude patients already on CDM or Prevention Programme",
        "Risk factors: BMI ≥30, Smoker, High Cholesterol, Family history of DM/CVD"
      ]
    };

    const genericGuides = {
      type2Diabetes: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: T90)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'Diabetes Type 2'",
        "HPM: Reports → Diagnosis Report → search 'Diabetes Type 2'",
        "Search: ICD-10 code E11.x or problem 'Type 2 Diabetes'"
      ],
      asthma: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: R96)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'Asthma'",
        "HPM: Reports → Diagnosis Report → search 'Asthma'",
        "Search: ICD-10 code J45.x or problem 'Asthma'"
      ],
      copd: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: R95)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'COPD'",
        "HPM: Reports → Diagnosis Report → search 'COPD'",
        "Search: ICD-10 code J44.x or problem 'COPD'"
      ],
      heartFailure: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: K77)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'Heart Failure'",
        "HPM: Reports → Diagnosis Report → search 'Heart Failure'",
        "Search: ICD-10 code I50.x or problem 'Heart Failure'"
      ],
      atrialFibrillation: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: K78)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'Atrial Fibrillation'",
        "HPM: Reports → Diagnosis Report → search 'Atrial Fibrillation'",
        "Search: ICD-10 code I48.x or problem 'AF'"
      ],
      ihd: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: K74/K76)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'IHD'",
        "HPM: Reports → Diagnosis Report → search 'Ischaemic Heart Disease'",
        "Search: ICD-10 codes I20-I25 or problems 'Angina', 'MI', 'CABG'"
      ],
      stroke: [
        "Socrates: Patient Finder → CDM Registrations (ICPC-2: K90)",
        "HealthOne: Analysis → CDM Dashboard or Database Analysis → 'Stroke'",
        "HPM: Reports → Diagnosis Report → search 'Stroke' or 'TIA'",
        "Search: ICD-10 codes I60-I69, G45 or problems 'Stroke', 'TIA', 'CVA'"
      ],
      hypertension: [
        "Socrates: Search for ICPC-2 code K86/K87 (Hypertension)",
        "HealthOne: Analysis → Database Analysis → search 'Hypertension'",
        "HPM: Reports → Diagnosis Report → search 'Hypertension'",
        "Note: Hypertension-only patients go on PP, not CDM Treatment"
      ],
      preDiabetes: [
        "Search for HbA1c results 42-47 mmol/mol in patients 45+",
        "Also search for problem 'Pre-diabetes' or 'Impaired glucose tolerance'"
      ],
      highCVDRisk: [
        "Search clinical notes for QRISK scores ≥20% in patients 45+",
        "Often identified through OCF assessments"
      ],
      gestationalDMHistory: [
        "Search past medical history for 'Gestational diabetes' or 'GDM'",
        "ICD-10 code O24.4 in obstetric history"
      ],
      preEclampsiaHistory: [
        "Search past medical history for 'Pre-eclampsia' or 'PET'",
        "ICD-10 code O14.x in obstetric history"
      ],
      ocfEligible: [
        "Search for patients 45+ with risk factors who are NOT on CDM/PP registers",
        "Risk factors: BMI ≥30, Smoker, High Cholesterol, Family history",
        "Exclude patients already on CDM Treatment or Prevention Programme"
      ]
    };

    if (isSocrates && socratesGuides[conditionId]) {
      return socratesGuides[conditionId];
    }
    if (isHealthOne && healthOneGuides[conditionId]) {
      return healthOneGuides[conditionId];
    }
    if (isHPM && hpmGuides[conditionId]) {
      return hpmGuides[conditionId];
    }
    if (isCompleteGP && completeGPGuides[conditionId]) {
      return completeGPGuides[conditionId];
    }
    return genericGuides[conditionId] || [];
  }, [isSocrates, isHealthOne, isHPM, isCompleteGP]);

  // Calculate smears performed from PCRS cervical screening payments
  const calculatedSmearsPerformed = useMemo(() => {
    if (!paymentAnalysisData || paymentAnalysisData.length === 0) return null;

    let totalCervicalPayments = 0;
    paymentAnalysisData.forEach(entry => {
      // Look for cervical screening payments in the payment categories
      if (entry.categories) {
        Object.entries(entry.categories).forEach(([category, amount]) => {
          if (category.toLowerCase().includes('cervical') ||
              category.toLowerCase().includes('smear')) {
            totalCervicalPayments += amount;
          }
        });
      }
      // Also check raw payments if available
      if (entry.payments) {
        entry.payments.forEach(payment => {
          const desc = (payment.description || '').toLowerCase();
          if (desc.includes('cervical') || desc.includes('smear')) {
            totalCervicalPayments += payment.amount || 0;
          }
        });
      }
    });

    if (totalCervicalPayments > 0) {
      // Current rate per smear (€65 since HPV primary screening, March 2020)
      const perSmearRate = gmsRates.cervicalCheck?.perSmear || 65.00;
      return Math.round(totalCervicalPayments / perSmearRate);
    }
    return null;
  }, [paymentAnalysisData]);

  // Map Cara's staff role to subsidy staff type
  const mapRoleToStaffType = (role) => {
    const roleMap = {
      'reception': 'secretary',
      'nursing': 'nurse',
      'phlebotomy': 'nurse',
      'gp_assistant': 'secretary',
      'management': 'practiceManager',
      'secretary': 'secretary',
      'nurse': 'nurse',
      'practice_manager': 'practiceManager'
    };
    return roleMap[role?.toLowerCase()] || 'secretary';
  };

  // Extract staff from practice profile (Cara onboarding) and PCRS PDFs
  const getDetectedStaff = () => {
    const staffMap = new Map();

    // 1. First, add staff from practice profile (Cara onboarding)
    // These are the "source of truth" for names and roles
    if (practiceProfile?.staff && practiceProfile.staff.length > 0) {
      practiceProfile.staff.forEach(staff => {
        // Parse name if it's a single string like "Mary Walsh"
        let firstName = staff.firstName || '';
        let surname = staff.surname || '';
        if (!firstName && !surname && staff.name) {
          const nameParts = staff.name.trim().split(' ');
          firstName = nameParts[0] || '';
          surname = nameParts.slice(1).join(' ') || '';
        }

        const key = `${surname.toLowerCase()}-${firstName.toLowerCase()}`;
        staffMap.set(key, {
          firstName,
          surname,
          staffType: mapRoleToStaffType(staff.role),
          incrementPoint: 1,  // Default, will be updated from PCRS if available
          weeklyHours: '',  // User needs to provide
          yearsExperience: '',  // User needs to provide
          actualHoursWorked: '',
          fromProfile: true,
          fromPCRS: false,
          originalRole: staff.role  // Keep original role for display
        });
      });
    }

    // 2. Then, merge/enhance with PCRS data if available
    if (paymentAnalysisData && paymentAnalysisData.length > 0) {
      paymentAnalysisData.forEach(entry => {
        if (entry.practiceSubsidy?.staff) {
          entry.practiceSubsidy.staff.forEach(staff => {
            const key = `${(staff.surname || '').toLowerCase()}-${(staff.firstName || '').toLowerCase()}`;

            if (staffMap.has(key)) {
              // Enhance existing profile staff with PCRS data
              const existing = staffMap.get(key);
              staffMap.set(key, {
                ...existing,
                incrementPoint: staff.incrementPoint || existing.incrementPoint,
                weeklyHours: staff.weeklyHours || existing.weeklyHours,
                fromPCRS: true  // Mark that we have PCRS data for this person
              });
            } else {
              // Add staff found in PCRS but not in profile
              staffMap.set(key, {
                firstName: staff.firstName,
                surname: staff.surname,
                staffType: staff.staffType || 'unknown',
                incrementPoint: staff.incrementPoint || 1,
                weeklyHours: staff.weeklyHours || 0,
                yearsExperience: '',
                actualHoursWorked: '',
                fromProfile: false,
                fromPCRS: true
              });
            }
          });
        }
      });
    }

    return Array.from(staffMap.values());
  };

  const [formData, setFormData] = useState({
    // Step 1: Capitation - Demographics (only age bands used in calculations)
    demographics: practiceProfile?.healthCheckData?.demographics || {
      under6: '',
      age6to7: '',
      over70: '',
      nursingHomeResidents: '',
    },
    // Step 2: Practice Support - Staff details
    staffDetails: practiceProfile?.healthCheckData?.staffDetails || getDetectedStaff(),
    // Step 3: CDM - Disease registers
    diseaseRegisters: practiceProfile?.healthCheckData?.diseaseRegisters || {
      // CDM Treatment Programme - Established chronic disease (18+)
      type2Diabetes: '',
      asthma: '',        // All ages now eligible (not just under-8)
      copd: '',
      heartFailure: '',
      atrialFibrillation: '',
      ihd: '',           // Ischaemic Heart Disease
      stroke: '',        // Stroke/TIA
      // Prevention Programme - High risk / Pre-disease
      hypertension: '',           // 18+ with hypertension diagnosis (PP eligible)
      preDiabetes: '',            // 45+ with pre-diabetes (PP eligible)
      highCVDRisk: '',            // 45+ with QRISK ≥20% (PP eligible)
      gestationalDMHistory: '',   // 18+ women with history of GDM (PP eligible)
      preEclampsiaHistory: '',    // 18+ women with history of pre-eclampsia (PP eligible)
      // OCF - Opportunistic Case Finding (45+ with risk factors, not on CDM/PP)
      ocfEligible: '',            // 45+ with risk factors (smoker, BMI≥30, dyslipidaemia, family history, etc.)
    },
    // Cervical Screening (in Step 1, smears performed comes from PCRS data)
    cervicalCheckActivity: practiceProfile?.healthCheckData?.cervicalCheckActivity || {
      eligibleWomen25to44: '',
      eligibleWomen45to65: '',
    },
  });

  // Initialize detected staff on mount - from practice profile and/or PCRS data
  useEffect(() => {
    const hasProfileStaff = practiceProfile?.staff?.length > 0;
    const hasPCRSData = paymentAnalysisData?.length > 0;

    if (formData.staffDetails.length === 0 && (hasProfileStaff || hasPCRSData)) {
      const detected = getDetectedStaff();
      if (detected.length > 0) {
        setFormData(prev => ({ ...prev, staffDetails: detected }));
      }
    }
  }, [paymentAnalysisData, practiceProfile?.staff]);

  const totalSteps = 3;

  // Step labels for progress indicator
  const stepLabels = [
    { num: 1, title: 'Patient Demographics', icon: Users },
    { num: 2, title: 'Practice Support', icon: Users },
    { num: 3, title: 'Disease Registers', icon: Stethoscope }
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Process individual staff details
    const processedStaffDetails = formData.staffDetails.map(staff => ({
      firstName: staff.firstName,
      surname: staff.surname,
      staffType: staff.staffType,
      incrementPoint: parseInt(staff.incrementPoint) || 1,
      weeklyHours: parseFloat(staff.weeklyHours) || 0,
      // For practice manager, yearsExperience is always 1
      yearsExperience: staff.staffType === 'practiceManager' ? 1 : (parseInt(staff.yearsExperience) || 0),
      actualHoursWorked: parseFloat(staff.actualHoursWorked) || parseFloat(staff.weeklyHours) || 0,
      fromPCRS: staff.fromPCRS || false
    }));

    // Derive staff aggregates from staffDetails for backward compatibility
    const secretaries = processedStaffDetails.filter(s => s.staffType === 'secretary');
    const nurses = processedStaffDetails.filter(s => s.staffType === 'nurse');
    const practiceManagers = processedStaffDetails.filter(s => s.staffType === 'practiceManager');

    // Convert string inputs to numbers
    const processedData = {
      demographics: {
        under6: parseInt(formData.demographics.under6) || 0,
        age6to7: parseInt(formData.demographics.age6to7) || 0,
        over70: parseInt(formData.demographics.over70) || 0,
        nursingHomeResidents: parseInt(formData.demographics.nursingHomeResidents) || 0,
      },
      // Derived from staffDetails for backward compatibility
      staff: {
        secretaries: {
          count: secretaries.length,
          totalHours: secretaries.reduce((sum, s) => sum + (s.actualHoursWorked || s.weeklyHours || 0), 0),
          yearsExperience: secretaries.length > 0
            ? Math.round(secretaries.reduce((sum, s) => sum + s.yearsExperience, 0) / secretaries.length)
            : 0,
        },
        nurses: {
          count: nurses.length,
          totalHours: nurses.reduce((sum, s) => sum + (s.actualHoursWorked || s.weeklyHours || 0), 0),
          yearsExperience: nurses.length > 0
            ? Math.round(nurses.reduce((sum, s) => sum + s.yearsExperience, 0) / nurses.length)
            : 0,
        },
        practiceManager: {
          employed: practiceManagers.length > 0,
          hours: practiceManagers.reduce((sum, s) => sum + (s.actualHoursWorked || s.weeklyHours || 0), 0),
        },
      },
      // Individual staff details for Practice Support analysis
      staffDetails: processedStaffDetails,
      diseaseRegisters: {
        // CDM Treatment Programme - Established chronic disease (18+)
        type2Diabetes: parseInt(formData.diseaseRegisters.type2Diabetes) || 0,
        asthma: parseInt(formData.diseaseRegisters.asthma) || 0,
        copd: parseInt(formData.diseaseRegisters.copd) || 0,
        heartFailure: parseInt(formData.diseaseRegisters.heartFailure) || 0,
        atrialFibrillation: parseInt(formData.diseaseRegisters.atrialFibrillation) || 0,
        ihd: parseInt(formData.diseaseRegisters.ihd) || 0,
        stroke: parseInt(formData.diseaseRegisters.stroke) || 0,
        // Prevention Programme - High risk / Pre-disease
        hypertension: parseInt(formData.diseaseRegisters.hypertension) || 0,
        preDiabetes: parseInt(formData.diseaseRegisters.preDiabetes) || 0,
        highCVDRisk: parseInt(formData.diseaseRegisters.highCVDRisk) || 0,
        gestationalDMHistory: parseInt(formData.diseaseRegisters.gestationalDMHistory) || 0,
        preEclampsiaHistory: parseInt(formData.diseaseRegisters.preEclampsiaHistory) || 0,
        // OCF - Opportunistic Case Finding
        ocfEligible: parseInt(formData.diseaseRegisters.ocfEligible) || 0,
      },
      cervicalCheckActivity: {
        eligibleWomen25to44: parseInt(formData.cervicalCheckActivity.eligibleWomen25to44) || 0,
        eligibleWomen45to65: parseInt(formData.cervicalCheckActivity.eligibleWomen45to65) || 0,
        // Smears performed is calculated from PCRS payment data
        smearsPerformed: calculatedSmearsPerformed || 0,
        smearsFromPCRS: calculatedSmearsPerformed !== null,
      },
      healthCheckComplete: true,
      lastHealthCheck: new Date().toISOString(),
    };

    onComplete(processedData);
  };

  // Staff details management functions
  const addStaffMember = () => {
    setFormData(prev => ({
      ...prev,
      staffDetails: [
        ...prev.staffDetails,
        {
          firstName: '',
          surname: '',
          staffType: 'secretary',
          incrementPoint: 1,
          weeklyHours: 39,
          yearsExperience: '',
          actualHoursWorked: '',
          fromPCRS: false
        }
      ]
    }));
  };

  const removeStaffMember = (index) => {
    setFormData(prev => ({
      ...prev,
      staffDetails: prev.staffDetails.filter((_, i) => i !== index)
    }));
  };

  const updateStaffMember = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      staffDetails: prev.staffDetails.map((staff, i) =>
        i === index ? { ...staff, [field]: value } : staff
      )
    }));
  };

  const updateField = (section, field, value, subField = null) => {
    setFormData(prev => ({
      ...prev,
      [section]: subField
        ? {
            ...prev[section],
            [field]: {
              ...prev[section][field],
              [subField]: value
            }
          }
        : {
            ...prev[section],
            [field]: value
          }
    }));
  };

  // Handle CSV file upload for Socrates Practice Distribution Breakdown
  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvProcessing(true);
    setCsvResult(null);

    try {
      const csvText = await file.text();
      const result = parsePracticeDistributionCSV(csvText);

      setCsvResult(result);

      if (result.success) {
        const filled = new Set();

        // Auto-fill demographics
        if (result.data.demographics.under6 > 0) {
          setFormData(prev => ({
            ...prev,
            demographics: {
              ...prev.demographics,
              under6: String(result.data.demographics.under6),
              over70: String(result.data.demographics.over70),
            },
            cervicalCheckActivity: {
              ...prev.cervicalCheckActivity,
              eligibleWomen25to44: String(result.data.cervicalScreening.eligibleWomen25to44),
              eligibleWomen45to65: String(result.data.cervicalScreening.eligibleWomen45to65),
            },
            stcDemographics: {
              ...prev.stcDemographics,
              gmsFemale17to35: result.data.contraceptionDemographics?.gmsFemale17to35 || 0,
              gmsFemale36to44: result.data.contraceptionDemographics?.gmsFemale36to44 || 0,
            }
          }));
          filled.add('under6');
          filled.add('over70');
          filled.add('eligibleWomen25to44');
          filled.add('eligibleWomen45to65');
          if (result.data.contraceptionDemographics?.gmsFemale17to35 > 0) {
            filled.add('gmsFemale17to35');
            filled.add('gmsFemale36to44');
          }
        }

        setAutoFilledFields(filled);
      }
    } catch (err) {
      setCsvResult({
        success: false,
        error: `Failed to read file: ${err.message}`,
        warnings: []
      });
    } finally {
      setCsvProcessing(false);
    }
  };

  // Helper to render auto-filled badge
  const AutoFilledBadge = ({ field }) => {
    if (!autoFilledFields.has(field)) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ml-2"
        style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
        <CheckCircle2 className="h-3 w-3" />
        Auto-filled
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto py-4 px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full my-auto flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Header - Fixed */}
        <div className="p-6 border-b flex-shrink-0" style={{ borderColor: COLORS.borderLight }}>
          <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
            GMS Health Check - Data Collection
          </h2>
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            Step {currentStep} of {totalSteps}
          </p>
          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full" style={{ backgroundColor: COLORS.bgPage }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                backgroundColor: COLORS.slainteBlue,
                width: `${(currentStep / totalSteps) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Patient Demographics (merged demographics + cervical screening) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                <h3 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>
                  1. Patient Demographics
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                Patient counts from your EHR are used to calculate capitation income and cervical screening potential.
                {isSocrates && ' You can import these automatically from a Socrates report.'}
              </p>

              {/* CSV Upload Section - prominent for Socrates users */}
              {isSocrates && (
                <div className="border-2 rounded-lg p-4" style={{ borderColor: csvResult?.success ? COLORS.success : COLORS.slainteBlue, backgroundColor: csvResult?.success ? COLORS.successLight : COLORS.slainteBlueLight }}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5" style={{ color: csvResult?.success ? COLORS.successText : COLORS.infoText }} />
                    <h4 className="font-semibold" style={{ color: csvResult?.success ? COLORS.successText : COLORS.infoText }}>
                      {csvResult?.success ? 'Report Imported Successfully' : 'Import from Socrates Report'}
                    </h4>
                    {!csvResult?.success && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.infoLighter, color: COLORS.infoText }}>
                        Recommended
                      </span>
                    )}
                  </div>

                  {csvResult?.success ? (
                    // Success state
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="p-2 rounded" style={{ backgroundColor: 'white' }}>
                          <span style={{ color: COLORS.textSecondary }}>GMS</span>
                          <p className="font-semibold">{csvResult.data.panelSummary.totalGMS.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'white' }}>
                          <span style={{ color: COLORS.textSecondary }}>DVC</span>
                          <p className="font-semibold">{csvResult.data.panelSummary.totalDVC.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'white' }}>
                          <span style={{ color: COLORS.textSecondary }}>Private</span>
                          <p className="font-semibold">{csvResult.data.panelSummary.totalPrivate.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'white' }}>
                          <span style={{ color: COLORS.textSecondary }}>Total</span>
                          <p className="font-semibold">{csvResult.data.panelSummary.grandTotal.toLocaleString()}</p>
                        </div>
                      </div>
                      {csvResult.warnings?.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {csvResult.warnings.map((w, i) => (
                            <p key={i} className="flex items-start gap-1 text-xs" style={{ color: COLORS.warningText }}>
                              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {w}
                            </p>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setCsvResult(null); setAutoFilledFields(new Set()); }}
                        className="text-xs mt-1 underline"
                        style={{ color: COLORS.textSecondary }}
                      >
                        Upload a different file
                      </button>
                    </div>
                  ) : (
                    // Upload state
                    <div>
                      <p className="text-sm mb-3" style={{ color: COLORS.slainteBlue }}>
                        Export the "Practice Distribution Breakdown" report from Socrates as CSV and upload it here.
                        This contains aggregate patient counts only — no patient identifiers.
                      </p>

                      {/* Step-by-step guide (expandable) */}
                      <button
                        type="button"
                        onClick={() => setShowSocratesGuide(!showSocratesGuide)}
                        className="flex items-center gap-1 text-xs mb-3 font-medium"
                        style={{ color: COLORS.infoText }}
                      >
                        <ChevronDown className={`h-3 w-3 transition-transform ${showSocratesGuide ? 'rotate-180' : ''}`} />
                        Step-by-step guide
                      </button>
                      {showSocratesGuide && (
                        <div className="p-3 rounded text-sm mb-3 space-y-1" style={{ backgroundColor: 'white', color: COLORS.infoText }}>
                          <p>1. Open Socrates and go to <strong>Reports</strong></p>
                          <p>2. Select the <strong>Patients</strong> category</p>
                          <p>3. Double-click <strong>Practice Distribution Breakdown</strong></p>
                          <p>4. Click <strong>Run Report</strong> (no filters needed — defaults are fine)</p>
                          <p>5. Click <strong>Save</strong> → <strong>CSV File...</strong></p>
                          <p>6. Save the file and upload it here</p>
                        </div>
                      )}

                      {/* Upload zone */}
                      <label className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{ borderColor: COLORS.slainteBlue }}>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVUpload}
                          className="hidden"
                        />
                        {csvProcessing ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin h-6 w-6 border-2 rounded-full" style={{ borderColor: COLORS.borderLight, borderTopColor: COLORS.slainteBlue }} />
                            <span className="text-sm" style={{ color: COLORS.textSecondary }}>Processing...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                            <span className="text-sm font-medium" style={{ color: COLORS.slainteBlue }}>Upload CSV</span>
                            <span className="text-xs" style={{ color: COLORS.textSecondary }}>Drop file or click to browse</span>
                          </div>
                        )}
                      </label>

                      {/* Error display */}
                      {csvResult && !csvResult.success && (
                        <div className="mt-3 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: COLORS.errorLighter }}>
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.error }} />
                          <p className="text-sm" style={{ color: COLORS.errorText }}>{csvResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Divider between CSV upload and manual entry */}
              {isSocrates && (
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px" style={{ backgroundColor: COLORS.borderLight }} />
                  <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
                    {csvResult?.success ? 'Review & adjust' : 'or enter manually'}
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: COLORS.borderLight }} />
                </div>
              )}

              {/* Demographics fields */}
              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.slainteBlueLight, borderLeft: `4px solid ${COLORS.slainteBlue}` }}>
                  <h4 className="font-semibold" style={{ color: COLORS.infoText }}>
                    Capitation Demographics
                  </h4>
                  <p className="text-sm mt-1" style={{ color: COLORS.slainteBlue }}>
                    Capitation rates vary by age: Under 6 (€156/qtr), 6-7 (€66.70), 8-69 (€44.43), 70+ (€273.38)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                      Under 6 years (GMS + DVC)
                      <AutoFilledBadge field="under6" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.under6}
                      onChange={(e) => updateField('demographics', 'under6', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: autoFilledFields.has('under6') ? COLORS.success : COLORS.borderLight }}
                      placeholder="e.g., 274"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                      Age 6-7 years
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.age6to7}
                      onChange={(e) => updateField('demographics', 'age6to7', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: COLORS.borderLight }}
                      placeholder="e.g., 205"
                    />
                    {csvResult?.success && csvResult.data.demographics.age6to9 > 0 && (
                      <p className="text-xs mt-1 flex items-start gap-1" style={{ color: COLORS.warningText }}>
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        Socrates groups ages 6-9 together ({csvResult.data.demographics.age6to9} patients). Enter the 6-7 count manually if known.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                      Over 70 years (GMS + DVC)
                      <AutoFilledBadge field="over70" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.over70}
                      onChange={(e) => updateField('demographics', 'over70', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: autoFilledFields.has('over70') ? COLORS.success : COLORS.borderLight }}
                      placeholder="e.g., 950"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                      Nursing Home Residents
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.nursingHomeResidents}
                      onChange={(e) => updateField('demographics', 'nursingHomeResidents', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: COLORS.borderLight }}
                      placeholder="e.g., 12"
                    />
                    {csvResult?.success && (
                      <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                        Not available from the report — enter manually.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cervical Screening Section (merged from old Step 4) */}
              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.errorLighter, borderLeft: '4px solid #EC4899' }}>
                  <h4 className="font-semibold" style={{ color: COLORS.errorText }}>
                    Cervical Screening Eligibility
                  </h4>
                  <p className="text-sm mt-1" style={{ color: COLORS.errorDark }}>
                    All women aged 25-65 are eligible. Screening interval: 3 years (25-44), 5 years (45-65). Rate: €65.00 per smear.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                      Eligible Women (aged 25-44)
                      <AutoFilledBadge field="eligibleWomen25to44" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.cervicalCheckActivity.eligibleWomen25to44}
                      onChange={(e) => updateField('cervicalCheckActivity', 'eligibleWomen25to44', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: autoFilledFields.has('eligibleWomen25to44') ? COLORS.success : COLORS.borderLight }}
                      placeholder="e.g., 1450"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                      Eligible Women (aged 45-65)
                      <AutoFilledBadge field="eligibleWomen45to65" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.cervicalCheckActivity.eligibleWomen45to65}
                      onChange={(e) => updateField('cervicalCheckActivity', 'eligibleWomen45to65', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: autoFilledFields.has('eligibleWomen45to65') ? COLORS.success : COLORS.borderLight }}
                      placeholder="e.g., 1237"
                    />
                  </div>
                </div>

                {/* Note about auto-calculated smears */}
                <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                  <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                    <strong>Auto-calculated from PCRS:</strong> Smears performed count is automatically extracted from your uploaded PCRS PDFs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Practice Support - Staff Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                <h3 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>
                  2. Practice Support Subsidies
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                Staff details are used to verify subsidy claims and detect incorrect pay scales. Years of experience helps identify if staff are on the correct increment point.
              </p>

              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.successLight, borderLeft: `4px solid ${COLORS.success}` }}>
                  <h4 className="font-semibold" style={{ color: COLORS.successText }}>
                    Staff Details (Secretaries, Nurses, Practice Manager)
                  </h4>
                  <p className="text-sm mt-1" style={{ color: COLORS.successText }}>
                    Subsidy entitlement is based on panel size × staff ratios. PCRS subsidises up to 35 hours/week per staff member.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addStaffMember}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: COLORS.slainteBlue }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Staff
                  </button>
                </div>

                {formData.staffDetails.length > 0 ? (
                  <div className="space-y-3">
                    {formData.staffDetails.map((staff, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 relative"
                        style={{
                          borderColor: (staff.fromProfile || staff.fromPCRS) ? COLORS.slainteBlue : COLORS.borderLight,
                          backgroundColor: (staff.fromProfile || staff.fromPCRS) ? `${COLORS.slainteBlue}08` : 'white'
                        }}
                      >
                        {/* Source badges */}
                        <div className="absolute top-2 right-10 flex gap-1">
                          {staff.fromProfile && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORS.incomeColor, color: 'white' }}
                            >
                              From Profile
                            </span>
                          )}
                          {staff.fromPCRS && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: COLORS.slainteBlue, color: 'white' }}
                            >
                              From PCRS
                            </span>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeStaffMember(index)}
                          className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100"
                          style={{ color: COLORS.textSecondary }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <div className="grid grid-cols-6 gap-3">
                          {/* First Name */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                              First Name
                            </label>
                            <input
                              type="text"
                              value={staff.firstName}
                              onChange={(e) => updateStaffMember(index, 'firstName', e.target.value)}
                              className="w-full p-2 border rounded text-sm"
                              style={{
                                borderColor: COLORS.borderLight,
                                backgroundColor: (staff.fromProfile || staff.fromPCRS) ? COLORS.bgHover : 'white'
                              }}
                              placeholder="Jane"
                              disabled={staff.fromProfile || staff.fromPCRS}
                            />
                          </div>

                          {/* Surname */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                              Surname
                            </label>
                            <input
                              type="text"
                              value={staff.surname}
                              onChange={(e) => updateStaffMember(index, 'surname', e.target.value)}
                              className="w-full p-2 border rounded text-sm"
                              style={{
                                borderColor: COLORS.borderLight,
                                backgroundColor: (staff.fromProfile || staff.fromPCRS) ? COLORS.bgHover : 'white'
                              }}
                              placeholder="Smith"
                              disabled={staff.fromProfile || staff.fromPCRS}
                            />
                          </div>

                          {/* Staff Type */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                              Role
                            </label>
                            <select
                              value={staff.staffType}
                              onChange={(e) => updateStaffMember(index, 'staffType', e.target.value)}
                              className="w-full p-2 border rounded text-sm"
                              style={{
                                borderColor: COLORS.borderLight,
                                backgroundColor: staff.fromProfile ? COLORS.bgHover : 'white'
                              }}
                              disabled={staff.fromProfile}
                            >
                              <option value="secretary">Secretary</option>
                              <option value="nurse">Nurse</option>
                              <option value="practiceManager">Practice Manager</option>
                              <option value="unknown">Unknown</option>
                            </select>
                          </div>

                          {/* Increment Point (from PCRS) - Always read-only */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                              Incr. Point (PCRS)
                            </label>
                            <input
                              type="number"
                              value={staff.incrementPoint || '-'}
                              className="w-full p-2 border rounded text-sm"
                              style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgHover, color: COLORS.textSecondary }}
                              disabled={true}
                              title="Extracted from PCRS data"
                            />
                          </div>

                          {/* Years Experience - Dropdown with role-appropriate max values */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
                              Years Exp. *
                            </label>
                            {staff.staffType === 'practiceManager' ? (
                              // Practice Manager: Fixed at 1, no edit option
                              <input
                                type="text"
                                value="1"
                                className="w-full p-2 border rounded text-sm"
                                style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgHover, color: COLORS.textSecondary }}
                                disabled={true}
                                title="Practice Manager has only 1 increment point on the pay scale"
                              />
                            ) : (
                              // Nurses: 1-5+, Secretaries: 1-3+
                              <select
                                value={staff.yearsExperience}
                                onChange={(e) => updateStaffMember(index, 'yearsExperience', e.target.value)}
                                className="w-full p-2 border-2 rounded text-sm"
                                style={{ borderColor: COLORS.slainteBlue }}
                              >
                                <option value="">Select...</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">{staff.staffType === 'secretary' ? '3+' : '3'}</option>
                                {staff.staffType !== 'secretary' && (
                                  <>
                                    <option value="4">4</option>
                                    <option value="5">5+</option>
                                  </>
                                )}
                              </select>
                            )}
                          </div>

                          {/* Actual Hours Worked - ALWAYS EDITABLE */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
                              Hrs/Week *
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="50"
                              step="0.5"
                              value={staff.actualHoursWorked || staff.weeklyHours || ''}
                              onChange={(e) => updateStaffMember(index, 'actualHoursWorked', e.target.value)}
                              className="w-full p-2 border-2 rounded text-sm"
                              style={{ borderColor: COLORS.slainteBlue }}
                              placeholder={staff.weeklyHours ? `${staff.weeklyHours}` : '39'}
                            />
                          </div>
                        </div>

                        {/* Warning if years experience suggests wrong increment */}
                        {staff.yearsExperience && staff.staffType !== 'practiceManager' && (() => {
                          const yearsExp = parseInt(staff.yearsExperience);
                          const incPoint = parseInt(staff.incrementPoint) || 1;
                          // Secretary max is 3, Nurse max is 5 (mapped as 4 in PCRS increment points)
                          const maxPoint = staff.staffType === 'secretary' ? 3 : (staff.staffType === 'nurse' ? 4 : 3);
                          const expectedPoint = Math.min(yearsExp, maxPoint);

                          if (yearsExp > incPoint && incPoint < maxPoint) {
                            return (
                              <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: COLORS.warningDark }}>
                                <AlertCircle className="h-4 w-4" />
                                <span>
                                  {yearsExp >= maxPoint ? `${maxPoint}+` : yearsExp} years experience but on increment point {incPoint}
                                  {' - should be point '}{Math.min(expectedPoint, maxPoint)}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed rounded-lg p-6 text-center" style={{ borderColor: COLORS.borderLight }}>
                    <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                      No staff members detected from PCRS PDFs.
                    </p>
                    <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                      Upload PCRS PDFs or add staff manually to analyze Practice Support subsidies.
                    </p>
                    <button
                      type="button"
                      onClick={addStaffMember}
                      className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium mx-auto"
                      style={{ backgroundColor: COLORS.bgPage, color: COLORS.textPrimary }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Staff Member
                    </button>
                  </div>
                )}

                <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                  * Years experience is used to check if staff are on the correct pay scale (increment point).
                  This helps identify potential additional subsidies you may be entitled to.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Chronic Disease Management */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Stethoscope className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                <h3 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>
                  3. Chronic Disease Management
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                Enter your disease register counts from your EHR. This is used to calculate potential CDM, Prevention Programme, and OCF income.
              </p>

              {/* Disease Registers - CDM Treatment Programme */}
              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.slainteBlueLight, borderLeft: `4px solid ${COLORS.slainteBlue}` }}>
                  <h4 className="font-semibold" style={{ color: COLORS.infoText }}>
                    CDM Treatment Programme (Established Disease)
                  </h4>
                  <p className="text-sm mt-1" style={{ color: COLORS.slainteBlue }}>
                    GMS/DVC patients aged 18+ with established chronic conditions. Eligible for 2 structured reviews per year (AO/AP/AQ codes: €165-€205 per review).
                  </p>
                </div>

                {/* CDM Disease Fields */}
                <div className="space-y-3">
                  <DiseaseField
                    id="type2Diabetes"
                    label="Type 2 Diabetes"
                    placeholder="e.g., 342"
                    value={formData.diseaseRegisters.type2Diabetes}
                    onChange={(e) => updateField('diseaseRegisters', 'type2Diabetes', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('type2Diabetes')}
                  />
                  <DiseaseField
                    id="asthma"
                    label="Asthma (All ages)"
                    placeholder="e.g., 280"
                    value={formData.diseaseRegisters.asthma}
                    onChange={(e) => updateField('diseaseRegisters', 'asthma', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('asthma')}
                  />
                  <DiseaseField
                    id="copd"
                    label="COPD"
                    placeholder="e.g., 120"
                    value={formData.diseaseRegisters.copd}
                    onChange={(e) => updateField('diseaseRegisters', 'copd', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('copd')}
                  />
                  <DiseaseField
                    id="heartFailure"
                    label="Heart Failure"
                    placeholder="e.g., 85"
                    value={formData.diseaseRegisters.heartFailure}
                    onChange={(e) => updateField('diseaseRegisters', 'heartFailure', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('heartFailure')}
                  />
                  <DiseaseField
                    id="atrialFibrillation"
                    label="Atrial Fibrillation"
                    placeholder="e.g., 95"
                    value={formData.diseaseRegisters.atrialFibrillation}
                    onChange={(e) => updateField('diseaseRegisters', 'atrialFibrillation', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('atrialFibrillation')}
                  />
                  <DiseaseField
                    id="ihd"
                    label="Ischaemic Heart Disease (IHD)"
                    placeholder="e.g., 110"
                    value={formData.diseaseRegisters.ihd}
                    onChange={(e) => updateField('diseaseRegisters', 'ihd', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('ihd')}
                  />
                  <DiseaseField
                    id="stroke"
                    label="Stroke / TIA"
                    placeholder="e.g., 65"
                    value={formData.diseaseRegisters.stroke}
                    onChange={(e) => updateField('diseaseRegisters', 'stroke', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('stroke')}
                  />
                </div>

                {/* Prevention Programme Section */}
                <div className="mt-6 pt-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                  <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: COLORS.successLight, borderLeft: `4px solid ${COLORS.success}` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.successText }}>
                      Prevention Programme (High Risk / Pre-Disease)
                    </h4>
                    <p className="text-sm mt-1" style={{ color: COLORS.successText }}>
                      Annual review (€82 BB code) for patients at high risk of developing chronic disease. Multiple eligibility pathways available.
                    </p>
                  </div>

                  <PPField
                    id="hypertension"
                    label="Hypertension (18+ with diagnosis)"
                    placeholder="e.g., 450"
                    description="All GMS/DVC patients 18+ with hypertension diagnosis are PP eligible (since Phase 3, Nov 2023)"
                    value={formData.diseaseRegisters.hypertension}
                    onChange={(e) => updateField('diseaseRegisters', 'hypertension', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('hypertension')}
                  />
                  <PPField
                    id="preDiabetes"
                    label="Pre-Diabetes (45+)"
                    placeholder="e.g., 85"
                    description="GMS/DVC patients 45+ with pre-diabetes (HbA1c 42-47 mmol/mol)"
                    value={formData.diseaseRegisters.preDiabetes}
                    onChange={(e) => updateField('diseaseRegisters', 'preDiabetes', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('preDiabetes')}
                  />
                  <PPField
                    id="highCVDRisk"
                    label="High CVD Risk - QRISK ≥20% (45+)"
                    placeholder="e.g., 65"
                    description="GMS/DVC patients 45+ with QRISK3 score ≥20%"
                    value={formData.diseaseRegisters.highCVDRisk}
                    onChange={(e) => updateField('diseaseRegisters', 'highCVDRisk', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('highCVDRisk')}
                  />
                  <PPField
                    id="gestationalDMHistory"
                    label="History of Gestational Diabetes (Women 18+)"
                    placeholder="e.g., 25"
                    description="Women 18+ with history of gestational diabetes"
                    value={formData.diseaseRegisters.gestationalDMHistory}
                    onChange={(e) => updateField('diseaseRegisters', 'gestationalDMHistory', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('gestationalDMHistory')}
                  />
                  <PPField
                    id="preEclampsiaHistory"
                    label="History of Pre-eclampsia (Women 18+)"
                    placeholder="e.g., 15"
                    description="Women 18+ with history of pre-eclampsia"
                    value={formData.diseaseRegisters.preEclampsiaHistory}
                    onChange={(e) => updateField('diseaseRegisters', 'preEclampsiaHistory', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('preEclampsiaHistory')}
                  />
                </div>

                {/* OCF Section */}
                <div className="mt-6 pt-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                  <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: COLORS.warningLight, borderLeft: `4px solid ${COLORS.warning}` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.warningText }}>
                      Opportunistic Case Finding (OCF)
                    </h4>
                    <p className="text-sm mt-1" style={{ color: COLORS.warningDark }}>
                      One-off assessment (€60 BC code) for GMS/DVC patients 45+ with risk factors who are not yet on CDM or Prevention Programme.
                    </p>
                  </div>

                  <OCFField
                    id="ocfEligible"
                    label="OCF Eligible Patients (45+ with risk factors)"
                    placeholder="e.g., 180"
                    description="GMS/DVC patients 45+ with one or more risk factors, NOT already on CDM or Prevention Programme"
                    value={formData.diseaseRegisters.ocfEligible}
                    onChange={(e) => updateField('diseaseRegisters', 'ocfEligible', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={getCDMGuide('ocfEligible')}
                  />
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer with navigation - Fixed */}
        <div className="p-6 border-t flex justify-between flex-shrink-0" style={{ borderColor: COLORS.borderLight }}>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border font-medium transition-colors"
            style={{
              borderColor: COLORS.borderLight,
              color: COLORS.textSecondary
            }}
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 rounded border font-medium flex items-center gap-2 transition-colors hover:bg-gray-50"
                style={{
                  borderColor: COLORS.borderLight,
                  color: COLORS.textPrimary
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 rounded font-medium text-white flex items-center gap-2 transition-colors"
              style={{ backgroundColor: COLORS.slainteBlue }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              {currentStep === totalSteps ? (
                <>
                  <Check className="h-4 w-4" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
