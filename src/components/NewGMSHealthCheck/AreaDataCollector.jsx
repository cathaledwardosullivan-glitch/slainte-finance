import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Upload, Info, X, AlertCircle, Users, Edit3, Plus, UserPlus, Trash2, CheckSquare, Square, FileText, CheckCircle } from 'lucide-react';
import COLORS from '../../utils/colors';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import { suggestStaffDefaults, detectServicesFromClaims, estimateCDMContextFromClaims } from '../../utils/quickFillEngine';

/**
 * Map practice profile roles to staff type codes
 */
function mapRoleToStaffType(role) {
  if (!role) return 'unknown';
  const r = role.toLowerCase();
  if (r.includes('nurse') || r.includes('pn')) return 'nurse';
  if (r.includes('secret') || r.includes('admin') || r.includes('receptionist')) return 'secretary';
  if (r.includes('manager') || r === 'pm') return 'practiceManager';
  return 'unknown';
}

/**
 * Staff type display labels
 */
const STAFF_TYPE_LABELS = {
  secretary: 'Secretary',
  nurse: 'Nurse',
  practiceManager: 'Practice Manager',
  unknown: 'Unknown'
};

/**
 * Build detected staff list from PCRS data and practice profile
 */
function getDetectedStaff(paymentAnalysisData, practiceProfile) {
  const staffMap = new Map();

  // 1. Staff from practice profile (Cara onboarding)
  if (practiceProfile?.staff?.length > 0) {
    practiceProfile.staff.forEach(staff => {
      let firstName = staff.firstName || '';
      let surname = staff.surname || '';
      if (!firstName && !surname && staff.name) {
        const parts = staff.name.trim().split(' ');
        firstName = parts[0] || '';
        surname = parts.slice(1).join(' ') || '';
      }
      const key = `${surname.toLowerCase()}-${firstName.toLowerCase()}`;
      staffMap.set(key, {
        firstName, surname,
        staffType: mapRoleToStaffType(staff.role),
        incrementPoint: 1,
        weeklyHours: '',
        yearsExperience: '',
        actualHoursWorked: '',
        fromProfile: true,
        fromPCRS: false
      });
    });
  }

  // 2. Merge/enhance with PCRS data
  if (paymentAnalysisData?.length > 0) {
    paymentAnalysisData.forEach(entry => {
      if (entry.practiceSubsidy?.staff) {
        entry.practiceSubsidy.staff.forEach(staff => {
          const key = `${(staff.surname || '').toLowerCase()}-${(staff.firstName || '').toLowerCase()}`;
          if (staffMap.has(key)) {
            const existing = staffMap.get(key);
            staffMap.set(key, {
              ...existing,
              incrementPoint: staff.incrementPoint || existing.incrementPoint,
              weeklyHours: staff.weeklyHours || existing.weeklyHours,
              fromPCRS: true
            });
          } else {
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

  // 3. Apply suggested defaults from PCRS data (pre-populate empty fields)
  const staffList = Array.from(staffMap.values());
  return staffList.map(member => {
    const suggestions = suggestStaffDefaults(member);
    return {
      ...member,
      yearsExperience: member.yearsExperience || suggestions.yearsExperience || '',
      actualHoursWorked: member.actualHoursWorked || suggestions.actualHoursWorked || '',
      _suggestedYears: suggestions.yearsExperience,
      _suggestedHours: suggestions.actualHoursWorked
    };
  });
}

/**
 * ICPC-2 codes for CDM conditions
 */
const CDM_ICPC_CODES = {
  type2Diabetes: { code: 'T90', name: 'Type 2 Diabetes' },
  asthma: { code: 'R96', name: 'Asthma' },
  copd: { code: 'R95', name: 'COPD' },
  heartFailure: { code: 'K77', name: 'Heart Failure' },
  atrialFibrillation: { code: 'K78', name: 'Atrial Fibrillation' },
  ihd: { code: 'K74/K76', name: 'IHD' },
  strokeTIA: { code: 'K90', name: 'Stroke/TIA' },
  hypertension: { code: 'K86/K87', name: 'Hypertension' }
};

/**
 * Generate EHR-specific help text for CDM disease register fields
 */
function getCDMHelpText(field, ehrSystem) {
  const condition = CDM_ICPC_CODES[field];
  if (!condition) return null;

  const code = condition.code;

  switch (ehrSystem) {
    case 'socrates':
      return `ICPC-2: ${code}. In Socrates: Patient Finder → New List → CDM Registrations, or Reports → Patients with Multiple Conditions → Add ICPC-2 → ${code}`;
    case 'practicemanager':
      return `ICPC-2: ${code}. In HPM: Reports → Diagnosis Report → search "${code}", or Tasks → Claim Tracker → CDM Tracker`;
    case 'healthone':
      return `ICPC-2: ${code}. In HealthOne: use the CDM Dashboard, or Database Analysis → filter by condition`;
    case 'completegp':
      return `ICPC-2: ${code}. In CompleteGP: Search Tool → filter by condition code ${code} (ICPC-2 or ICD-10)`;
    default:
      return `ICPC-2 code: ${code}. Check your EHR disease register or run a diagnosis report for this condition`;
  }
}

/**
 * AreaDataCollector - Inline data collection form for each GMS area
 * Shows area-specific input fields and data status
 */
const AreaDataCollector = ({ areaId, readiness, healthCheckData, paymentAnalysisData, onUpdate }) => {
  const [showHelp, setShowHelp] = useState(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const { profile } = usePracticeProfile();

  // Save a field immediately
  const updateField = (section, field, value) => {
    const current = healthCheckData || {};
    const sectionData = current[section] || {};
    onUpdate({
      ...current,
      [section]: { ...sectionData, [field]: value }
    });
  };

  // Numeric input helper
  const numInput = (section, field, label, helpText) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 500, color: COLORS.textPrimary }}>{label}</label>
        {helpText && (
          <button
            onClick={() => setShowHelp(showHelp === field ? null : field)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: COLORS.slainteBlue, display: 'flex'
            }}
          >
            <Info size={13} />
          </button>
        )}
      </div>
      {showHelp === field && helpText && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textSecondary, fontStyle: 'italic' }}>
          {helpText}
        </p>
      )}
      <input
        type="number"
        min="0"
        value={healthCheckData?.[section]?.[field] || ''}
        onChange={(e) => updateField(section, field, parseInt(e.target.value) || 0)}
        style={{
          padding: '0.4rem 0.6rem',
          borderRadius: '0.375rem',
          border: `1px solid ${COLORS.borderLight}`,
          fontSize: '0.875rem',
          width: '100%',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );

  // --- Leave ---
  if (areaId === 'leave') {
    return (
      <div style={{ padding: '1rem', backgroundColor: COLORS.bgPage, borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: COLORS.textPrimary }}>
          Leave data is extracted automatically from your GMS PDFs.
        </p>
        {readiness.status === 'no-data' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textSecondary, fontSize: '0.85rem' }}>
            <Upload size={16} />
            Upload GMS PDFs from the GMS Dashboard to populate leave data.
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.success, fontWeight: 500 }}>
            Leave data available from uploaded PDFs.
          </p>
        )}
      </div>
    );
  }

  // --- Practice Support ---
  if (areaId === 'practiceSupport') {
    return (
      <PracticeSupportCollector
        readiness={readiness}
        healthCheckData={healthCheckData}
        paymentAnalysisData={paymentAnalysisData}
        profile={profile}
        onUpdate={onUpdate}
        staffModalOpen={staffModalOpen}
        setStaffModalOpen={setStaffModalOpen}
      />
    );
  }

  // --- Capitation ---
  if (areaId === 'capitation') {
    return (
      <CapitationCollector
        readiness={readiness}
        healthCheckData={healthCheckData}
        onUpdate={onUpdate}
        profile={profile}
        numInput={numInput}
      />
    );
  }

  // --- Cervical Check ---
  if (areaId === 'cervicalCheck') {
    const monthsAvailable = readiness.dataAvailable?.monthsAvailable || 0;
    const isSocrates = profile?.practiceDetails?.ehrSystem === 'socrates';
    const hasCervicalData = (healthCheckData?.cervicalCheckActivity?.eligibleWomen25to44 || 0) > 0;
    return (
      <div style={{ padding: '1rem', backgroundColor: COLORS.bgPage, borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 500, color: COLORS.textPrimary }}>
          Eligible women counts from your EHR
        </p>
        {isSocrates && !hasCervicalData && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: COLORS.slainteBlue, fontStyle: 'italic' }}>
            Tip: Upload your Socrates CSV from the Health Check overview page to auto-fill these fields.
          </p>
        )}
        {isSocrates && hasCervicalData && healthCheckData?.demographics?.under6 > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginBottom: '0.5rem', fontSize: '0.75rem', color: COLORS.slainteBlue
          }}>
            <CheckCircle size={12} />
            <span>Auto-filled from Socrates CSV</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {numInput('cervicalCheckActivity', 'eligibleWomen25to44', 'Eligible women 25-44', 'All female patients aged 25-44 (GMS, DVC and private — CervicalCheck is open to all women)')}
          {numInput('cervicalCheckActivity', 'eligibleWomen45to65', 'Eligible women 45-65', 'All female patients aged 45-65 (GMS, DVC and private — CervicalCheck is open to all women)')}
        </div>
        {/* Data completeness indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.75rem', backgroundColor: COLORS.white, borderRadius: '0.25rem',
          border: `1px solid ${COLORS.borderLight}`, fontSize: '0.8rem'
        }}>
          <div style={{
            flex: 1, height: '6px', backgroundColor: COLORS.borderLight, borderRadius: '3px', overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min(100, (monthsAvailable / 12) * 100)}%`,
              height: '100%',
              backgroundColor: monthsAvailable >= 12 ? COLORS.success : COLORS.warning,
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ color: COLORS.textSecondary, whiteSpace: 'nowrap' }}>
            {monthsAvailable}/12 months
          </span>
        </div>
      </div>
    );
  }

  // --- STC ---
  if (areaId === 'stc') {
    return (
      <STCServicesCollector
        readiness={readiness}
        healthCheckData={healthCheckData}
        paymentAnalysisData={paymentAnalysisData}
        onUpdate={onUpdate}
      />
    );
  }

  // --- CDM ---
  if (areaId === 'cdm') {
    const ehr = profile?.practiceDetails?.ehrSystem;
    const ehrLabel = ehr === 'socrates' ? 'Socrates' : ehr === 'practicemanager' ? 'HPM' : ehr === 'healthone' ? 'HealthOne' : ehr === 'completegp' ? 'CompleteGP' : null;
    const cdmContext = useMemo(() => estimateCDMContextFromClaims(paymentAnalysisData), [paymentAnalysisData]);

    return (
      <div style={{ padding: '1rem', backgroundColor: COLORS.bgPage, borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 500, color: COLORS.textPrimary }}>
          Enter disease register counts from your EHR
        </p>

        {/* CDM context banner from PCRS claims */}
        {cdmContext.hasData && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            padding: '0.6rem 0.75rem', marginBottom: '0.75rem',
            backgroundColor: `${COLORS.slainteBlue}08`, borderRadius: '0.375rem',
            border: `1px solid ${COLORS.slainteBlue}25`
          }}>
            <Info size={15} color={COLORS.slainteBlue} style={{ marginTop: '1px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', color: COLORS.textPrimary }}>
              <span>Your PCRS data shows <strong>{cdmContext.totalCDMReviews}</strong> CDM review claim{cdmContext.totalCDMReviews !== 1 ? 's' : ''}</span>
              {cdmContext.estimatedEnrolled > 0 && (
                <span>, suggesting at least <strong>~{cdmContext.estimatedEnrolled}</strong> patients enrolled</span>
              )}
              <span>.</span>
              {cdmContext.ppReviews > 0 && (
                <span> Plus <strong>{cdmContext.ppReviews}</strong> Prevention Programme review{cdmContext.ppReviews !== 1 ? 's' : ''}.</span>
              )}
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                Enter your disease register counts below to identify specific growth opportunities.
              </p>
            </div>
          </div>
        )}

        {ehrLabel && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.slainteBlue }}>
            Tap <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Info size={10} /></span> on each field for {ehrLabel}-specific guidance on finding the data
          </p>
        )}
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: COLORS.textSecondary }}>
          CDM Treatment Programme conditions
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {numInput('diseaseRegisters', 'type2Diabetes', 'Type 2 Diabetes', getCDMHelpText('type2Diabetes', ehr))}
          {numInput('diseaseRegisters', 'asthma', 'Asthma', getCDMHelpText('asthma', ehr))}
          {numInput('diseaseRegisters', 'copd', 'COPD', getCDMHelpText('copd', ehr))}
          {numInput('diseaseRegisters', 'heartFailure', 'Heart Failure', getCDMHelpText('heartFailure', ehr))}
          {numInput('diseaseRegisters', 'atrialFibrillation', 'Atrial Fibrillation', getCDMHelpText('atrialFibrillation', ehr))}
          {numInput('diseaseRegisters', 'ihd', 'IHD', getCDMHelpText('ihd', ehr))}
          {numInput('diseaseRegisters', 'strokeTIA', 'Stroke/TIA', getCDMHelpText('strokeTIA', ehr))}
        </div>
        <p style={{ margin: '0.5rem 0 0.75rem', fontSize: '0.8rem', color: COLORS.textSecondary }}>
          Prevention Programme conditions
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {numInput('diseaseRegisters', 'hypertension', 'Hypertension', getCDMHelpText('hypertension', ehr))}
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Core STC-eligible services grouped by category.
 * Used on the data collection page to ask which services the practice provides.
 * The `codes` field maps each service to gmsRates.stc.codes for analysis integration.
 */
