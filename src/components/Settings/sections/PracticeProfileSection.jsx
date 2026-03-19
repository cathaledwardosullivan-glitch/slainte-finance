import React, { useState } from 'react';
import { usePracticeProfile } from '../../../hooks/usePracticeProfile';
import { useAppContext } from '../../../context/AppContext';
import {
  Building2,
  UserCog,
  Activity,
  Edit3
} from 'lucide-react';
import COLORS from '../../../utils/colors';
import StaffProfileForm from '../../Onboarding/StaffProfileForm';
import { generateCategoriesFromProfile } from '../../../utils/categoryGenerator';

/**
 * PracticeProfileSection - Practice profile viewer and editor
 */
const PracticeProfileSection = () => {
  const { profile, updateProfile } = usePracticeProfile();
  const { setCategoryMapping } = useAppContext();

  // Practice Profile state
  const [showOnboardingEdit, setShowOnboardingEdit] = useState(false);

  // Handle profile save from StaffProfileForm
  const handleProfileSave = (updatedProfile) => {
    // 1. Regenerate category mappings from updated profile
    const generatedCategories = generateCategoriesFromProfile(updatedProfile);
    setCategoryMapping(generatedCategories);

    // 2. Save profile with metadata
    updateProfile({
      ...updatedProfile,
      metadata: {
        ...updatedProfile.metadata,
        setupComplete: true,
        lastUpdated: new Date().toISOString()
      }
    });

    // 3. Close the edit modal
    setShowOnboardingEdit(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Edit Button and Status at Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: COLORS.bgPage, borderRadius: '0.5rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
            Setup Status:{' '}
            <span style={{ fontWeight: 500, color: profile?.metadata?.setupComplete ? COLORS.successDark : COLORS.warningDark }}>
              {profile?.metadata?.setupComplete ? '✓ Complete' : '⏳ In Progress'}
            </span>
          </p>
          {profile?.metadata?.lastUpdated && (
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: COLORS.textSecondary }}>
              Last updated: {new Date(profile.metadata.lastUpdated).toLocaleDateString('en-IE', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowOnboardingEdit(true)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            backgroundColor: COLORS.slainteBlue,
            color: COLORS.white,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Edit3 style={{ height: '1rem', width: '1rem' }} />
          Edit Profile
        </button>
      </div>

      {/* Practice Details */}
      <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}>
        <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textPrimary }}>
          <Building2 style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
          Practice Details
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Practice Name:</span>
            <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>
              {profile?.practiceDetails?.practiceName || <em style={{ color: COLORS.textSecondary }}>Not set</em>}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Location:</span>
            <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>
              {(() => {
                if (profile?.practiceDetails?.locations?.length > 0) {
                  return profile.practiceDetails.locations.join(', ');
                }
                return profile?.practiceDetails?.location || <em style={{ color: COLORS.textSecondary }}>Not set</em>;
              })()}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Number of GPs:</span>
            <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>
              {(() => {
                const partners = profile?.gps?.partners?.length || 0;
                const salaried = profile?.gps?.salaried?.length || 0;
                const total = partners + salaried;
                if (total > 0) {
                  return `${total} (${partners} partner${partners !== 1 ? 's' : ''}, ${salaried} salaried)`;
                }
                return profile?.practiceDetails?.numberOfGPs ?? <em style={{ color: COLORS.textSecondary }}>Not set</em>;
              })()}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Practice Type:</span>
            <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>
              {(() => {
                const partners = profile?.gps?.partners?.length || 0;
                if (partners > 1) return 'Partnership';
                if (partners === 1) return 'Single-Handed';
                return profile?.practiceDetails?.practiceType || <em style={{ color: COLORS.textSecondary }}>Not set</em>;
              })()}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Electronic Health Record (EHR):</span>
            <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>
              {(() => {
                const ehrLabels = {
                  socrates: 'Socrates',
                  healthone: 'HealthOne',
                  practicemanager: 'Helix Practice Manager',
                  completegp: 'CompleteGP',
                  other: 'Other'
                };
                const ehr = profile?.practiceDetails?.ehrSystem;
                return ehr ? (ehrLabels[ehr] || ehr) : <em style={{ color: COLORS.textSecondary }}>Not set</em>;
              })()}
            </p>
          </div>
        </div>
      </div>

      {/* GP Partners */}
      {profile?.gps?.partners && profile.gps.partners.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textPrimary }}>
            <UserCog style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            GP Partners ({profile.gps.partners.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {profile.gps.partners.map((partner, idx) => (
              <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.bgPage, border: `1px solid ${COLORS.borderLight}` }}>
                <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>{partner.name || `Partner ${idx + 1}`}</p>
                {partner.profitShare && <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>{partner.profitShare}% profit share</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salaried GPs */}
      {profile?.gps?.salaried && profile.gps.salaried.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textPrimary }}>
            <UserCog style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            Salaried GPs ({profile.gps.salaried.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {profile.gps.salaried.map((gp, idx) => (
              <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.bgPage, border: `1px solid ${COLORS.borderLight}` }}>
                <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>{gp.name || `Salaried GP ${idx + 1}`}</p>
                <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>Salaried GP</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Members */}
      {profile?.staff && profile.staff.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textPrimary }}>
            <UserCog style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            Staff Members ({profile.staff.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {profile.staff.map((staff, idx) => (
              <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.bgPage, border: `1px solid ${COLORS.borderLight}` }}>
                <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>{staff.name || `Staff ${idx + 1}`}</p>
                {staff.role && (
                  <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, textTransform: 'capitalize' }}>
                    {staff.role.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GMS Contract Info */}
      {(profile?.gmsContract?.panelSize || profile?.gmsContract?.gmsIncomePercentage) && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textPrimary }}>
            <Activity style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            GMS Contract
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {profile.gmsContract.panelSize && (
              <div>
                <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Panel Size:</span>
                <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>{profile.gmsContract.panelSize.toLocaleString()} patients</p>
              </div>
            )}
            {profile.gmsContract.averageCapitationRate && (
              <div>
                <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>Avg Capitation Rate:</span>
                <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>€{profile.gmsContract.averageCapitationRate}/patient/year</p>
              </div>
            )}
            {profile.gmsContract.gmsIncomePercentage && (
              <div>
                <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>GMS % of Income:</span>
                <p style={{ fontWeight: 500, color: COLORS.textPrimary }}>{profile.gmsContract.gmsIncomePercentage}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {showOnboardingEdit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '2rem'
          }}
          onClick={() => setShowOnboardingEdit(false)}
        >
          <div
            style={{
              backgroundColor: COLORS.bgPage,
              borderRadius: '16px',
              maxWidth: '1400px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <StaffProfileForm
              initialProfile={profile}
              onComplete={handleProfileSave}
              onBack={() => setShowOnboardingEdit(false)}
              submitLabel="Save Changes"
              backLabel="Cancel"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeProfileSection;
