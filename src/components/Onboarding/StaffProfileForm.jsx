import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Stethoscope, UserCheck, Users,
  Briefcase, Heart, Syringe, Phone, Monitor,
  CheckCircle, AlertCircle, Loader
} from 'lucide-react';
import COLORS from '../../utils/colors';
import { getRoleCode } from '../../utils/categoryGenerator';

/**
 * StaffProfileForm - Direct form-based staff entry during onboarding
 *
 * Replaces the conversational approach with a reliable form where users
 * directly enter staff details. Finn provides contextual tips in a sidebar.
 */

// Staff role definitions with icons and placeholders
const STAFF_ROLES = [
  {
    key: 'partners',
    label: 'GP Partners',
    icon: Stethoscope,
    placeholder: 'First Surname, First Surname',
    tip: 'Partners are the GPs who own the practice. Their names help identify salary drawings.',
    isGP: true
  },
  {
    key: 'salaried',
    label: 'Salaried GPs',
    icon: UserCheck,
    placeholder: 'First Surname, First Surname',
    tip: 'Employed GPs who are not partners. Their salaries are a practice expense.',
    isGP: true
  },
  {
    key: 'management',
    label: 'Practice Manager',
    icon: Briefcase,
    placeholder: 'First Surname',
    tip: 'Practice managers often appear in bank statements for salary payments.',
    role: 'management'
  },
  {
    key: 'nursing',
    label: 'Nurses',
    icon: Heart,
    placeholder: 'First Surname, First Surname',
    tip: 'Practice nurses, including any nurse practitioners or clinical staff.',
    role: 'nursing'
  },
  {
    key: 'phlebotomy',
    label: 'Phlebotomists',
    icon: Syringe,
    placeholder: 'First Surname',
    tip: 'Staff who draw blood samples - may be part-time or contracted.',
    role: 'phlebotomy'
  },
  {
    key: 'reception',
    label: 'Reception Staff',
    icon: Phone,
    placeholder: 'First Surname, First Surname',
    tip: 'Separate multiple names with commas.',
    role: 'reception'
  },
  {
    key: 'other',
    label: 'Other Staff',
    icon: Users,
    placeholder: 'First Surname or role (e.g., Cleaner)',
    tip: 'Any other staff like cleaners, locum coordinators, or contractors.',
    role: 'other'
  }
];