const STC_SERVICE_GROUPS = [
  {
    heading: 'Diagnostics',
    color: COLORS.chartViolet,
    services: [
      { id: 'ecg', label: 'ECG', codes: ['F'] },
      { id: 'abpm', label: '24hr ABPM', codes: ['AD'] }
    ]
  },
  {
    heading: 'Minor Surgery & Procedures',
    color: COLORS.slainteBlue,
    services: [
      { id: 'skinExcision', label: 'Skin excisions / cryotherapy', codes: ['A'] },
      { id: 'suturing', label: 'Suturing', codes: ['B'] },
      { id: 'catheterisation', label: 'Bladder catheterisation', codes: ['L'] },
      { id: 'nebuliser', label: 'Nebuliser treatment', codes: ['K'] },
      { id: 'phlebotomy', label: 'Therapeutic phlebotomy', codes: ['AL'] }
    ]
  },
  {
    heading: 'Contraception & LARC',
    color: COLORS.chartPink,
    services: [
      { id: 'contraceptionConsult', label: 'Contraception consultations', codes: ['CF', 'CL'] },
      { id: 'larcImplantFitting', label: 'LARC implant fitting', codes: ['CG', 'CO'] },
      { id: 'larcCoilFitting', label: 'LARC coil fitting', codes: ['CH', 'CM'] },
      { id: 'larcRemoval', label: 'LARC removal (implant or coil)', codes: ['CI', 'CJ', 'CN', 'CQ', 'AC'] },
      { id: 'larcFollowUp', label: 'Post-LARC follow-up', codes: ['CK'] }
    ]
  },
  {
    heading: 'Paediatric (Under 8s)',
    color: COLORS.warning,
    services: [
      { id: 'paediatricForeignBody', label: 'Foreign body removal', codes: ['X'] },
      { id: 'paediatricSuturing', label: 'Suturing', codes: ['Y'] },
      { id: 'paediatricAbscess', label: 'Abscess drainage', codes: ['Z'] }
    ]
  }
];

