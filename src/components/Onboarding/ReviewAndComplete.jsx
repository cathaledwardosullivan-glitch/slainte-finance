import React from 'react';
import { CheckCircle, ArrowLeft, Sparkles } from 'lucide-react';
import COLORS from '../../utils/colors';
import { getTotalGPs, getStaffCountByRole } from '../../data/practiceProfileSchemaV2';

export default function ReviewAndComplete({ profile, onComplete, onBack }) {
  const totalGPs = getTotalGPs(profile);
  const staffCounts = getStaffCountByRole(profile);
  const totalStaff = Object.values(staffCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Success Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: `${COLORS.incomeColor}15`,
          marginBottom: '1rem'
        }}>
          <CheckCircle style={{ width: '48px', height: '48px', color: COLORS.incomeColor }} />
        </div>

        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: COLORS.darkGray,
          marginBottom: '0.5rem'
        }}>
          Setup Complete!
        </h2>

        <p style={{
          fontSize: '1rem',
          color: COLORS.mediumGray,
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Here's what we've set up for {profile.practiceDetails.practiceName}
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* Practice Details Card */}
        <div style={{
          padding: '1.5rem',
          backgroundColor: COLORS.backgroundGray,
          borderRadius: '12px',
          border: `1px solid ${COLORS.lightGray}`
        }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <p style={{
                fontSize: '0.75rem',
                color: COLORS.mediumGray,
                marginBottom: '0.25rem'
              }}>
                Name
              </p>
              <p style={{
                fontSize: '1rem',
                fontWeight: 500,
                color: COLORS.darkGray
              }}>
                {profile.practiceDetails.practiceName}
              </p>
            </div>
            {profile.practiceDetails.locations?.length > 0 && (
              <div>
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.mediumGray,
                  marginBottom: '0.25rem'
                }}>
                  Location{profile.practiceDetails.locations.length > 1 ? 's' : ''}
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: COLORS.darkGray
                }}>
                  {profile.practiceDetails.locations.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* GPs Card */}
        <div style={{
          padding: '1.5rem',
          backgroundColor: COLORS.backgroundGray,
          borderRadius: '12px',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          <h3 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: COLORS.mediumGray,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '1rem'
          }}>
            GP Structure
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <p style={{
                fontSize: '0.75rem',
                color: COLORS.mediumGray,
                marginBottom: '0.25rem'
              }}>
                Partners
              </p>
              <p style={{
                fontSize: '1rem',
                fontWeight: 500,
                color: COLORS.darkGray
              }}>
                {profile.gps.partners?.length || 0}
              </p>
              {profile.gps.partners?.length > 0 && (
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.mediumGray,
                  marginTop: '0.25rem'
                }}>
                  {profile.gps.partners.map(p => p.name).join(', ')}
                </p>
              )}
            </div>
            {profile.gps.salaried?.length > 0 && (
              <div>
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.mediumGray,
                  marginBottom: '0.25rem'
                }}>
                  Salaried GPs
                </p>
                <p style={{
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: COLORS.darkGray
                }}>
                  {profile.gps.salaried.length}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Staff Card */}
        <div style={{
          padding: '1.5rem',
          backgroundColor: COLORS.backgroundGray,
          borderRadius: '12px',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          <h3 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: COLORS.mediumGray,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '1rem'
          }}>
            Staff Members
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {totalStaff === 0 ? (
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.mediumGray
              }}>
                No staff members added
              </p>
            ) : (
              <>
                {staffCounts.reception > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>Reception</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>
                      {staffCounts.reception}
                    </span>
                  </div>
                )}
                {staffCounts.nursing > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>Nursing</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>
                      {staffCounts.nursing}
                    </span>
                  </div>
                )}
                {staffCounts.phlebotomy > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>Phlebotomy</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>
                      {staffCounts.phlebotomy}
                    </span>
                  </div>
                )}
                {staffCounts.gp_assistant > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>GP Assistants</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>
                      {staffCounts.gp_assistant}
                    </span>
                  </div>
                )}
                {staffCounts.management > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>Management</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>
                      {staffCounts.management}
                    </span>
                  </div>
                )}
                <div style={{
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: `1px solid ${COLORS.lightGray}`,
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.darkGray }}>Total</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.slainteBlue }}>
                    {totalStaff}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Operational Details Card */}
        <div style={{
          padding: '1.5rem',
          backgroundColor: COLORS.backgroundGray,
          borderRadius: '12px',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          <h3 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: COLORS.mediumGray,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '1rem'
          }}>
            Operational Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.practiceDetails.accountant && (
              <div>
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.mediumGray,
                  marginBottom: '0.25rem'
                }}>
                  Accountant
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: COLORS.darkGray
                }}>
                  {profile.practiceDetails.accountant}
                </p>
              </div>
            )}
            {profile.practiceDetails.yearEndDate && (
              <div>
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.mediumGray,
                  marginBottom: '0.25rem'
                }}>
                  Year-End Date
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: COLORS.darkGray
                }}>
                  {profile.practiceDetails.yearEndDate}
                </p>
              </div>
            )}
            {profile.practiceDetails.superannuationAllocation && (
              <div>
                <p style={{
                  fontSize: '0.75rem',
                  color: COLORS.mediumGray,
                  marginBottom: '0.25rem'
                }}>
                  Superannuation
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: COLORS.darkGray
                }}>
                  {profile.practiceDetails.superannuationAllocation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What's Next Box */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: `${COLORS.slainteBlue}10`,
        border: `2px solid ${COLORS.slainteBlue}`,
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <Sparkles style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: COLORS.darkGray,
            margin: 0
          }}>
            What happens next?
          </h3>
        </div>
        <ul style={{
          margin: 0,
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li style={{
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            lineHeight: 1.6
          }}>
            We've created <strong>{profile.gps.partners?.length || 0} partner drawing categories</strong> and{' '}
            <strong>{totalStaff + (profile.gps.salaried?.length || 0)} staff expense categories</strong>
          </li>
          <li style={{
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            lineHeight: 1.6
          }}>
            Your transaction categories are personalized with automatic pattern matching
          </li>
          <li style={{
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            lineHeight: 1.6
          }}>
            You can start uploading transactions immediately
          </li>
          <li style={{
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            lineHeight: 1.6
          }}>
            All settings can be updated anytime in Admin Settings
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            color: COLORS.mediumGray,
            backgroundColor: 'transparent',
            border: `2px solid ${COLORS.lightGray}`,
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          Back
        </button>

        <button
          onClick={onComplete}
          style={{
            padding: '0.875rem 2.5rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: COLORS.white,
            backgroundColor: COLORS.incomeColor,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#15803d';
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = COLORS.incomeColor;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
          }}
        >
          <CheckCircle style={{ width: '20px', height: '20px' }} />
          Complete Setup
        </button>
      </div>
    </div>
  );
}