// Parse comma-separated names into array
const parseNames = (text) => {
  if (!text?.trim()) return [];
  return text
    .split(/[,\n]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
};

// Format array of names to display string
const formatNames = (names) => {
  if (!names || names.length === 0) return '';
  return names.join(', ');
};

export default function StaffProfileForm({
  initialProfile,
  websiteData,
  websiteLoading = false,
  onComplete,
  onBack,
  submitLabel = 'Continue',
  backLabel = 'Back'
}) {
  // Form state - organized by role
  // EHR system options for the dropdown
  const EHR_OPTIONS = [
    { value: '', label: 'Select...' },
    { value: 'socrates', label: 'Socrates' },
    { value: 'healthone', label: 'HealthOne' },
    { value: 'practicemanager', label: 'Helix Practice Manager' },
    { value: 'completegp', label: 'CompleteGP' },
    { value: 'other', label: 'Other' }
  ];

  const [formData, setFormData] = useState({
    practiceName: '',
    location: '',
    ehrSystem: '',
    partners: '',
    salaried: '',
    management: '',
    nursing: '',
    phlebotomy: '',
    reception: '',
    other: ''
  });

  // Track which field is focused for Finn's tips
  const [focusedField, setFocusedField] = useState(null);

  // Validation state
  const [errors, setErrors] = useState({});

  // Initialize from initial profile on mount
  useEffect(() => {
    const newFormData = { ...formData };

    if (initialProfile) {
      if (initialProfile.practiceDetails?.practiceName) {
        newFormData.practiceName = initialProfile.practiceDetails.practiceName;
      }
      if (initialProfile.practiceDetails?.locations?.length > 0) {
        newFormData.location = initialProfile.practiceDetails.locations[0];
      }
      if (initialProfile.practiceDetails?.ehrSystem) {
        newFormData.ehrSystem = initialProfile.practiceDetails.ehrSystem;
      }
      if (initialProfile.gps?.partners?.length > 0) {
        newFormData.partners = initialProfile.gps.partners.map(p => p.name).join(', ');
      }
      if (initialProfile.gps?.salaried?.length > 0) {
        newFormData.salaried = initialProfile.gps.salaried.map(g => g.name).join(', ');
      }
      // Extract staff by role
      if (initialProfile.staff?.length > 0) {
        const byRole = {};
        initialProfile.staff.forEach(s => {
          const role = s.role || 'other';
          if (!byRole[role]) byRole[role] = [];
          byRole[role].push(s.name);
        });
        Object.entries(byRole).forEach(([role, names]) => {
          if (newFormData.hasOwnProperty(role)) {
            newFormData[role] = names.join(', ');
          }
        });
      }
    }

    setFormData(newFormData);
  }, []);

  // Update form when website analysis results arrive (background analysis)
  useEffect(() => {
    if (websiteData?.success && websiteData.data) {
      setFormData(prev => {
        const updated = { ...prev };
        // Only fill empty fields — don't overwrite user edits
        if (!updated.practiceName.trim() && websiteData.data.practiceName) {
          updated.practiceName = websiteData.data.practiceName;
        }
        if (!updated.location.trim() && websiteData.data.locations?.length > 0) {
          updated.location = websiteData.data.locations[0];
        }
        if (!updated.partners.trim() && websiteData.data.gpNames?.length > 0) {
          updated.partners = websiteData.data.gpNames.join(', ');
        }
        return updated;
      });
    }
  }, [websiteData]);

  // Handle input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.practiceName.trim()) {
      newErrors.practiceName = 'Practice name is required';
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    if (!formData.partners.trim()) {
      newErrors.partners = 'At least one GP partner is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Build profile object from form data
  const buildProfile = () => {
    const profile = {
      practiceDetails: {
        practiceName: formData.practiceName.trim(),
        locations: formData.location.trim() ? [formData.location.trim()] : [],
        ehrSystem: formData.ehrSystem
      },
      gps: {
        partners: parseNames(formData.partners).map(name => ({ name })),
        salaried: parseNames(formData.salaried).map(name => ({ name }))
      },
      staff: [],
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'onboarding_form'
      }
    };

    // Add staff by role
    STAFF_ROLES.forEach(role => {
      if (!role.isGP && formData[role.key]) {
        const names = parseNames(formData[role.key]);
        names.forEach(name => {
          profile.staff.push({
            name,
            role: role.role || role.key,
            roleCode: getRoleCode(role.role || role.key)
          });
        });
      }
    });

    return profile;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      const profile = buildProfile();
      onComplete(profile);
    }
  };

  // Get current tip based on focused field
  const getCurrentTip = () => {
    if (focusedField) {
      const role = STAFF_ROLES.find(r => r.key === focusedField);
      if (role) return role.tip;
      if (focusedField === 'practiceName') {
        return 'The official name of your practice - this helps identify practice-related transactions.';
      }
      if (focusedField === 'location') {
        return 'Your practice address - useful for matching location-based expenses.';
      }
      if (focusedField === 'ehrSystem') {
        return 'Knowing your Electronic Health Record (EHR) system allows us to provide step-by-step guidance tailored to your software for the GMS Health Check and other features.';
      }
    }
    return null;
  };

  // Count total staff entered
  const getStaffCount = () => {
    let count = 0;
    count += parseNames(formData.partners).length;
    count += parseNames(formData.salaried).length;
    STAFF_ROLES.forEach(role => {
      if (!role.isGP) {
        count += parseNames(formData[role.key]).length;
      }
    });
    return count;
  };

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      maxWidth: '1400px',
      margin: '0 auto',
      height: 'min(75vh, 700px)'
    }}>
      {/* Left side - Finn Advisor */}
      <div style={{
        flex: '0 0 320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Finn Card */}
        <div style={{
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          border: `1px solid ${COLORS.lightGray}`,
          padding: '1.25rem',
          flex: '0 0 auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: COLORS.slainteBlue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.white,
              fontWeight: 700,
              fontSize: '1.125rem'
            }}>
              F
            </div>
            <div>
              <div style={{ fontWeight: 600, color: COLORS.darkGray }}>Finn</div>
              <div style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>Your Guide</div>
            </div>
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: `${COLORS.slainteBlue}08`,
            borderRadius: '10px',
            fontSize: '0.9375rem',
            color: COLORS.darkGray,
            lineHeight: 1.6
          }}>
            {getCurrentTip() || (
              <>
                Enter your practice details in the form. Staff names help me automatically identify salary payments in your bank statements.
                <br /><br />
                <strong>Required:</strong> Practice name, location, and at least one GP partner.
              </>
            )}
          </div>
        </div>

        {/* Progress Summary */}
        <div style={{
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          border: `1px solid ${COLORS.lightGray}`,
          padding: '1.25rem'
        }}>
          <h3 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: COLORS.mediumGray,
            marginBottom: '1rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Profile Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Practice Name Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}>
              {formData.practiceName.trim() ? (
                <CheckCircle style={{ width: '16px', height: '16px', color: COLORS.incomeColor }} />
              ) : (
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${COLORS.lightGray}`
                }} />
              )}
              <span style={{ color: formData.practiceName.trim() ? COLORS.darkGray : COLORS.mediumGray }}>
                Practice name
              </span>
            </div>

            {/* Location Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}>
              {formData.location.trim() ? (
                <CheckCircle style={{ width: '16px', height: '16px', color: COLORS.incomeColor }} />
              ) : (
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${COLORS.lightGray}`
                }} />
              )}
              <span style={{ color: formData.location.trim() ? COLORS.darkGray : COLORS.mediumGray }}>
                Location
              </span>
            </div>

            {/* Partners Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}>
              {parseNames(formData.partners).length > 0 ? (
                <CheckCircle style={{ width: '16px', height: '16px', color: COLORS.incomeColor }} />
              ) : (
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${COLORS.lightGray}`
                }} />
              )}
              <span style={{ color: parseNames(formData.partners).length > 0 ? COLORS.darkGray : COLORS.mediumGray }}>
                GP Partners ({parseNames(formData.partners).length})
              </span>
            </div>

            {/* Staff Count */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              marginTop: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${COLORS.lightGray}`
            }}>
              <Users style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              <span style={{ color: COLORS.darkGray }}>
                {getStaffCount()} staff member{getStaffCount() !== 1 ? 's' : ''} total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div style={{
        flex: '1 1 60%',
        backgroundColor: COLORS.white,
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
        border: `1px solid ${COLORS.lightGray}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: `1px solid ${COLORS.lightGray}`,
          backgroundColor: COLORS.backgroundGray
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: `${COLORS.slainteBlue}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 style={{ width: '20px', height: '20px', color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: COLORS.darkGray,
                margin: 0
              }}>
                Practice Profile
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.mediumGray,
                margin: 0
              }}>
                Enter your practice and staff details
              </p>
            </div>
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {/* Website analysis loading banner */}
          {websiteLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: `${COLORS.slainteBlue}08`,
              border: `1px solid ${COLORS.slainteBlue}30`,
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <Loader style={{ width: '16px', height: '16px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: COLORS.darkGray }}>
                Still analysing your website... Fields will auto-populate when ready. You can fill in details manually in the meantime.
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Practice Details Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.mediumGray,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '1rem'
            }}>
              Practice Details
            </h3>

            {/* Practice Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: COLORS.darkGray,
                marginBottom: '0.375rem'
              }}>
                <Building2 style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                Practice Name <span style={{ color: COLORS.expenseColor }}>*</span>
              </label>
              <input
                type="text"
                value={formData.practiceName}
                onChange={(e) => handleChange('practiceName', e.target.value)}
                onFocus={() => setFocusedField('practiceName')}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g., Griffith Avenue Practice"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  border: `2px solid ${errors.practiceName ? COLORS.expenseColor : COLORS.lightGray}`,
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
              {errors.practiceName && (
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.expenseColor,
                  marginTop: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <AlertCircle style={{ width: '12px', height: '12px' }} />
                  {errors.practiceName}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: COLORS.darkGray,
                marginBottom: '0.375rem'
              }}>
                <MapPin style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                Location <span style={{ color: COLORS.expenseColor }}>*</span>
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                onFocus={() => setFocusedField('location')}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g., 123 Main Street, Dublin 9"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  border: `2px solid ${errors.location ? COLORS.expenseColor : COLORS.lightGray}`,
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
              {errors.location && (
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.expenseColor,
                  marginTop: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <AlertCircle style={{ width: '12px', height: '12px' }} />
                  {errors.location}
                </p>
              )}
            </div>

            {/* EHR System */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: COLORS.darkGray,
                marginBottom: '0.375rem'
              }}>
                <Monitor style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                Electronic Health Record (EHR) System
              </label>
              <select
                value={formData.ehrSystem}
                onChange={(e) => handleChange('ehrSystem', e.target.value)}
                onFocus={() => setFocusedField('ehrSystem')}
                onBlur={() => setFocusedField(null)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: COLORS.white,
                  cursor: 'pointer'
                }}
              >
                {EHR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Sections */}
          <div>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.mediumGray,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '1rem'
            }}>
              Staff & GPs
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem'
            }}>
              {STAFF_ROLES.map(role => {
                const Icon = role.icon;
                const isRequired = role.key === 'partners';
                const hasError = errors[role.key];

                return (
                  <div key={role.key}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: COLORS.darkGray,
                      marginBottom: '0.375rem'
                    }}>
                      <Icon style={{ width: '14px', height: '14px', color: COLORS.slainteBlue }} />
                      {role.label}
                      {isRequired && <span style={{ color: COLORS.expenseColor }}>*</span>}
                    </label>
                    <input
                      type="text"
                      value={formData[role.key]}
                      onChange={(e) => handleChange(role.key, e.target.value)}
                      onFocus={() => setFocusedField(role.key)}
                      onBlur={() => setFocusedField(null)}
                      placeholder={role.placeholder}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        fontSize: '0.9375rem',
                        border: `2px solid ${hasError ? COLORS.expenseColor : COLORS.lightGray}`,
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                    />
                    {hasError && (
                      <p style={{
                        fontSize: '0.75rem',
                        color: COLORS.expenseColor,
                        marginTop: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <AlertCircle style={{ width: '12px', height: '12px' }} />
                        {errors[role.key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <p style={{
              fontSize: '0.75rem',
              color: COLORS.mediumGray,
              marginTop: '1rem',
              fontStyle: 'italic'
            }}>
              Tip: Separate multiple names with commas (e.g., "Emma, Sarah, Tom")
            </p>
          </div>
        </div>

        {/* Footer with buttons */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: `1px solid ${COLORS.lightGray}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: COLORS.white
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: COLORS.darkGray,
              backgroundColor: COLORS.white,
              border: `2px solid ${COLORS.lightGray}`,
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {backLabel}
          </button>

          <button
            onClick={handleSubmit}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <CheckCircle style={{ width: '18px', height: '18px' }} />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