/**
 * CapitationCollector - Demographics form with optional Socrates CSV Quick Fill
 * The CSV upload fills Capitation, Cervical Check, and STC demographics sections at once.
 */
const CapitationCollector = ({ readiness, healthCheckData, onUpdate, profile, numInput }) => {
  const ehrSystem = profile?.practiceDetails?.ehrSystem;
  const isSocrates = ehrSystem === 'socrates';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Non-Socrates EHR note */}
      {!isSocrates && ehrSystem && (
        <div style={{
          padding: '0.5rem 0.75rem', backgroundColor: COLORS.bgPage,
          borderRadius: '0.375rem', border: `1px solid ${COLORS.borderLight}`,
          fontSize: '0.78rem', color: COLORS.textSecondary
        }}>
          Manual entry required — see the help icons for guidance on finding this data in your EHR.
        </div>
      )}

      {/* Demographics form */}
      <div style={{ padding: '1rem', backgroundColor: COLORS.bgPage, borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 500, color: COLORS.textPrimary }}>
          Patient demographics from your EHR system
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {numInput('demographics', 'under6', 'Under 6 years', 'Run an age search in your EHR for patients aged 0-5')}
          {numInput('demographics', 'over70', 'Over 70 years', 'Run an age search in your EHR for patients aged 70+')}
          {numInput('demographics', 'nursingHomeResidents', 'Nursing home residents', 'Count of GMS patients residing in nursing homes (manual entry only)')}
        </div>
        {healthCheckData?.demographics?.under6 > 0 && healthCheckData?.demographics?.over70 > 0 && isSocrates && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: COLORS.slainteBlue, fontStyle: 'italic' }}>
            Under 6 and Over 70 auto-filled from Socrates CSV. Nursing home residents must be entered manually.
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * STCDemographicsSection - Optional female demographic inputs for deriving contraception benchmarks
 */
