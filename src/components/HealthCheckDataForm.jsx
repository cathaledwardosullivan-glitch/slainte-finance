import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Check, Users, Stethoscope, Activity, Plus, Trash2, AlertCircle, ChevronDown, HelpCircle } from 'lucide-react';
import COLORS from '../utils/colors';
import gmsRates from '../data/gmsRates';

/**
 * Reusable Disease Field Component - defined outside to prevent re-creation on each render
 */
const DiseaseField = ({ id, label, placeholder, ehrGuide, value, onChange, expandedEHRGuide, setExpandedEHRGuide }) => (
  <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.lightGray }}>
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium" style={{ color: COLORS.darkGray }}>
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
        style={{ borderColor: COLORS.lightGray }}
        placeholder={placeholder}
      />
    </div>
    {expandedEHRGuide === id && (
      <div className="px-3 pb-3 pt-0">
        <div className="p-3 rounded text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
          <p className="font-medium mb-2">How to find this in your EHR:</p>
          <div className="space-y-1" style={{ color: '#3B82F6' }}>
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
  <div className="border rounded-lg overflow-hidden mb-3" style={{ borderColor: COLORS.lightGray }}>
    <div className="p-3">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium" style={{ color: COLORS.darkGray }}>
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
        <p className="text-xs mb-2" style={{ color: COLORS.mediumGray }}>{description}</p>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded"
        style={{ borderColor: COLORS.lightGray }}
        placeholder={placeholder}
      />
    </div>
    {expandedEHRGuide === id && (
      <div className="px-3 pb-3 pt-0">
        <div className="p-3 rounded text-xs" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
          <p className="font-medium mb-2">How to find this in your EHR:</p>
          <div className="space-y-1" style={{ color: '#15803D' }}>
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
  <div className="border rounded-lg overflow-hidden mb-3" style={{ borderColor: COLORS.lightGray }}>
    <div className="p-3">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium" style={{ color: COLORS.darkGray }}>
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
        <p className="text-xs mb-2" style={{ color: COLORS.mediumGray }}>{description}</p>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded"
        style={{ borderColor: COLORS.lightGray }}
        placeholder={placeholder}
      />
    </div>
    {expandedEHRGuide === id && (
      <div className="px-3 pb-3 pt-0">
        <div className="p-3 rounded text-xs" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          <p className="font-medium mb-2">How to find this in your EHR:</p>
          <div className="space-y-1" style={{ color: '#B45309' }}>
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
      // Rate is €49.10 per smear
      const perSmearRate = gmsRates.cervicalCheck?.perSmear || 49.10;
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
    // Step 4: Cervical Screening (smears performed comes from PCRS data)
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

  const totalSteps = 4;

  // Step labels for progress indicator
  const stepLabels = [
    { num: 1, title: 'Capitation', icon: Users },
    { num: 2, title: 'Practice Support', icon: Users },
    { num: 3, title: 'CDM', icon: Stethoscope },
    { num: 4, title: 'Cervical Screening', icon: Activity }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto py-4 px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full my-auto flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Header - Fixed */}
        <div className="p-6 border-b flex-shrink-0" style={{ borderColor: COLORS.lightGray }}>
          <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.darkGray }}>
            GMS Health Check - Data Collection
          </h2>
          <p className="text-sm" style={{ color: COLORS.mediumGray }}>
            Step {currentStep} of {totalSteps}
          </p>
          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full" style={{ backgroundColor: COLORS.backgroundGray }}>
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
          {/* STEP 1: Capitation - Demographics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                <h3 className="text-xl font-semibold" style={{ color: COLORS.darkGray }}>
                  1. Capitation Income
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                Enter your GMS patient counts by age band from your EHR. This is compared against PCRS registered patients to identify registration gaps.
              </p>

              {/* Demographics */}
              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #3B82F6' }}>
                  <h4 className="font-semibold" style={{ color: '#1E40AF' }}>
                    Patient Demographics (from your EHR)
                  </h4>
                  <p className="text-sm mt-1" style={{ color: '#3B82F6' }}>
                    Capitation rates vary by age: Under 6 (€156/qtr), 6-7 (€66.70), 8-12 (€44.43), 13-69 (€44.43), 70+ (€273.38)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                      Under 6 years
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.under6}
                      onChange={(e) => updateField('demographics', 'under6', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: COLORS.lightGray }}
                      placeholder="e.g., 410"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                      Age 6-7 years
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.age6to7}
                      onChange={(e) => updateField('demographics', 'age6to7', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: COLORS.lightGray }}
                      placeholder="e.g., 205"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                      Over 70 years
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.over70}
                      onChange={(e) => updateField('demographics', 'over70', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: COLORS.lightGray }}
                      placeholder="e.g., 1015"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                      Nursing Home Residents
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.demographics.nursingHomeResidents}
                      onChange={(e) => updateField('demographics', 'nursingHomeResidents', e.target.value)}
                      className="w-full p-2 border rounded"
                      style={{ borderColor: COLORS.lightGray }}
                      placeholder="e.g., 12"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Practice Support - Staff Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                <h3 className="text-xl font-semibold" style={{ color: COLORS.darkGray }}>
                  2. Practice Support Subsidies
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                Staff details are used to verify subsidy claims and detect incorrect pay scales. Years of experience helps identify if staff are on the correct increment point.
              </p>

              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#F0FDF4', borderLeft: '4px solid #22C55E' }}>
                  <h4 className="font-semibold" style={{ color: '#166534' }}>
                    Staff Details (Secretaries, Nurses, Practice Manager)
                  </h4>
                  <p className="text-sm mt-1" style={{ color: '#15803D' }}>
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
                          borderColor: (staff.fromProfile || staff.fromPCRS) ? COLORS.slainteBlue : COLORS.lightGray,
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
                          style={{ color: COLORS.mediumGray }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <div className="grid grid-cols-6 gap-3">
                          {/* First Name */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.mediumGray }}>
                              First Name
                            </label>
                            <input
                              type="text"
                              value={staff.firstName}
                              onChange={(e) => updateStaffMember(index, 'firstName', e.target.value)}
                              className="w-full p-2 border rounded text-sm"
                              style={{
                                borderColor: COLORS.lightGray,
                                backgroundColor: (staff.fromProfile || staff.fromPCRS) ? '#f3f4f6' : 'white'
                              }}
                              placeholder="Jane"
                              disabled={staff.fromProfile || staff.fromPCRS}
                            />
                          </div>

                          {/* Surname */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.mediumGray }}>
                              Surname
                            </label>
                            <input
                              type="text"
                              value={staff.surname}
                              onChange={(e) => updateStaffMember(index, 'surname', e.target.value)}
                              className="w-full p-2 border rounded text-sm"
                              style={{
                                borderColor: COLORS.lightGray,
                                backgroundColor: (staff.fromProfile || staff.fromPCRS) ? '#f3f4f6' : 'white'
                              }}
                              placeholder="Smith"
                              disabled={staff.fromProfile || staff.fromPCRS}
                            />
                          </div>

                          {/* Staff Type */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.mediumGray }}>
                              Role
                            </label>
                            <select
                              value={staff.staffType}
                              onChange={(e) => updateStaffMember(index, 'staffType', e.target.value)}
                              className="w-full p-2 border rounded text-sm"
                              style={{
                                borderColor: COLORS.lightGray,
                                backgroundColor: staff.fromProfile ? '#f3f4f6' : 'white'
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
                            <label className="block text-xs mb-1" style={{ color: COLORS.mediumGray }}>
                              Incr. Point (PCRS)
                            </label>
                            <input
                              type="number"
                              value={staff.incrementPoint || '-'}
                              className="w-full p-2 border rounded text-sm"
                              style={{ borderColor: COLORS.lightGray, backgroundColor: '#f3f4f6', color: COLORS.mediumGray }}
                              disabled={true}
                              title="Extracted from PCRS data"
                            />
                          </div>

                          {/* Years Experience - Dropdown with role-appropriate max values */}
                          <div>
                            <label className="block text-xs mb-1" style={{ color: COLORS.darkGray, fontWeight: 600 }}>
                              Years Exp. *
                            </label>
                            {staff.staffType === 'practiceManager' ? (
                              // Practice Manager: Fixed at 1, no edit option
                              <input
                                type="text"
                                value="1"
                                className="w-full p-2 border rounded text-sm"
                                style={{ borderColor: COLORS.lightGray, backgroundColor: '#f3f4f6', color: COLORS.mediumGray }}
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
                            <label className="block text-xs mb-1" style={{ color: COLORS.darkGray, fontWeight: 600 }}>
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
                              <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: '#D97706' }}>
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
                  <div className="border border-dashed rounded-lg p-6 text-center" style={{ borderColor: COLORS.lightGray }}>
                    <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                      No staff members detected from PCRS PDFs.
                    </p>
                    <p className="text-sm mt-1" style={{ color: COLORS.mediumGray }}>
                      Upload PCRS PDFs or add staff manually to analyze Practice Support subsidies.
                    </p>
                    <button
                      type="button"
                      onClick={addStaffMember}
                      className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium mx-auto"
                      style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Staff Member
                    </button>
                  </div>
                )}

                <p className="text-xs mt-2" style={{ color: COLORS.mediumGray }}>
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
                <h3 className="text-xl font-semibold" style={{ color: COLORS.darkGray }}>
                  3. Chronic Disease Management
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                Enter your disease register counts from your EHR. This is used to calculate potential CDM, Prevention Programme, and OCF income.
              </p>

              {/* Disease Registers - CDM Treatment Programme */}
              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #3B82F6' }}>
                  <h4 className="font-semibold" style={{ color: '#1E40AF' }}>
                    CDM Treatment Programme (Established Disease)
                  </h4>
                  <p className="text-sm mt-1" style={{ color: '#3B82F6' }}>
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
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → Diabetes Type 2",
                      "HealthOne: Recall → Disease Registers → Type 2 Diabetes",
                      "ICGP Search: ICD-10 code E11.x or problem 'Type 2 Diabetes'"
                    ]}
                  />
                  <DiseaseField
                    id="asthma"
                    label="Asthma (All ages)"
                    placeholder="e.g., 280"
                    value={formData.diseaseRegisters.asthma}
                    onChange={(e) => updateField('diseaseRegisters', 'asthma', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → Asthma",
                      "HealthOne: Recall → Disease Registers → Asthma",
                      "ICGP Search: ICD-10 code J45.x or problem 'Asthma'"
                    ]}
                  />
                  <DiseaseField
                    id="copd"
                    label="COPD"
                    placeholder="e.g., 120"
                    value={formData.diseaseRegisters.copd}
                    onChange={(e) => updateField('diseaseRegisters', 'copd', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → COPD",
                      "HealthOne: Recall → Disease Registers → COPD",
                      "ICGP Search: ICD-10 code J44.x or problem 'COPD'"
                    ]}
                  />
                  <DiseaseField
                    id="heartFailure"
                    label="Heart Failure"
                    placeholder="e.g., 85"
                    value={formData.diseaseRegisters.heartFailure}
                    onChange={(e) => updateField('diseaseRegisters', 'heartFailure', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → Heart Failure",
                      "HealthOne: Recall → Disease Registers → Heart Failure",
                      "ICGP Search: ICD-10 code I50.x or problem 'Heart Failure'"
                    ]}
                  />
                  <DiseaseField
                    id="atrialFibrillation"
                    label="Atrial Fibrillation"
                    placeholder="e.g., 95"
                    value={formData.diseaseRegisters.atrialFibrillation}
                    onChange={(e) => updateField('diseaseRegisters', 'atrialFibrillation', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → AF",
                      "HealthOne: Recall → Disease Registers → Atrial Fibrillation",
                      "ICGP Search: ICD-10 code I48.x or problem 'AF' or 'Atrial Fibrillation'"
                    ]}
                  />
                  <DiseaseField
                    id="ihd"
                    label="Ischaemic Heart Disease (IHD)"
                    placeholder="e.g., 110"
                    value={formData.diseaseRegisters.ihd}
                    onChange={(e) => updateField('diseaseRegisters', 'ihd', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → IHD/Coronary Heart Disease",
                      "HealthOne: Recall → Disease Registers → IHD",
                      "ICGP Search: ICD-10 codes I20-I25 or problems like 'Angina', 'MI', 'CABG'"
                    ]}
                  />
                  <DiseaseField
                    id="stroke"
                    label="Stroke / TIA"
                    placeholder="e.g., 65"
                    value={formData.diseaseRegisters.stroke}
                    onChange={(e) => updateField('diseaseRegisters', 'stroke', e.target.value)}
                    expandedEHRGuide={expandedEHRGuide}
                    setExpandedEHRGuide={setExpandedEHRGuide}
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → Stroke/TIA",
                      "HealthOne: Recall → Disease Registers → Stroke",
                      "ICGP Search: ICD-10 codes I60-I69, G45 or problems 'Stroke', 'TIA', 'CVA'"
                    ]}
                  />
                </div>

                {/* Prevention Programme Section */}
                <div className="mt-6 pt-4 border-t" style={{ borderColor: COLORS.lightGray }}>
                  <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#F0FDF4', borderLeft: '4px solid #22C55E' }}>
                    <h4 className="font-semibold" style={{ color: '#166534' }}>
                      Prevention Programme (High Risk / Pre-Disease)
                    </h4>
                    <p className="text-sm mt-1" style={{ color: '#15803D' }}>
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
                    ehrGuide={[
                      "Socrates: Reports → Clinical → Disease Register → Hypertension",
                      "HealthOne: Recall → Disease Registers → Hypertension",
                      "Note: Hypertension-only patients go on PP, not CDM Treatment"
                    ]}
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
                    ehrGuide={[
                      "Socrates: Search for HbA1c results 42-47 mmol/mol in patients 45+",
                      "HealthOne: Lab results filter + Age 45+",
                      "Also search for problem 'Pre-diabetes' or 'Impaired glucose tolerance'"
                    ]}
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
                    ehrGuide={[
                      "Socrates: Search for QRISK scores ≥20%",
                      "HealthOne: Clinical notes search for 'QRISK' or 'High CVD Risk'",
                      "Often identified through OCF assessments"
                    ]}
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
                    ehrGuide={[
                      "Socrates: Search for 'Gestational diabetes' in past medical history",
                      "HealthOne: Problem list search 'GDM' or 'Gestational diabetes'",
                      "ICD-10 code O24.4 or problem in obstetric history"
                    ]}
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
                    ehrGuide={[
                      "Socrates: Search for 'Pre-eclampsia' in past medical history",
                      "HealthOne: Problem list search 'Pre-eclampsia' or 'PET'",
                      "ICD-10 code O14.x in obstetric history"
                    ]}
                  />
                </div>

                {/* OCF Section */}
                <div className="mt-6 pt-4 border-t" style={{ borderColor: COLORS.lightGray }}>
                  <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#FEF3C7', borderLeft: '4px solid #F59E0B' }}>
                    <h4 className="font-semibold" style={{ color: '#92400E' }}>
                      Opportunistic Case Finding (OCF)
                    </h4>
                    <p className="text-sm mt-1" style={{ color: '#B45309' }}>
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
                    ehrGuide={[
                      "Search for patients 45+ who are NOT on any CDM/PP register AND have risk factors:",
                      "Socrates: Age filter 45+, BMI ≥30 OR Smoker OR High Cholesterol",
                      "HealthOne: Query builder with age + risk factor criteria",
                      "Exclude patients already registered on CDM or Prevention Programme"
                    ]}
                  />
                </div>
              </div>

            </div>
          )}

          {/* STEP 4: Cervical Screening */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
                <h3 className="text-xl font-semibold" style={{ color: COLORS.darkGray }}>
                  4. Cervical Screening
                </h3>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                Enter the number of eligible women from your EHR. This is used to calculate potential cervical screening income (€49.10 per smear).
              </p>

              <div className="space-y-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#FDF2F8', borderLeft: '4px solid #EC4899' }}>
                  <h4 className="font-semibold" style={{ color: '#9D174D' }}>
                    Cervical Screening Activity
                  </h4>
                  <p className="text-sm mt-1" style={{ color: '#BE185D' }}>
                    Women aged 25-65 are eligible for cervical screening. Screening interval: 3 years (25-44), 5 years (45-65).
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                        Eligible Women (aged 25-44)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.cervicalCheckActivity.eligibleWomen25to44}
                        onChange={(e) => updateField('cervicalCheckActivity', 'eligibleWomen25to44', e.target.value)}
                        className="w-full p-2 border rounded"
                        style={{ borderColor: COLORS.lightGray }}
                        placeholder="e.g., 1400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                        Eligible Women (aged 45-65)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.cervicalCheckActivity.eligibleWomen45to65}
                        onChange={(e) => updateField('cervicalCheckActivity', 'eligibleWomen45to65', e.target.value)}
                        className="w-full p-2 border rounded"
                        style={{ borderColor: COLORS.lightGray }}
                        placeholder="e.g., 1450"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes about auto-calculated data */}
                <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                  <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                    <strong>Auto-calculated from PCRS:</strong> Smears performed, Study Leave, Annual Leave, and STC data are automatically extracted from your uploaded PCRS PDFs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation - Fixed */}
        <div className="p-6 border-t flex justify-between flex-shrink-0" style={{ borderColor: COLORS.lightGray }}>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border font-medium transition-colors"
            style={{
              borderColor: COLORS.lightGray,
              color: COLORS.mediumGray
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
                  borderColor: COLORS.lightGray,
                  color: COLORS.darkGray
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
