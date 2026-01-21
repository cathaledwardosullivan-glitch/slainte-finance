import React, { useState } from 'react';
import { usePracticeProfile } from '../../../hooks/usePracticeProfile';
import {
  Building2,
  UserCog,
  Activity,
  Edit3
} from 'lucide-react';
import COLORS from '../../../utils/colors';
import PracticeOnboarding from '../../PracticeOnboarding';

/**
 * PracticeProfileSection - Practice profile viewer and editor
 */
const PracticeProfileSection = () => {
  const { profile } = usePracticeProfile();

  // Practice Profile state
  const [showOnboardingEdit, setShowOnboardingEdit] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Edit Button and Status at Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: COLORS.backgroundGray, borderRadius: '0.5rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
            Setup Status:{' '}
            <span style={{ fontWeight: 500, color: profile?.metadata?.setupComplete ? '#16A34A' : '#CA8A04' }}>
              {profile?.metadata?.setupComplete ? '✓ Complete' : '⏳ In Progress'}
            </span>
          </p>
          {profile?.metadata?.lastUpdated && (
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: COLORS.mediumGray }}>
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
      <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
        <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
          <Building2 style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
          Practice Details
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Practice Name:</span>
            <p style={{ fontWeight: 500, color: COLORS.darkGray }}>
              {profile?.practiceDetails?.practiceName || <em style={{ color: '#9CA3AF' }}>Not set</em>}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Location:</span>
            <p style={{ fontWeight: 500, color: COLORS.darkGray }}>
              {(() => {
                if (profile?.practiceDetails?.locations?.length > 0) {
                  return profile.practiceDetails.locations.join(', ');
                }
                return profile?.practiceDetails?.location || <em style={{ color: '#9CA3AF' }}>Not set</em>;
              })()}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Number of GPs:</span>
            <p style={{ fontWeight: 500, color: COLORS.darkGray }}>
              {(() => {
                const partners = profile?.gps?.partners?.length || 0;
                const salaried = profile?.gps?.salaried?.length || 0;
                const total = partners + salaried;
                if (total > 0) {
                  return `${total} (${partners} partner${partners !== 1 ? 's' : ''}, ${salaried} salaried)`;
                }
                return profile?.practiceDetails?.numberOfGPs ?? <em style={{ color: '#9CA3AF' }}>Not set</em>;
              })()}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Practice Type:</span>
            <p style={{ fontWeight: 500, color: COLORS.darkGray }}>
              {(() => {
                const partners = profile?.gps?.partners?.length || 0;
                if (partners > 1) return 'Partnership';
                if (partners === 1) return 'Single-Handed';
                return profile?.practiceDetails?.practiceType || <em style={{ color: '#9CA3AF' }}>Not set</em>;
              })()}
            </p>
          </div>
        </div>
      </div>

      {/* GP Partners */}
      {profile?.gps?.partners && profile.gps.partners.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
            <UserCog style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            GP Partners ({profile.gps.partners.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {profile.gps.partners.map((partner, idx) => (
              <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.backgroundGray, border: `1px solid ${COLORS.lightGray}` }}>
                <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{partner.name || `Partner ${idx + 1}`}</p>
                {partner.profitShare && <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>{partner.profitShare}% profit share</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salaried GPs */}
      {profile?.gps?.salaried && profile.gps.salaried.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
            <UserCog style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            Salaried GPs ({profile.gps.salaried.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {profile.gps.salaried.map((gp, idx) => (
              <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.backgroundGray, border: `1px solid ${COLORS.lightGray}` }}>
                <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{gp.name || `Salaried GP ${idx + 1}`}</p>
                <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>Salaried GP</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Members */}
      {profile?.staff && profile.staff.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
            <UserCog style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            Staff Members ({profile.staff.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {profile.staff.map((staff, idx) => (
              <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.backgroundGray, border: `1px solid ${COLORS.lightGray}` }}>
                <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{staff.name || `Staff ${idx + 1}`}</p>
                {staff.role && (
                  <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, textTransform: 'capitalize' }}>
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
        <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
            <Activity style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
            GMS Contract
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {profile.gmsContract.panelSize && (
              <div>
                <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Panel Size:</span>
                <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{profile.gmsContract.panelSize.toLocaleString()} patients</p>
              </div>
            )}
            {profile.gmsContract.averageCapitationRate && (
              <div>
                <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Avg Capitation Rate:</span>
                <p style={{ fontWeight: 500, color: COLORS.darkGray }}>€{profile.gmsContract.averageCapitationRate}/patient/year</p>
              </div>
            )}
            {profile.gmsContract.gmsIncomePercentage && (
              <div>
                <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>GMS % of Income:</span>
                <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{profile.gmsContract.gmsIncomePercentage}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Practice Onboarding Edit Modal */}
      {showOnboardingEdit && (
        <PracticeOnboarding
          isEditMode={true}
          onComplete={() => setShowOnboardingEdit(false)}
          onCancel={() => setShowOnboardingEdit(false)}
        />
      )}
    </div>
  );
};

export default PracticeProfileSection;
