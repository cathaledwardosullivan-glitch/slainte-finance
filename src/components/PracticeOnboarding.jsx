import React, { useState } from 'react';
import { CheckCircle, Users, Building, FileText, ArrowRight, ArrowLeft, Play, Eye, EyeOff, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { DEFAULT_CATEGORY_MAPPING } from '../data/categoryMappings';
import { getCategoriesBySection, saveCategoryPreferences, initializeDefaultPreferences } from '../utils/categoryPreferences';
import COLORS from '../utils/colors';

// Define onboarding stages
const STAGES = {
  WELCOME: 'welcome',
  PRACTICE_INFO: 'practice_info',
  PRACTICE_SIZE: 'practice_size',
  RECEPTION_STAFF: 'reception_staff',
  NURSING_STAFF: 'nursing_staff',
  PHLEBOTOMY_STAFF: 'phlebotomy_staff',
  GP_ASSISTANTS: 'gp_assistants',
  MANAGEMENT: 'management',
  PARTNERS: 'partners',
  ADDITIONAL_ROLES: 'additional_roles',  // NEW: Add any other role types
  OPTIONAL_SERVICES: 'optional_services',
  CATEGORY_PREFERENCES_INTRO: 'category_preferences_intro',  // NEW: Introduction to category preferences
  CATEGORY_PREFERENCES: 'category_preferences',  // NEW: Category visibility preferences
  REVIEW: 'review',
  COMPLETE: 'complete'
};

export default function PracticeOnboarding({ onComplete, onSkip, editMode = false }) {
  const {
    setCategoryMapping,
    categoryMapping,
    setTransactions,
    setUnidentifiedTransactions,
    setPaymentAnalysisData
  } = useAppContext();
  const { profile, updateProfile, completeSetup } = usePracticeProfile();

  const [stage, setStage] = useState(editMode ? STAGES.PRACTICE_INFO : STAGES.WELCOME);

  // Initialize with empty state
  const [responses, setResponses] = useState({
    // Practice details
    practiceName: '',
    location: '',
    numberOfGPs: '',
    practiceType: 'urban',

    // Staff
    receptionStaff: '',
    nursingStaff: '',
    phlebotomyStaff: '',
    gpAssistants: '',
    management: '',
    partners: '',

    // Additional staff (new)
    additionalStaff: [], // Array of { role: 'Partner', name: 'John Smith' }

    // Optional services
    optionalServices: {
      dspPayments: true,
      methadoneServices: false,
      medservFees: true,
      icgpMembership: true,
      medicalCouncil: true
    },

    // Category visibility preferences
    categoryPreferences: {},  // Map of categoryCode -> boolean (visible)
    categoryPreferencesSection: 0  // Track which section we're showing (0-based index)
  });

  // Load existing data in edit mode
  React.useEffect(() => {
    if (editMode) {
      console.log('Edit mode - loading existing data');
      console.log('Profile:', profile);
      console.log('Category mapping count:', categoryMapping.length);

      setResponses({
        practiceName: profile?.practiceDetails?.practiceName || '',
        location: profile?.practiceDetails?.location || '',
        numberOfGPs: profile?.practiceDetails?.numberOfGPs || '',
        practiceType: profile?.practiceDetails?.practiceType || 'urban',

        // Extract staff from existing categories
        receptionStaff: categoryMapping.filter(c => c.role === '3').map(c => c.staffMember).filter(Boolean).join(', '),
        nursingStaff: categoryMapping.filter(c => c.role === '4').map(c => c.staffMember).filter(Boolean).join(', '),
        phlebotomyStaff: categoryMapping.filter(c => c.role === '5').map(c => c.staffMember).filter(Boolean).join(', '),
        gpAssistants: categoryMapping.filter(c => c.role === '6').map(c => c.staffMember).filter(Boolean).join(', '),
        management: categoryMapping.filter(c => c.role === '7').map(c => c.staffMember).filter(Boolean).join(', '),
        partners: categoryMapping.filter(c => c.role === '90').map(c => c.staffMember).filter(Boolean).join(', '),

        // Additional staff
        additionalStaff: [],

        // Optional services - detect from existing categories
        optionalServices: {
          dspPayments: categoryMapping.some(c => c.code === '1.4'),
          methadoneServices: categoryMapping.some(c => c.code === '1.5'),
          medservFees: categoryMapping.some(c => c.code === '1.6'),
          icgpMembership: categoryMapping.some(c => c.code === '72.1'),
          medicalCouncil: categoryMapping.some(c => c.code === '72.2'),
          medicalInsurance: categoryMapping.some(c => c.code === '40.1')
        },

        categoryPreferences: {},
        categoryPreferencesSection: 0
      });
    }
  }, [editMode, profile, categoryMapping]);

  // Update response for a given key
  const updateResponse = (key, value) => {
    setResponses(prev => ({ ...prev, [key]: value }));
  };

  // Initialize category preferences with defaults when entering CATEGORY_PREFERENCES stage
  React.useEffect(() => {
    if (stage === STAGES.CATEGORY_PREFERENCES && Object.keys(responses.categoryPreferences).length === 0) {
      const categoriesToConfigure = generateAllCategories();
      const defaultPrefs = {};

      categoriesToConfigure.forEach(category => {
        if (category.code.includes('.')) {
          const getDefaultVisibility = (cat) => {
            if (!cat.code.includes('.')) return false;
            if (cat.personalization === 'Personalize') return false;
            return true;
          };
          defaultPrefs[category.code] = getDefaultVisibility(category);
        }
      });

      updateResponse('categoryPreferences', defaultPrefs);
    }
  }, [stage]);

  // Helper to render skip button in edit mode
  const renderSkipButton = () => {
    if (!editMode) return null;
    return (
      <button
        onClick={nextStage}
        className="text-sm px-3 py-1 rounded border"
        style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
      >
        Skip →
      </button>
    );
  };

  // Parse staff input (handles comma or newline separated)
  const parseStaffInput = (input) => {
    if (!input || !input.trim()) return [];

    return input
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  // Generate category for a staff member
  const generateStaffCategory = (roleCode, roleName, staffName, index, accountantLine) => {
    // Start with minimal, safe identifiers
    const identifiers = [staffName];

    // Add name variations ONLY if they're 3+ characters (avoid overly general identifiers)
    const nameParts = staffName.split(/\s+/);
    if (nameParts.length > 1) {
      // Add first name if it's 3+ characters
      if (nameParts[0].length >= 3) {
        identifiers.push(nameParts[0]);
      }
      // Add last name if it's 3+ characters
      if (nameParts[nameParts.length - 1].length >= 3) {
        identifiers.push(nameParts[nameParts.length - 1]);
      }
    }

    // Remove special characters for additional identifier (only if 3+ chars)
    const cleanName = staffName.replace(/[^A-Za-z]/g, '');
    if (cleanName && cleanName !== staffName && cleanName.length >= 3) {
      identifiers.push(cleanName);
    }

    return {
      code: `${roleCode}.${index + 1}`,
      name: `${roleName} - ${staffName}`,
      description: `Individual ${roleName.toLowerCase()} salary`,
      identifiers: identifiers,
      accountantLine: accountantLine,
      type: "expense",
      personalization: "Personalized",
      role: roleCode,
      staffMember: staffName,
      section: "DIRECT STAFF COSTS"
    };
  };

  // Generate all categories based on responses
  const generateAllCategories = () => {
    let categories = [...DEFAULT_CATEGORY_MAPPING];

    // Remove default personalized categories and partner categories
    categories = categories.filter(c =>
      c.personalization !== "Personalize" &&
      !c.code.startsWith('90.') // Remove default partner categories
    );

    const accountantLine = "Receptionists Salaries and Social Welfare";

    // Add Reception staff (code 3.x)
    const receptionStaff = parseStaffInput(responses.receptionStaff);
    if (receptionStaff.length > 0) {
      receptionStaff.forEach((name, index) => {
        categories.push(
          generateStaffCategory('3', 'Reception', name, index, accountantLine)
        );
      });
    }

    // Add Nursing staff (code 4.x)
    const nursingStaff = parseStaffInput(responses.nursingStaff);
    if (nursingStaff.length > 0) {
      nursingStaff.forEach((name, index) => {
        categories.push(
          generateStaffCategory('4', 'Nurse', name, index, accountantLine)
        );
      });
    }

    // Add Phlebotomy staff (code 5.x)
    const phlebotomyStaff = parseStaffInput(responses.phlebotomyStaff);
    if (phlebotomyStaff.length > 0) {
      phlebotomyStaff.forEach((name, index) => {
        categories.push(
          generateStaffCategory('5', 'Phlebotomist', name, index, accountantLine)
        );
      });
    }

    // Add GP Assistants (code 6.x)
    const gpAssistants = parseStaffInput(responses.gpAssistants);
    if (gpAssistants.length > 0) {
      gpAssistants.forEach((name, index) => {
        categories.push(
          generateStaffCategory('6', 'GP Assistant', name, index, accountantLine)
        );
      });
    }

    // Add Management (code 7.x)
    const management = parseStaffInput(responses.management);
    if (management.length > 0) {
      management.forEach((name, index) => {
        categories.push(
          generateStaffCategory('7', 'Practice Manager', name, index, accountantLine)
        );
      });
    }

    // Add Partners (code 90.x)
    const partners = parseStaffInput(responses.partners);
    if (partners.length > 0) {
      partners.forEach((name, index) => {
        const identifiers = [name];
        const nameParts = name.split(/\s+/);
        if (nameParts.length > 1) {
          identifiers.push(nameParts[nameParts.length - 1]);
        }

        categories.push({
          code: `90.${index + 1}`,
          name: `Partner Drawings - ${name}`,
          description: "Individual partner drawings",
          identifiers: identifiers,
          accountantLine: "NOT ON P&L - Equity Withdrawal",
          type: "non-business",
          personalization: "Personalized",
          role: "90",
          staffMember: name,
          section: "NON-BUSINESS"
        });
      });
    }

    // Add additional staff (new feature)
    if (responses.additionalStaff && responses.additionalStaff.length > 0) {
      const roleCodeMap = {
        'Receptionist': '3',
        'Nurse': '4',
        'Hygienist': '5',
        'Phlebotomist': '5',
        'GP Assistant': '6',
        'Dentist': '6',
        'Other Staff': '7',
        'Partner': '90',      // SPECIAL: Partner drawings (non-business)
        'Associate': '6',
        'Practice Manager': '7',
        'Therapist': '5',
        'Technician': '7',
        'Admin Staff': '3',
        'Cleaning Staff': '7',
        'Locum': '6',
        'Specialist': '6',
        'Consultant': '6'
      };

      responses.additionalStaff.forEach((staff) => {
        const roleCode = roleCodeMap[staff.role] || '7';
        const roleName = staff.role;
        const isPartner = roleCode === '90';

        // Find the next available code for this role
        const existingCodes = categories
          .filter(c => c.code.startsWith(`${roleCode}.`))
          .map(c => {
            const parts = c.code.split('.');
            return parts.length > 1 ? parseInt(parts[1]) : 0;
          });

        const nextIndex = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
        const newCode = `${roleCode}.${nextIndex}`;

        // Create the category
        const identifiers = [staff.name];
        const nameParts = staff.name.split(/\s+/);
        if (nameParts.length > 1) {
          if (nameParts[0].length >= 3) {
            identifiers.push(nameParts[0]);
          }
          if (nameParts[nameParts.length - 1].length >= 3) {
            identifiers.push(nameParts[nameParts.length - 1]);
          }
        }

        // Partners are special (non-business)
        categories.push(isPartner ? {
          code: newCode,
          name: `Partner Drawings - ${staff.name}`,
          description: 'Individual partner drawings',
          identifiers: identifiers,
          accountantLine: 'NOT ON P&L - Equity Withdrawal',
          type: 'non-business',
          personalization: 'Personalized',
          role: roleCode,
          staffMember: staff.name,
          section: 'NON-BUSINESS'
        } : {
          code: newCode,
          name: `${roleName} - ${staff.name}`,
          description: `Individual ${roleName.toLowerCase()} salary`,
          identifiers: identifiers,
          accountantLine: accountantLine,
          type: 'expense',
          personalization: 'Personalized',
          role: roleCode,
          staffMember: staff.name,
          section: 'DIRECT STAFF COSTS'
        });
      });
    }

    // Filter out optional categories if not selected
    const optionals = responses.optionalServices;
    if (!optionals.dspPayments) {
      categories = categories.filter(c => c.code !== '1.3');
    }
    if (!optionals.methadoneServices) {
      categories = categories.filter(c => !c.name.toLowerCase().includes('methadone'));
    }
    if (!optionals.medservFees) {
      categories = categories.filter(c => c.code !== '40.3');
    }
    if (!optionals.icgpMembership) {
      categories = categories.filter(c => c.code !== '50.2');
    }
    if (!optionals.medicalCouncil) {
      categories = categories.filter(c => c.code !== '50.1');
    }

    // Sort by code
    categories.sort((a, b) => {
      const aCode = parseFloat(a.code);
      const bCode = parseFloat(b.code);
      return aCode - bCode;
    });

    return categories;
  };

  // Move to next stage
  const nextStage = () => {
    const stageOrder = Object.values(STAGES);
    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex < stageOrder.length - 1) {
      setStage(stageOrder[currentIndex + 1]);
    }
  };

  // Move to previous stage
  const prevStage = () => {
    const stageOrder = Object.values(STAGES);
    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex > 0) {
      setStage(stageOrder[currentIndex - 1]);
    }
  };

  // Handle completion
  const handleComplete = () => {
    // Generate personalized categories
    const finalCategories = generateAllCategories();

    // Save categories to AppContext
    setCategoryMapping(finalCategories);

    // Save category preferences
    if (responses.categoryPreferences && Object.keys(responses.categoryPreferences).length > 0) {
      saveCategoryPreferences(responses.categoryPreferences);
    } else {
      // Initialize with smart defaults if user didn't customize
      initializeDefaultPreferences(finalCategories);
    }

    // Save practice profile data
    updateProfile({
      practiceDetails: {
        practiceName: responses.practiceName,
        location: responses.location,
        numberOfGPs: parseInt(responses.numberOfGPs) || null,
        practiceType: responses.practiceType
      }
    });

    // Mark setup as complete
    completeSetup();

    // Call completion callback
    if (onComplete) {
      onComplete({
        practiceName: responses.practiceName,
        location: responses.location,
        categoryMapping: finalCategories
      });
    }
  };

  // Render current stage
  const renderStage = () => {
    switch (stage) {
      case STAGES.WELCOME:
        return (
          <div className="text-center space-y-6">
            <div className="text-6xl">👋</div>
            <h2 className="text-3xl font-bold" style={{ color: COLORS.darkGray }}>
              Welcome to GP Practice Finance Manager
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.mediumGray }}>
              Let's set up your financial categories in about 10-15 minutes.
              This ensures transaction labeling matches YOUR practice's specific
              staff, services, and organizational structure.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                <Users className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.slainteBlue }} />
                <h3 className="font-semibold" style={{ color: COLORS.slainteBlue }}>Staff Setup</h3>
                <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                  Individual tracking for each team member
                </p>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <Building className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.incomeColor }} />
                <h3 className="font-semibold" style={{ color: COLORS.incomeColor }}>Services</h3>
                <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                  Configure income streams and optional services
                </p>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}15` }}>
                <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.highlightYellow }} />
                <h3 className="font-semibold" style={{ color: COLORS.highlightYellow }}>Categories</h3>
                <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                  Automatic P&L format for your accountant
                </p>
              </div>
            </div>

            <button
              onClick={nextStage}
              className="px-8 py-3 rounded-lg text-lg font-medium text-white flex items-center mx-auto gap-2"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              <Play className="h-5 w-5" />
              Get Started
            </button>

            {onSkip && (
              <button
                onClick={onSkip}
                className="text-sm mt-4"
                style={{ color: COLORS.mediumGray }}
              >
                Skip for now
              </button>
            )}

            {/* Restore from Backup Option */}
            {!editMode && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor: COLORS.lightGray }}>
                <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                  Have a previous backup?
                </p>
                <label
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                  style={{ borderColor: COLORS.slainteBlue, color: COLORS.slainteBlue }}
                >
                  <Upload className="h-4 w-4" />
                  Restore from Backup
                  <input
                    type="file"
                    accept=".json"
                    onChange={(event) => {
                      const file = event.target.files[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = (e) => {
                        try {
                          const data = JSON.parse(e.target.result);

                          // Validate backup file
                          if (!data.version || !data.exportDate) {
                            alert('Invalid backup file. Please select a valid Slainte Finance backup file.');
                            return;
                          }

                          const backupDate = new Date(data.exportDate).toLocaleDateString();
                          const transCount = (data.transactions || []).length;
                          const unidentCount = (data.unidentifiedTransactions || []).length;
                          const pcrsCount = (data.paymentAnalysisData || []).length;

                          if (window.confirm(
                            `Restore backup from ${backupDate}?\n\n` +
                            `This backup contains:\n` +
                            `• ${transCount} categorised transactions\n` +
                            `• ${unidentCount} unidentified transactions\n` +
                            `• ${pcrsCount} PCRS payment records\n\n` +
                            `Continue?`
                          )) {
                            // Restore all data
                            setTransactions(data.transactions || []);
                            setUnidentifiedTransactions(data.unidentifiedTransactions || []);
                            if (data.categoryMapping) setCategoryMapping(data.categoryMapping);
                            if (data.paymentAnalysisData) setPaymentAnalysisData(data.paymentAnalysisData);

                            // Restore localStorage items
                            if (data.practiceProfile) {
                              localStorage.setItem('slainte_practice_profile', data.practiceProfile);
                            }
                            if (data.savedReports) {
                              localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
                            }
                            if (data.aiCorrections) {
                              localStorage.setItem('slainte_ai_corrections', data.aiCorrections);
                            }
                            if (data.categoryPreferences) {
                              localStorage.setItem('gp_finance_category_preferences', data.categoryPreferences);
                            }

                            alert('Backup restored successfully! The app will now reload.');
                            window.location.reload();
                          }
                        } catch (error) {
                          console.error('Restore error:', error);
                          alert('Error reading backup file. Please check the file is a valid JSON backup.');
                        }
                      };
                      reader.readAsText(file);
                      event.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        );

      case STAGES.PRACTICE_INFO:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Practice Information
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update your practice information or skip to next section.' : "Let's start with some basic information about your practice."}
                </p>
              </div>
              {editMode && (
                <button
                  onClick={nextStage}
                  className="text-sm px-3 py-1 rounded border"
                  style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                >
                  Skip →
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                  Practice Name *
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-4 py-2"
                  style={{ borderColor: COLORS.lightGray }}
                  placeholder="e.g., Glasnevin Avenue Practice"
                  value={responses.practiceName}
                  onChange={(e) => updateResponse('practiceName', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                  Location *
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-4 py-2"
                  style={{ borderColor: COLORS.lightGray }}
                  placeholder="e.g., Dublin 9"
                  value={responses.location}
                  onChange={(e) => updateResponse('location', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{
                  backgroundColor: (editMode || responses.practiceName) ? COLORS.slainteBlue : COLORS.lightGray,
                  cursor: (editMode || responses.practiceName) ? 'pointer' : 'not-allowed'
                }}
                disabled={!editMode && !responses.practiceName}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.PRACTICE_SIZE:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Practice Size
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update practice size or skip to next section.' : 'Tell us about your practice size (optional - you can skip this).'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                  Number of GPs
                </label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-4 py-2"
                  style={{ borderColor: COLORS.lightGray }}
                  placeholder="e.g., 3"
                  min="1"
                  value={responses.numberOfGPs}
                  onChange={(e) => updateResponse('numberOfGPs', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                  Practice Type
                </label>
                <select
                  className="w-full border rounded-lg px-4 py-2"
                  style={{ borderColor: COLORS.lightGray }}
                  value={responses.practiceType}
                  onChange={(e) => updateResponse('practiceType', e.target.value)}
                >
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                  <option value="semi-rural">Semi-Rural</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.RECEPTION_STAFF:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                Reception Team
              </h2>
              {renderSkipButton()}
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
              <p className="text-sm mb-2" style={{ color: COLORS.slainteBlue }}>
                <strong>Why this matters:</strong> Each receptionist gets their own category
                for accurate salary tracking and automatic transaction labeling.
              </p>
              <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                💡 Don't worry about getting names perfect - after you upload transactions,
                our AI will analyze unidentified payments and suggest additional identifier patterns to add.
              </p>
            </div>

            <p style={{ color: COLORS.mediumGray }}>
              Please list your receptionists using initials or first names,
              one per line or comma-separated.
            </p>

            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
              <p className="text-sm mb-2" style={{ color: COLORS.mediumGray }}>Examples:</p>
              <code className="text-sm block">
                RobynM<br />
                LeannD<br />
                DeanaG
              </code>
              <p className="text-sm mt-2" style={{ color: COLORS.mediumGray }}>or</p>
              <code className="text-sm">
                RobynM, LeannD, DeanaG
              </code>
            </div>

            <textarea
              className="w-full border rounded-lg px-4 py-2 font-mono"
              style={{ borderColor: COLORS.lightGray }}
              rows={8}
              placeholder="Enter staff names here..."
              value={responses.receptionStaff}
              onChange={(e) => updateResponse('receptionStaff', e.target.value)}
            />

            {responses.receptionStaff && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <p className="text-sm font-medium mb-2" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {parseStaffInput(responses.receptionStaff).length} reception categories:
                </p>
                <ul className="text-sm space-y-1" style={{ color: COLORS.darkGray }}>
                  {parseStaffInput(responses.receptionStaff).map((name, i) => (
                    <li key={i}>• 3.{i + 1} - Reception - {name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.NURSING_STAFF:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Nursing Staff
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update nursing staff or skip to next section:' : 'List your practice nurses (if any):'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <textarea
              className="w-full border rounded-lg px-4 py-2 font-mono"
              style={{ borderColor: COLORS.lightGray }}
              rows={4}
              placeholder="e.g., KatieB (or leave blank if none)"
              value={responses.nursingStaff}
              onChange={(e) => updateResponse('nursingStaff', e.target.value)}
            />

            {responses.nursingStaff && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <p className="text-sm" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {parseStaffInput(responses.nursingStaff).length} nursing category/categories
                </p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.PHLEBOTOMY_STAFF:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Phlebotomy Staff
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update phlebotomy staff or skip to next section:' : 'List your phlebotomists (if any):'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <textarea
              className="w-full border rounded-lg px-4 py-2 font-mono"
              style={{ borderColor: COLORS.lightGray }}
              rows={4}
              placeholder="e.g., MariaC (or leave blank if none)"
              value={responses.phlebotomyStaff}
              onChange={(e) => updateResponse('phlebotomyStaff', e.target.value)}
            />

            {responses.phlebotomyStaff && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <p className="text-sm" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {parseStaffInput(responses.phlebotomyStaff).length} phlebotomist category/categories
                </p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.GP_ASSISTANTS:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  GP Assistants
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update GP assistants or skip to next section:' : 'List your GP assistants (if any):'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <textarea
              className="w-full border rounded-lg px-4 py-2 font-mono"
              style={{ borderColor: COLORS.lightGray }}
              rows={4}
              placeholder="e.g., JoannaM (or leave blank if none)"
              value={responses.gpAssistants}
              onChange={(e) => updateResponse('gpAssistants', e.target.value)}
            />

            {responses.gpAssistants && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <p className="text-sm" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {parseStaffInput(responses.gpAssistants).length} GP assistant category/categories
                </p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.MANAGEMENT:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Practice Management
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update practice managers or skip to next section:' : 'List your practice managers (if any):'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <textarea
              className="w-full border rounded-lg px-4 py-2 font-mono"
              style={{ borderColor: COLORS.lightGray }}
              rows={4}
              placeholder="e.g., LindaD (or leave blank if none)"
              value={responses.management}
              onChange={(e) => updateResponse('management', e.target.value)}
            />

            {responses.management && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <p className="text-sm" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {parseStaffInput(responses.management).length} manager category/categories
                </p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.PARTNERS:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Practice Partners
                </h2>
              </div>
              {renderSkipButton()}
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}15` }}>
              <p style={{ color: COLORS.darkGray }}>
                <strong>Important:</strong> Partner drawings are correctly classified as
                equity withdrawals (not expenses) for accurate P&L reporting.
              </p>
            </div>

            <p style={{ color: COLORS.mediumGray }}>
              {editMode ? 'Update practice partners or skip to next section:' : 'Please list all practice partners/owners:'}
            </p>

            <textarea
              className="w-full border rounded-lg px-4 py-2 font-mono"
              style={{ borderColor: COLORS.lightGray }}
              rows={6}
              placeholder="e.g., RobS, KarenA, SineadM"
              value={responses.partners}
              onChange={(e) => updateResponse('partners', e.target.value)}
            />

            {responses.partners && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                <p className="text-sm font-medium mb-2" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {parseStaffInput(responses.partners).length} partner drawing categories:
                </p>
                <ul className="text-sm space-y-1" style={{ color: COLORS.darkGray }}>
                  {parseStaffInput(responses.partners).map((name, i) => (
                    <li key={i}>• 90.{i + 1} - Partner Drawings - {name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{
                  backgroundColor: (editMode || responses.partners) ? COLORS.slainteBlue : COLORS.lightGray,
                  cursor: (editMode || responses.partners) ? 'pointer' : 'not-allowed'
                }}
                disabled={!editMode && !responses.partners}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.ADDITIONAL_ROLES:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Additional Staff Roles
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Add or update any additional staff roles:' : 'Add any other staff roles not covered in the previous steps:'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
              <p className="text-sm" style={{ color: COLORS.darkGray }}>
                Use this section to add staff in roles like Partner, Associate, Practice Manager,
                Therapist, Technician, Locum, Specialist, or any other role not listed previously.
              </p>
            </div>

            {/* Add new staff member form */}
            <div className="border-2 rounded-lg p-4" style={{ borderColor: COLORS.lightGray }}>
              <h3 className="font-semibold mb-3" style={{ color: COLORS.darkGray }}>
                Add Staff Member
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                    Role
                  </label>
                  <select
                    id="newStaffRole"
                    className="w-full border rounded px-3 py-2 text-sm"
                    style={{ borderColor: COLORS.lightGray }}
                  >
                    <option value="">-- Select Role --</option>
                    <optgroup label="Professional Roles">
                      <option value="Partner">Partner</option>
                      <option value="Associate">Associate</option>
                      <option value="Locum">Locum</option>
                      <option value="Specialist">Specialist</option>
                      <option value="Consultant">Consultant</option>
                    </optgroup>
                    <optgroup label="Staff Roles">
                      <option value="Practice Manager">Practice Manager</option>
                      <option value="Therapist">Therapist</option>
                      <option value="Technician">Technician</option>
                      <option value="Admin Staff">Admin Staff</option>
                      <option value="Cleaning Staff">Cleaning Staff</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGray }}>
                    Staff Name
                  </label>
                  <input
                    type="text"
                    id="newStaffName"
                    className="w-full border rounded px-3 py-2 text-sm"
                    style={{ borderColor: COLORS.lightGray }}
                    placeholder="e.g., Joan Smith"
                  />
                </div>

                <button
                  onClick={() => {
                    const roleSelect = document.getElementById('newStaffRole');
                    const nameInput = document.getElementById('newStaffName');
                    const role = roleSelect.value;
                    const name = nameInput.value.trim();

                    if (role && name) {
                      const newStaff = { role, name };
                      updateResponse('additionalStaff', [...responses.additionalStaff, newStaff]);
                      roleSelect.value = '';
                      nameInput.value = '';
                    } else {
                      alert('Please select a role and enter a name');
                    }
                  }}
                  className="w-full px-4 py-2 rounded text-white font-medium text-sm"
                  style={{ backgroundColor: COLORS.slainteBlue }}
                >
                  + Add Staff Member
                </button>
              </div>
            </div>

            {/* List of added staff */}
            {responses.additionalStaff.length > 0 && (
              <div className="border-2 rounded-lg p-4" style={{ borderColor: COLORS.incomeColor, backgroundColor: `${COLORS.incomeColor}10` }}>
                <p className="text-sm font-medium mb-3" style={{ color: COLORS.incomeColor }}>
                  ✓ Will create {responses.additionalStaff.length} additional staff categories:
                </p>
                <ul className="space-y-2">
                  {responses.additionalStaff.map((staff, i) => (
                    <li key={i} className="flex items-center justify-between text-sm" style={{ color: COLORS.darkGray }}>
                      <span>• {staff.role} - {staff.name}</span>
                      <button
                        onClick={() => {
                          updateResponse('additionalStaff', responses.additionalStaff.filter((_, idx) => idx !== i));
                        }}
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                {responses.additionalStaff.length > 0 ? 'Next' : 'Skip'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.OPTIONAL_SERVICES:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Optional Services
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  {editMode ? 'Update optional services or skip to next section:' : 'Select which services apply to your practice:'}
                </p>
              </div>
              {renderSkipButton()}
            </div>

            <div className="space-y-3">
              {[
                { key: 'dspPayments', label: 'DSP Payments (Department of Social Protection)' },
                { key: 'methadoneServices', label: 'Methadone Services' },
                { key: 'medservFees', label: 'Medserv Fees (Third-party admin)' },
                { key: 'medicalCouncil', label: 'Medical Council Registration (Irish practices)' },
                { key: 'icgpMembership', label: 'ICGP Membership (Irish practices)' }
              ].map(option => (
                <label
                  key={option.key}
                  className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: COLORS.lightGray }}
                >
                  <input
                    type="checkbox"
                    checked={responses.optionalServices[option.key]}
                    onChange={(e) => updateResponse('optionalServices', {
                      ...responses.optionalServices,
                      [option.key]: e.target.checked
                    })}
                    className="h-5 w-5"
                  />
                  <span style={{ color: COLORS.darkGray }}>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case STAGES.CATEGORY_PREFERENCES_INTRO:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Eye className="h-16 w-16 mx-auto mb-4" style={{ color: COLORS.slainteBlue }} />
              <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                Category Setup
              </h2>
            </div>

            <div className="p-6 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
              <h3 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>
                What's Next?
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                In the final part of the setup, you will review the available categories and choose which ones
                apply to your practice.
              </p>
              <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                You have the option to choose:
              </p>
              <ul className="text-sm space-y-2 ml-4" style={{ color: COLORS.darkGray }}>
                <li>• <strong>All available subcategories</strong> - See every option when categorizing</li>
                <li>• <strong>Some subcategories</strong> - Hide rarely-used ones to reduce clutter</li>
                <li>• <strong>None</strong> - Use default "Unclassified" labels (e.g., "Staff Costs Unclassified")</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}15` }}>
              <p className="text-sm" style={{ color: COLORS.darkGray }}>
                <strong>Remember:</strong> Hidden categories can still be used when needed - they just won't
                appear in the quick-select dropdown. You can always change these preferences later in Admin Settings.
              </p>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={nextStage}
                className="px-8 py-3 rounded-lg text-lg font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Start Category Review
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        );

      case STAGES.CATEGORY_PREFERENCES:
        // Generate categories to show preferences for
        const categoriesToConfigure = generateAllCategories();
        const categoriesBySection = getCategoriesBySection(categoriesToConfigure, responses.categoryPreferences);

        const handleToggleCategory = (categoryCode) => {
          const category = categoriesToConfigure.find(cat => cat.code === categoryCode);
          if (!category) return;

          // Get default visibility
          const getDefaultVisibility = (cat) => {
            if (!cat.code.includes('.')) return false;
            if (cat.personalization === 'Personalize') return false;
            return true;
          };

          const defaultVisibility = getDefaultVisibility(category);
          const currentVisibility = responses.categoryPreferences.hasOwnProperty(categoryCode)
            ? responses.categoryPreferences[categoryCode]
            : defaultVisibility;

          updateResponse('categoryPreferences', {
            ...responses.categoryPreferences,
            [categoryCode]: !currentVisibility
          });
        };

        // Define custom section order
        const sectionOrder = [
          'INCOME',
          'DIRECT STAFF COSTS',
          'MEDICAL SUPPLIES',
          'OFFICE & IT',
          'PREMISES COSTS',
          'PROFESSIONAL FEES',
          'PROFESSIONAL DEV',
          'PETTY CASH / OTHER EXPENSES',
          'NON-BUSINESS',
          'MOTOR & TRANSPORT',
          'CAPITAL & DEPRECIATION'
        ];

        // Get sections with categories and apply custom order
        const sectionsArray = Object.entries(categoriesBySection)
          .filter(([section, categories]) => categories.length > 0)
          .sort(([a], [b]) => {
            const aIndex = sectionOrder.indexOf(a);
            const bIndex = sectionOrder.indexOf(b);
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });

        const currentSectionIndex = responses.categoryPreferencesSection;
        const isLastSection = currentSectionIndex >= sectionsArray.length - 1;

        // Handle next section or move to next stage
        const handleNextSection = () => {
          if (isLastSection) {
            nextStage();
          } else {
            updateResponse('categoryPreferencesSection', currentSectionIndex + 1);
          }
        };

        // Handle previous section or move to previous stage
        const handlePrevSection = () => {
          if (currentSectionIndex === 0) {
            prevStage();
          } else {
            updateResponse('categoryPreferencesSection', currentSectionIndex - 1);
          }
        };

        // Get current section data
        const [currentSectionName, currentSectionCategories] = sectionsArray[currentSectionIndex] || ['', []];

        // Count visible in this section - need to check current preferences state, not just category.visible
        const getVisibleCount = () => {
          return currentSectionCategories.filter(category => {
            const getDefaultVisibility = (cat) => {
              if (!cat.code.includes('.')) return false;
              if (cat.personalization === 'Personalize') return false;
              return true;
            };

            const defaultVisibility = getDefaultVisibility(category);
            return responses.categoryPreferences.hasOwnProperty(category.code)
              ? responses.categoryPreferences[category.code]
              : defaultVisibility;
          }).length;
        };

        const visibleInSection = getVisibleCount();

        // Determine section selection mode (all/some/none)
        const getSectionMode = () => {
          if (visibleInSection === 0) return 'none';
          if (visibleInSection === currentSectionCategories.length) return 'all';
          return 'some';
        };

        const sectionMode = getSectionMode();

        // Handle section mode change
        const handleSectionModeChange = (mode) => {
          console.log('🔵 handleSectionModeChange called with mode:', mode);
          console.log('🔵 Current sectionMode:', sectionMode);
          console.log('🔵 Current visibleInSection:', visibleInSection);
          console.log('🔵 Total categories in section:', currentSectionCategories.length);

          const updatedPrefs = { ...responses.categoryPreferences };

          if (mode === 'all') {
            // Set all to visible
            currentSectionCategories.forEach(category => {
              updatedPrefs[category.code] = true;
            });
          } else if (mode === 'none') {
            // Set all to hidden
            currentSectionCategories.forEach(category => {
              updatedPrefs[category.code] = false;
            });
          } else if (mode === 'some') {
            console.log('🔵 Processing "some" mode...');

            // For 'some' mode, we need to ensure we're in a mixed state
            // If coming from "all" or "none", we need to create an actual mixed state
            if (sectionMode === 'all' || sectionMode === 'none') {
              // Set categories to their defaults
              currentSectionCategories.forEach(category => {
                const getDefaultVisibility = (cat) => {
                  if (!cat.code.includes('.')) return false;
                  if (cat.personalization === 'Personalize') return false;
                  return true;
                };
                updatedPrefs[category.code] = getDefaultVisibility(category);
              });

              // Check if all defaults are the same (all true or all false)
              const allSame = currentSectionCategories.every(cat => {
                const getDefaultVisibility = (c) => {
                  if (!c.code.includes('.')) return false;
                  if (c.personalization === 'Personalize') return false;
                  return true;
                };
                return getDefaultVisibility(cat) === getDefaultVisibility(currentSectionCategories[0]);
              });

              // If all defaults are the same, we need to manually create a mixed state
              if (allSame && currentSectionCategories.length > 0) {
                console.log('🔵 All defaults are the same - creating artificial mixed state');
                // Hide the first category to create a mixed state
                updatedPrefs[currentSectionCategories[0].code] = false;
              }
            } else {
              // Already in mixed state, keep existing preferences
              currentSectionCategories.forEach(category => {
                if (!updatedPrefs.hasOwnProperty(category.code)) {
                  const getDefaultVisibility = (cat) => {
                    if (!cat.code.includes('.')) return false;
                    if (cat.personalization === 'Personalize') return false;
                    return true;
                  };
                  updatedPrefs[category.code] = getDefaultVisibility(category);
                }
              });
            }
          }

          console.log('🔵 Updated preferences:', updatedPrefs);
          updateResponse('categoryPreferences', updatedPrefs);
        };

        // Get section-specific explanatory text
        const getSectionExplanation = (sectionName) => {
          switch (sectionName) {
            case 'DIRECT STAFF COSTS':
              return 'Here is where the staff categories you created earlier will be shown. This section also includes additional employer costs such as PRSI and pension contributions.';
            case 'MOTOR & TRANSPORT':
              return 'You may not have any transactions related to Motor & Transport from your practice account, but if you have leasing agreements or other costs they can be categorised here.';
            default:
              return null;
          }
        };

        const sectionExplanation = getSectionExplanation(currentSectionName);

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                  Category Setup: {currentSectionName}
                </h2>
                <p style={{ color: COLORS.mediumGray }}>
                  Section {currentSectionIndex + 1} of {sectionsArray.length}
                </p>
              </div>
            </div>

            {sectionExplanation && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}15` }}>
                <p className="text-sm" style={{ color: COLORS.darkGray }}>
                  ℹ️ {sectionExplanation}
                </p>
              </div>
            )}

            <div className="p-4 rounded-lg border" style={{ backgroundColor: COLORS.backgroundGray, borderColor: COLORS.lightGray }}>
              <p className="text-sm font-medium mb-3" style={{ color: COLORS.darkGray }}>
                How would you like to handle {currentSectionName} categories?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded cursor-pointer border" style={{
                  borderColor: sectionMode === 'all' ? COLORS.slainteBlue : COLORS.lightGray,
                  backgroundColor: sectionMode === 'all' ? `${COLORS.slainteBlue}10` : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="sectionMode"
                    checked={sectionMode === 'all'}
                    onChange={() => handleSectionModeChange('all')}
                    className="h-4 w-4"
                    style={{ accentColor: COLORS.slainteBlue }}
                  />
                  <div>
                    <p className="font-medium text-sm" style={{ color: COLORS.darkGray }}>Use All Available Subcategories</p>
                    <p className="text-xs" style={{ color: COLORS.mediumGray }}>Show all {currentSectionCategories.length} categories when categorizing</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded cursor-pointer border" style={{
                  borderColor: sectionMode === 'some' ? COLORS.slainteBlue : COLORS.lightGray,
                  backgroundColor: sectionMode === 'some' ? `${COLORS.slainteBlue}10` : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="sectionMode"
                    checked={sectionMode === 'some'}
                    onChange={() => handleSectionModeChange('some')}
                    className="h-4 w-4"
                    style={{ accentColor: COLORS.slainteBlue }}
                  />
                  <div>
                    <p className="font-medium text-sm" style={{ color: COLORS.darkGray }}>Use Some Subcategories</p>
                    <p className="text-xs" style={{ color: COLORS.mediumGray }}>Choose specific categories below</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded cursor-pointer border" style={{
                  borderColor: sectionMode === 'none' ? COLORS.slainteBlue : COLORS.lightGray,
                  backgroundColor: sectionMode === 'none' ? `${COLORS.slainteBlue}10` : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="sectionMode"
                    checked={sectionMode === 'none'}
                    onChange={() => handleSectionModeChange('none')}
                    className="h-4 w-4"
                    style={{ accentColor: COLORS.slainteBlue }}
                  />
                  <div>
                    <p className="font-medium text-sm" style={{ color: COLORS.darkGray }}>Use None of the Subcategories</p>
                    <p className="text-xs" style={{ color: COLORS.mediumGray }}>All items default to "{currentSectionName.split(' ').map((w, i) => i === 0 ? w : w.toLowerCase()).join(' ')} Unclassified"</p>
                  </div>
                </label>
              </div>
            </div>

            {sectionMode === 'all' && (
              <div className="p-4 rounded-lg border" style={{ backgroundColor: `${COLORS.incomeColor}15`, borderColor: COLORS.incomeColor }}>
                <p className="text-sm font-medium mb-2" style={{ color: COLORS.incomeColor }}>
                  ✓ All {currentSectionCategories.length} categories will be available
                </p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                  You'll see all subcategories in the dropdown when categorizing transactions.
                </p>
              </div>
            )}

            {sectionMode === 'none' && (
              <div className="p-4 rounded-lg border" style={{ backgroundColor: `${COLORS.mediumGray}15`, borderColor: COLORS.mediumGray }}>
                <p className="text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                  All categories hidden
                </p>
                <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                  Transactions will default to "{currentSectionName.split(' ').map((w, i) => i === 0 ? w : w.toLowerCase()).join(' ')} Unclassified" and can be refined later.
                </p>
              </div>
            )}

            {sectionMode === 'some' && (
              <div className="space-y-2 border rounded-lg p-4" style={{ borderColor: COLORS.lightGray }}>
                <p className="text-sm font-medium mb-3" style={{ color: COLORS.darkGray }}>
                  Select categories to show:
                </p>
                {currentSectionCategories.map(category => (
                  <label
                    key={category.code}
                    className="flex items-center gap-3 p-3 rounded hover:bg-gray-50 cursor-pointer border"
                    style={{ borderColor: category.visible ? COLORS.incomeColor : COLORS.lightGray }}
                  >
                    <input
                      type="checkbox"
                      checked={category.visible}
                      onChange={() => handleToggleCategory(category.code)}
                      className="h-5 w-5"
                      style={{ accentColor: COLORS.slainteBlue }}
                    />
                    <span className="flex-1" style={{ color: COLORS.darkGray }}>{category.name}</span>
                    {category.visible ? (
                      <Eye className="h-4 w-4" style={{ color: COLORS.incomeColor }} />
                    ) : (
                      <EyeOff className="h-4 w-4" style={{ color: COLORS.lightGray }} />
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}15` }}>
              <p className="text-xs" style={{ color: COLORS.darkGray }}>
                💡 <strong>Tip:</strong> You can always customize this later in Admin Settings. The defaults work well for most practices!
              </p>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={handlePrevSection}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                {currentSectionIndex === 0 ? 'Back' : 'Previous Section'}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={nextStage}
                  className="px-4 py-2 border rounded-lg text-sm"
                  style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                >
                  Skip All
                </button>
                <button
                  onClick={handleNextSection}
                  className="px-6 py-2 rounded-lg text-white flex items-center gap-2"
                  style={{ backgroundColor: COLORS.slainteBlue }}
                >
                  {isLastSection ? 'Complete' : 'Next Section'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );

      case STAGES.REVIEW:
        const previewCategories = generateAllCategories();
        const staffCount = previewCategories.filter(c =>
          c.section === 'DIRECT STAFF COSTS' &&
          c.personalization === 'Personalized'
        ).length;
        const partnerCount = previewCategories.filter(c =>
          c.section === 'NON-BUSINESS' &&
          c.name.includes('Partner')
        ).length;

        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: COLORS.incomeColor }} />
              <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                Review Your Setup
              </h2>
            </div>

            <div className="p-6 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
              <h3 className="font-semibold mb-4" style={{ color: COLORS.incomeColor }}>
                Configuration Summary for {responses.practiceName}
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium" style={{ color: COLORS.darkGray }}>Staff Categories:</p>
                  <p style={{ color: COLORS.mediumGray }}>{staffCount} individual staff members</p>
                </div>

                <div>
                  <p className="font-medium" style={{ color: COLORS.darkGray }}>Partner Categories:</p>
                  <p style={{ color: COLORS.mediumGray }}>{partnerCount} partners</p>
                </div>

                <div>
                  <p className="font-medium" style={{ color: COLORS.darkGray }}>Total Categories:</p>
                  <p style={{ color: COLORS.mediumGray }}>{previewCategories.length} active</p>
                </div>

                <div>
                  <p className="font-medium" style={{ color: COLORS.darkGray }}>Location:</p>
                  <p style={{ color: COLORS.mediumGray }}>{responses.location}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
              <p className="text-sm" style={{ color: COLORS.slainteBlue }}>
                <strong>What happens next:</strong> Your personalized category structure
                will be saved and ready to use immediately. You can start uploading
                transactions right away!
              </p>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={prevStage}
                className="px-6 py-2 border rounded-lg flex items-center gap-2"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleComplete}
                className="px-8 py-3 rounded-lg text-lg font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.incomeColor }}
              >
                Complete Setup
                <CheckCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        );

      default:
        return <div>Stage not implemented</div>;
    }
  };

  const stageOrder = Object.values(STAGES);
  const currentStageIndex = stageOrder.indexOf(stage);

  // Calculate total steps including individual category sections
  const getCategorySectionCount = () => {
    if (stage === STAGES.CATEGORY_PREFERENCES) {
      const categoriesToConfigure = generateAllCategories();
      const categoriesBySection = getCategoriesBySection(categoriesToConfigure, responses.categoryPreferences);
      return Object.entries(categoriesBySection).filter(([section, categories]) => categories.length > 0).length;
    }
    return 0;
  };

  const categorySectionCount = getCategorySectionCount();
  // Base stages + category sections (treating CATEGORY_PREFERENCES as multiple steps)
  const totalSteps = stageOrder.length - 2 + (categorySectionCount > 0 ? categorySectionCount - 1 : 0); // -2 for WELCOME and COMPLETE, -1 because one section already counted

  // Calculate current step
  const getCurrentStep = () => {
    if (stage === STAGES.CATEGORY_PREFERENCES) {
      return currentStageIndex + responses.categoryPreferencesSection;
    }
    return currentStageIndex;
  };

  const currentStep = getCurrentStep();
  const progress = stage === STAGES.WELCOME ? 0 : ((currentStep) / totalSteps) * 100;

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: COLORS.backgroundGray }}>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
        {/* Progress indicator */}
        {stage !== STAGES.WELCOME && stage !== STAGES.COMPLETE && (
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2" style={{ color: COLORS.mediumGray }}>
              <span>Setup Progress</span>
              <span>
                {currentStep} / {totalSteps}
              </span>
            </div>
            <div className="w-full rounded-full h-2" style={{ backgroundColor: COLORS.lightGray }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  backgroundColor: COLORS.slainteBlue,
                  width: `${progress}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Render current stage */}
        {renderStage()}
      </div>
    </div>
  );
}