const STCDemographicsSection = ({ healthCheckData, onUpdate }) => {
  const stcDemographics = healthCheckData?.stcDemographics || {};
  const hasData = stcDemographics.gmsFemale17to35 > 0 || stcDemographics.gmsFemale36to44 > 0;

  const updateDemographic = (field, value) => {
    const numVal = value === '' ? '' : parseInt(value, 10);
    if (value !== '' && isNaN(numVal)) return;
    const current = healthCheckData || {};
    onUpdate({
      ...current,
      stcDemographics: {
        ...current.stcDemographics,
        [field]: numVal
      }
    });
  };

  return (
    <div style={{
      padding: '0.6rem 0.75rem',
      backgroundColor: COLORS.warningLighter,
      borderRadius: '0.375rem',
      border: `1px solid ${COLORS.warningLight}`
    }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', fontWeight: 500, color: COLORS.textPrimary }}>
        Female patient demographics (optional)
      </p>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
        Two contraception schemes with different eligibility: Free Contraception Scheme (all women 17-35) and GMS/DVC scheme (GMS cardholders 36-44).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.2rem' }}>
            All women 17-35
          </label>
          <input
            type="number"
            min="0"
            value={stcDemographics.gmsFemale17to35 ?? ''}
            onChange={(e) => updateDemographic('gmsFemale17to35', e.target.value)}
            placeholder="0"
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              fontSize: '0.85rem',
              borderRadius: '0.3rem',
              border: `1px solid ${COLORS.borderLight}`,
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.2rem' }}>
            GMS women 36-44
          </label>
          <input
            type="number"
            min="0"
            value={stcDemographics.gmsFemale36to44 ?? ''}
            onChange={(e) => updateDemographic('gmsFemale36to44', e.target.value)}
            placeholder="0"
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              fontSize: '0.85rem',
              borderRadius: '0.3rem',
              border: `1px solid ${COLORS.borderLight}`,
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
      {hasData && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: COLORS.warningText }}>
          These demographics will be used for practice-specific contraception benchmarks.
        </p>
      )}
    </div>
  );
};

/**
 * STCServicesCollector - Compact grouped grid of STC services with checkboxes
 * Auto-detects services from PCRS claim codes when paymentAnalysisData is available
 */
const STCServicesCollector = ({ readiness, healthCheckData, paymentAnalysisData, onUpdate }) => {
  const monthsAvailable = readiness?.dataAvailable?.monthsAvailable || 0;
  const servicesProvided = healthCheckData?.stcServices || {};

  // Auto-detect services from PCRS claims
  const { detectedServices, hasData: hasPCRSData } = useMemo(
    () => detectServicesFromClaims(paymentAnalysisData),
    [paymentAnalysisData]
  );

  // Auto-apply detected services on first load (only if stcServices is empty)
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (!autoAppliedRef.current && hasPCRSData && Object.keys(detectedServices).length > 0) {
      const existingServices = healthCheckData?.stcServices || {};
      const hasExistingSelections = Object.values(existingServices).some(v => v === true);
      if (!hasExistingSelections) {
        const current = healthCheckData || {};
        onUpdate({
          ...current,
          stcServices: { ...detectedServices }
        });
      }
      autoAppliedRef.current = true;
    }
  }, [hasPCRSData, detectedServices]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleService = (serviceId) => {
    const current = healthCheckData || {};
    const currentServices = current.stcServices || {};
    onUpdate({
      ...current,
      stcServices: {
        ...currentServices,
        [serviceId]: !currentServices[serviceId]
      }
    });
  };

  const allServices = STC_SERVICE_GROUPS.flatMap(g => g.services);
  const checkedCount = allServices.filter(s => servicesProvided[s.id]).length;
  const detectedCount = Object.keys(detectedServices).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textPrimary }}>
        Which of these services does your practice currently provide?
      </p>

      {detectedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.75rem', backgroundColor: `${COLORS.slainteBlue}08`,
          borderRadius: '0.375rem', border: `1px solid ${COLORS.slainteBlue}25`
        }}>
          <CheckCircle size={14} color={COLORS.slainteBlue} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: COLORS.slainteBlue }}>
            {detectedCount} service{detectedCount !== 1 ? 's' : ''} detected from your PCRS claim data
          </span>
        </div>
      )}

      {STC_SERVICE_GROUPS.map((group) => (
        <div key={group.heading}>
          <p style={{
            margin: '0 0 0.35rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: group.color,
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}>
            {group.heading}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.3rem'
          }}>
            {group.services.map((service) => {
              const isChecked = !!servicesProvided[service.id];
              const isDetected = !!detectedServices[service.id];
              return (
                <button
                  key={service.id}
                  onClick={() => toggleService(service.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: isChecked ? COLORS.successLight : COLORS.white,
                    borderRadius: '0.375rem',
                    border: `1px solid ${isChecked ? COLORS.successLighter : COLORS.borderLight}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left'
                  }}
                >
                  {isChecked ? (
                    <CheckSquare size={15} color={COLORS.success} style={{ flexShrink: 0 }} />
                  ) : (
                    <Square size={15} color={COLORS.textSecondary} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: '0.825rem',
                    fontWeight: isChecked ? 600 : 400,
                    color: isChecked ? COLORS.successText : COLORS.textPrimary,
                    flex: 1
                  }}>
                    {service.label}
                  </span>
                  {isDetected && isChecked && (
                    <span style={{
                      fontSize: '0.6rem', padding: '0.1rem 0.35rem',
                      backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue,
                      borderRadius: '0.2rem', fontWeight: 500, whiteSpace: 'nowrap'
                    }}>
                      PCRS
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {checkedCount > 0 && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.successText, fontWeight: 500 }}>
          {checkedCount} of {allServices.length} services selected
        </p>
      )}

      {/* Female demographics for contraception benchmarking */}
      <STCDemographicsSection healthCheckData={healthCheckData} onUpdate={onUpdate} />

      {/* PCRS data progress bar */}
      <div style={{
        padding: '0.6rem 0.75rem',
        backgroundColor: COLORS.bgPage,
        borderRadius: '0.375rem',
        border: `1px solid ${COLORS.borderLight}`
      }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 500, color: COLORS.textPrimary }}>
          PCRS claim data
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.8rem'
        }}>
          <div style={{
            flex: 1, height: '6px', backgroundColor: COLORS.borderLight, borderRadius: '3px', overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min(100, (monthsAvailable / 12) * 100)}%`,
              height: '100%',
              backgroundColor: monthsAvailable >= 12 ? COLORS.success : COLORS.warning,
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ color: COLORS.textSecondary, whiteSpace: 'nowrap' }}>
            {monthsAvailable}/12 months
          </span>
        </div>
        {monthsAvailable < 12 && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: COLORS.warning }}>
            Upload more GMS PDFs for full benchmarking analysis.
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * PracticeSupportCollector - Clickable card that opens a staff editing modal
 */
const PracticeSupportCollector = ({
  readiness, healthCheckData, paymentAnalysisData, profile, onUpdate,
  staffModalOpen, setStaffModalOpen
}) => {
  // Initialize staff list: use saved healthCheckData.staffDetails if available,
  // otherwise detect from PCRS + profile
  const initialStaff = useMemo(() => {
    if (healthCheckData?.staffDetails?.length > 0) {
      return healthCheckData.staffDetails;
    }
    return getDetectedStaff(paymentAnalysisData, profile);
  }, [healthCheckData?.staffDetails, paymentAnalysisData, profile]);

  const [localStaff, setLocalStaff] = useState(initialStaff);

  // Persist the full staff list
  const persistStaff = useCallback((updatedList) => {
    const current = healthCheckData || {};
    onUpdate({ ...current, staffDetails: updatedList });
  }, [healthCheckData, onUpdate]);

  // Update a single staff member field and persist
  const updateStaffField = useCallback((index, field, value) => {
    setLocalStaff(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      persistStaff(updated);
      return updated;
    });
  }, [persistStaff]);

  // Add a new staff member
  const addStaffMember = useCallback((newMember) => {
    setLocalStaff(prev => {
      const updated = [...prev, newMember];
      persistStaff(updated);
      return updated;
    });
  }, [persistStaff]);

  // Remove a manually-added staff member
  const removeStaffMember = useCallback((index) => {
    setLocalStaff(prev => {
      const updated = prev.filter((_, i) => i !== index);
      persistStaff(updated);
      return updated;
    });
  }, [persistStaff]);

  // Split staff into PCRS-subsidised and other eligible
  const pcrsStaff = localStaff.filter(s => s.fromPCRS);
  const otherStaff = localStaff.filter(s => !s.fromPCRS);

  // Count staff with experience data filled (only count eligible types)
  const eligibleStaff = localStaff.filter(s => s.staffType && s.staffType !== 'unknown');
  const filledCount = eligibleStaff.filter(s =>
    (s.yearsExperience && parseInt(s.yearsExperience) > 0) ||
    (s.actualHoursWorked && parseFloat(s.actualHoursWorked) > 0)
  ).length;
  const totalCount = eligibleStaff.length;
  const allFilled = totalCount > 0 && filledCount === totalCount;

  // Build summary text
  const staffSummary = useMemo(() => {
    if (totalCount === 0) return 'No eligible staff detected';
    const types = {};
    eligibleStaff.forEach(s => {
      const label = STAFF_TYPE_LABELS[s.staffType] || 'Other';
      types[label] = (types[label] || 0) + 1;
    });
    return Object.entries(types).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`).join(', ');
  }, [eligibleStaff, totalCount]);

  // Additional detail: how many are not on PCRS
  const notOnPCRSCount = otherStaff.filter(s => s.staffType && s.staffType !== 'unknown').length;

  return (
    <>
      {/* Clickable card */}
      <button
        onClick={() => setStaffModalOpen(true)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '1rem',
          backgroundColor: COLORS.bgPage,
          borderRadius: '0.5rem',
          border: `1px solid ${readiness.dataAvailable?.hasStaffExperience ? COLORS.successLighter : COLORS.slainteBlue}`,
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = COLORS.slainteBlue;
          e.currentTarget.style.boxShadow = `0 0 0 2px ${COLORS.slainteBlue}30`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = readiness.dataAvailable?.hasStaffExperience ? COLORS.successLighter : COLORS.slainteBlue;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={20} color={COLORS.slainteBlue} />
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
                {staffSummary}
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: COLORS.textSecondary }}>
                {allFilled
                  ? 'Experience and hours entered for all staff'
                  : `${filledCount}/${totalCount} staff members have experience/hours entered`
                }
              </p>
              {notOnPCRSCount > 0 && (
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: COLORS.warningDark, fontWeight: 500 }}>
                  {notOnPCRSCount} staff not currently receiving PCRS subsidy
                </p>
              )}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            backgroundColor: COLORS.slainteBlue,
            color: COLORS.white,
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            fontWeight: 500
          }}>
            <Edit3 size={14} />
            Edit
          </div>
        </div>
      </button>

      {/* Staff Editing Modal */}
      {staffModalOpen && (
        <StaffEditModal
          staff={localStaff}
          pcrsStaff={pcrsStaff}
          otherStaff={otherStaff}
          onUpdateField={updateStaffField}
          onAddStaff={addStaffMember}
          onRemoveStaff={removeStaffMember}
          onClose={() => setStaffModalOpen(false)}
        />
      )}
    </>
  );
};

/**
 * StaffEditModal - Two-section modal for complete staff data collection
 * Section 1: Staff receiving PCRS subsidies (verify hours/experience/increment)
 * Section 2: Other eligible staff not on PCRS (potential missed income)
 * Plus: Add new staff member form
 */
const StaffEditModal = ({ staff, pcrsStaff, otherStaff, onUpdateField, onAddStaff, onRemoveStaff, onClose }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newSurname, setNewSurname] = useState('');
  const [newRole, setNewRole] = useState('');

  const handleAddStaff = () => {
    if (!newFirstName.trim() || !newSurname.trim() || !newRole) return;
    onAddStaff({
      firstName: newFirstName.trim(),
      surname: newSurname.trim(),
      staffType: newRole,
      incrementPoint: 1,
      weeklyHours: '',
      yearsExperience: '',
      actualHoursWorked: '',
      fromProfile: false,
      fromPCRS: false,
      manuallyAdded: true
    });
    setNewFirstName('');
    setNewSurname('');
    setNewRole('');
    setShowAddForm(false);
  };

  // Get real index in full staff array for a member
  const getStaffIndex = (member) => staff.indexOf(member);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: COLORS.overlayDark
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '42rem',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${COLORS.borderLight}`
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.05rem', color: COLORS.textPrimary }}>
              Staff Details
            </h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: COLORS.textSecondary }}>
              Review all staff to identify unclaimed subsidies and missed income
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.35rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: '0.25rem',
              color: COLORS.textSecondary
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div style={{
          padding: '1rem 1.25rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {staff.length === 0 && !showAddForm ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: COLORS.textSecondary,
              fontSize: '0.875rem',
              border: `1px dashed ${COLORS.borderLight}`,
              borderRadius: '0.5rem'
            }}>
              <p style={{ margin: '0 0 0.75rem' }}>No staff members detected.</p>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>
                Upload GMS PDFs to auto-detect subsidised staff, or add staff manually below.
              </p>
            </div>
          ) : (
            <>
              {/* === Section 1: PCRS Subsidised Staff === */}
              {pcrsStaff.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: COLORS.slainteBlue
                    }} />
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: COLORS.textPrimary }}>
                      Staff Receiving PCRS Subsidies
                    </h4>
                    <span style={{
                      padding: '0.1rem 0.4rem', backgroundColor: `${COLORS.slainteBlue}15`,
                      borderRadius: '0.25rem', fontSize: '0.7rem', color: COLORS.slainteBlue, fontWeight: 500
                    }}>
                      {pcrsStaff.length}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                    Verify experience and hours to check increment points and identify unclaimed hours.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {pcrsStaff.map((member) => (
                      <StaffMemberCard
                        key={`pcrs-${member.firstName}-${member.surname}`}
                        member={member}
                        index={getStaffIndex(member)}
                        onUpdateField={onUpdateField}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* === Section 2: Other Eligible Staff === */}
              {otherStaff.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: COLORS.warning
                    }} />
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: COLORS.textPrimary }}>
                      Other Practice Staff
                    </h4>
                    <span style={{
                      padding: '0.1rem 0.4rem', backgroundColor: COLORS.warningLight,
                      borderRadius: '0.25rem', fontSize: '0.7rem', color: COLORS.warningDark, fontWeight: 500
                    }}>
                      {otherStaff.length}
                    </span>
                  </div>

                  {/* Potential missed income callout */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
                    backgroundColor: COLORS.warningLighter, borderRadius: '0.375rem',
                    border: `1px solid ${COLORS.warningLight}`, fontSize: '0.78rem', color: COLORS.warningText
                  }}>
                    <AlertCircle size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <span>
                      These staff are not currently receiving a PCRS practice support subsidy.
                      If they are in an eligible role (secretary, nurse, or practice manager),
                      enter their hours to identify potential unclaimed income.
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {otherStaff.map((member) => {
                      const idx = getStaffIndex(member);
                      return (
                        <StaffMemberCard
                          key={`other-${member.firstName}-${member.surname}-${idx}`}
                          member={member}
                          index={idx}
                          onUpdateField={onUpdateField}
                          canRemove={member.manuallyAdded}
                          onRemove={() => onRemoveStaff(idx)}
                          showRoleSelect={!member.staffType || member.staffType === 'unknown'}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* === Add Staff Form === */}
          {showAddForm ? (
            <div style={{
              padding: '0.75rem 1rem', marginTop: '0.75rem',
              backgroundColor: COLORS.slainteBlueLight, borderRadius: '0.5rem',
              border: `1px solid ${COLORS.slainteBlue}40`
            }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>
                Add Staff Member
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.15rem', color: COLORS.textSecondary }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Mary"
                    style={{
                      width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                      border: `1px solid ${COLORS.borderLight}`, fontSize: '0.85rem', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.15rem', color: COLORS.textSecondary }}>
                    Surname
                  </label>
                  <input
                    type="text"
                    value={newSurname}
                    onChange={(e) => setNewSurname(e.target.value)}
                    placeholder="e.g. Murphy"
                    style={{
                      width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                      border: `1px solid ${COLORS.borderLight}`, fontSize: '0.85rem', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.15rem', color: COLORS.textSecondary }}>
                    Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    style={{
                      width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                      border: `1px solid ${COLORS.borderLight}`, fontSize: '0.85rem',
                      boxSizing: 'border-box', cursor: 'pointer'
                    }}
                  >
                    <option value="">Select role...</option>
                    <option value="secretary">Secretary / Receptionist</option>
                    <option value="nurse">Nurse</option>
                    <option value="practiceManager">Practice Manager</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAddForm(false); setNewFirstName(''); setNewSurname(''); setNewRole(''); }}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem',
                    border: `1px solid ${COLORS.borderLight}`, backgroundColor: COLORS.white,
                    color: COLORS.textSecondary, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={!newFirstName.trim() || !newSurname.trim() || !newRole}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem',
                    border: 'none', backgroundColor: (newFirstName.trim() && newSurname.trim() && newRole) ? COLORS.slainteBlue : COLORS.borderLight,
                    color: COLORS.white, cursor: (newFirstName.trim() && newSurname.trim() && newRole) ? 'pointer' : 'default',
                    fontWeight: 500
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                marginTop: '0.75rem', padding: '0.5rem 0.75rem',
                border: `1px dashed ${COLORS.slainteBlue}80`, borderRadius: '0.5rem',
                backgroundColor: 'transparent', color: COLORS.slainteBlue,
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', width: '100%',
                justifyContent: 'center'
              }}
            >
              <UserPlus size={15} />
              Add staff member not listed above
            </button>
          )}

          <p style={{
            margin: '1rem 0 0',
            fontSize: '0.75rem',
            color: COLORS.textSecondary,
            fontStyle: 'italic'
          }}>
            * Years of experience checks if staff are on the correct PCRS increment point.
            Actual hours worked identifies unclaimed weekly hours eligible for subsidy.
          </p>
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0.75rem 1.25rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: 'none',
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * StaffMemberCard - Individual staff member row in the editing modal
 * Supports role selection for unclassified staff and removal of manually-added staff
 */
const StaffMemberCard = ({ member, index, onUpdateField, canRemove, onRemove, showRoleSelect }) => {
  const name = `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown';
  const roleLabel = STAFF_TYPE_LABELS[member.staffType] || 'Unknown';
  const isPM = member.staffType === 'practiceManager';
  const hasEligibleRole = member.staffType && member.staffType !== 'unknown';

  // Validate increment point against experience
  const yearsExp = parseInt(member.yearsExperience) || 0;
  const incPoint = parseInt(member.incrementPoint) || 1;
  const maxPoint = member.staffType === 'secretary' ? 3 : (member.staffType === 'nurse' ? 4 : 1);
  const expectedPoint = Math.min(yearsExp, maxPoint);
  const hasIncrementWarning = !isPM && hasEligibleRole && yearsExp > 0 && yearsExp > incPoint && incPoint < maxPoint;

  // For non-PCRS staff: show "Not on PCRS" amber indicator
  const isNotOnPCRS = !member.fromPCRS && hasEligibleRole;

  return (
    <div style={{
      padding: '0.75rem 1rem',
      backgroundColor: member.fromPCRS ? `${COLORS.slainteBlue}06` : (isNotOnPCRS ? COLORS.warningLighter : COLORS.white),
      borderRadius: '0.5rem',
      border: `1px solid ${member.fromPCRS ? `${COLORS.slainteBlue}40` : (isNotOnPCRS ? COLORS.warningLight : COLORS.borderLight)}`
    }}>
      {/* Staff identity row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: COLORS.textPrimary }}>{name}</span>
          {showRoleSelect ? (
            <select
              value={member.staffType || ''}
              onChange={(e) => onUpdateField(index, 'staffType', e.target.value)}
              style={{
                padding: '0.1rem 0.4rem', borderRadius: '0.25rem',
                border: `2px solid ${COLORS.warning}`, fontSize: '0.75rem',
                backgroundColor: COLORS.warningLighter, cursor: 'pointer'
              }}
            >
              <option value="unknown">Select role...</option>
              <option value="secretary">Secretary / Receptionist</option>
              <option value="nurse">Nurse</option>
              <option value="practiceManager">Practice Manager</option>
            </select>
          ) : (
            <span style={{
              padding: '0.1rem 0.5rem',
              backgroundColor: COLORS.bgPage,
              borderRadius: '0.25rem',
              fontSize: '0.7rem',
              color: COLORS.textSecondary,
              fontWeight: 500
            }}>
              {roleLabel}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {member.fromPCRS && (
            <span style={{
              padding: '0.1rem 0.4rem', backgroundColor: COLORS.slainteBlue,
              color: COLORS.white, borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 500
            }}>
              PCRS
            </span>
          )}
          {member.fromProfile && !member.fromPCRS && (
            <span style={{
              padding: '0.1rem 0.4rem', backgroundColor: COLORS.incomeColor,
              color: COLORS.white, borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 500
            }}>
              Profile
            </span>
          )}
          {isNotOnPCRS && (
            <span style={{
              padding: '0.1rem 0.4rem', backgroundColor: COLORS.warning,
              color: COLORS.white, borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 500
            }}>
              Not on PCRS
            </span>
          )}
          {canRemove && (
            <button
              onClick={onRemove}
              title="Remove staff member"
              style={{
                padding: '0.2rem', border: 'none', background: 'none',
                cursor: 'pointer', color: COLORS.textSecondary, display: 'flex'
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Only show editable fields if role is assigned */}
      {hasEligibleRole ? (
        <>
          {/* Editable fields row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {/* Increment Point (read-only for PCRS, N/A for non-PCRS) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.2rem', color: COLORS.textSecondary }}>
                {member.fromPCRS ? 'Increment Point (PCRS)' : 'Increment Point'}
              </label>
              <input
                type="text"
                value={member.fromPCRS ? (member.incrementPoint || '-') : 'N/A'}
                disabled
                style={{
                  width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                  border: `1px solid ${COLORS.borderLight}`, fontSize: '0.85rem',
                  backgroundColor: COLORS.bgHover, color: COLORS.textSecondary, boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Years Experience (editable) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.2rem', color: COLORS.textPrimary, fontWeight: 600 }}>
                Years Exp. *
              </label>
              {isPM ? (
                <input
                  type="text" value="1" disabled title="Practice Manager has a single rate"
                  style={{
                    width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                    border: `1px solid ${COLORS.borderLight}`, fontSize: '0.85rem',
                    backgroundColor: COLORS.bgHover, color: COLORS.textSecondary, boxSizing: 'border-box'
                  }}
                />
              ) : (
                <select
                  value={member.yearsExperience || ''}
                  onChange={(e) => onUpdateField(index, 'yearsExperience', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                    border: `2px solid ${COLORS.slainteBlue}`, fontSize: '0.85rem',
                    backgroundColor: COLORS.white, color: COLORS.textPrimary,
                    boxSizing: 'border-box', cursor: 'pointer'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">{member.staffType === 'secretary' ? '3+' : '3'}</option>
                  {member.staffType !== 'secretary' && (
                    <>
                      <option value="4">4</option>
                      <option value="5">5+</option>
                    </>
                  )}
                </select>
              )}
              {!isPM && member._suggestedYears && member.yearsExperience == member._suggestedYears && (
                <span style={{ fontSize: '0.65rem', color: COLORS.slainteBlue, fontStyle: 'italic' }}>
                  suggested from PCRS
                </span>
              )}
            </div>

            {/* Actual Hours Worked (editable) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.2rem', color: COLORS.textPrimary, fontWeight: 600 }}>
                Hrs/Week *
              </label>
              <input
                type="number" min="0" max="50" step="0.5"
                value={member.actualHoursWorked || ''}
                onChange={(e) => onUpdateField(index, 'actualHoursWorked', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                placeholder={member.weeklyHours ? `${member.weeklyHours}` : '35'}
                style={{
                  width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem',
                  border: `2px solid ${COLORS.slainteBlue}`, fontSize: '0.85rem',
                  backgroundColor: COLORS.white, color: COLORS.textPrimary, boxSizing: 'border-box'
                }}
              />
              {member._suggestedHours && member.actualHoursWorked == member._suggestedHours && (
                <span style={{ fontSize: '0.65rem', color: COLORS.slainteBlue, fontStyle: 'italic' }}>
                  suggested from PCRS
                </span>
              )}
            </div>
          </div>

          {/* Increment warning (only for PCRS staff) */}
          {hasIncrementWarning && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              marginTop: '0.5rem', padding: '0.35rem 0.6rem',
              backgroundColor: COLORS.warningLighter, borderRadius: '0.25rem',
              border: `1px solid ${COLORS.warningLight}`, fontSize: '0.75rem', color: COLORS.warningDark
            }}>
              <AlertCircle size={14} />
              <span>
                {yearsExp >= maxPoint ? `${maxPoint}+` : yearsExp} years experience but on increment point {incPoint}
                {' \u2014 should be point '}{expectedPoint}
              </span>
            </div>
          )}
        </>
      ) : (
        <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.warning, fontStyle: 'italic' }}>
          Select a role above to enter experience and hours
        </p>
      )}
    </div>
  );
};

export default AreaDataCollector;
export { STC_SERVICE_GROUPS };
