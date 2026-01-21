import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { usePracticeProfile } from '../../../hooks/usePracticeProfile';
import {
  Settings,
  CheckCircle,
  AlertCircle,
  Download,
  Upload,
  FileText,
  Layers,
  Building2,
  UserCog,
  Activity,
  ChevronDown
} from 'lucide-react';
import COLORS from '../../../utils/colors';
import PracticeOnboarding from '../../PracticeOnboarding';
import CategoryRefinementWizard from '../../CategoryRefinementWizard';
import { shouldRecommendRefinement } from '../../../utils/categoryRefinementUtils';

/**
 * AppSettingsSection - App settings and system status
 * System Status, Practice Profile, App Updates
 */
const AppSettingsSection = () => {
  const {
    transactions,
    unidentifiedTransactions
  } = useAppContext();

  const { profile } = usePracticeProfile();

  // App Updates state
  const [showAppUpdates, setShowAppUpdates] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Practice Profile state
  const [showPracticeProfileViewer, setShowPracticeProfileViewer] = useState(false);
  const [showOnboardingEdit, setShowOnboardingEdit] = useState(false);

  // Refinement Wizard state
  const [showRefinementWizard, setShowRefinementWizard] = useState(false);

  // Calculate refinement check
  const refinementCheck = shouldRecommendRefinement(transactions);

  // Load app version and setup update listeners
  useEffect(() => {
    // Get app version
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(version => {
        setAppVersion(version);
      });
    }

    // Setup update event listeners
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus('available');
        setUpdateInfo(info);
      });
    }

    if (window.electronAPI?.onUpdateDownloading) {
      window.electronAPI.onUpdateDownloading(() => {
        setUpdateStatus('downloading');
      });
    }

    if (window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((progress) => {
        setDownloadProgress(progress.percent);
      });
    }

    if (window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateStatus('ready');
        setUpdateInfo(info);
      });
    }

    if (window.electronAPI?.onUpdateError) {
      window.electronAPI.onUpdateError((error) => {
        setUpdateStatus('error');
        console.error('Update error:', error);
      });
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.electronAPI?.checkForUpdates) {
      setUpdateStatus('checking');
      try {
        await window.electronAPI.checkForUpdates();
      } catch (error) {
        setUpdateStatus('error');
        console.error('Check for updates error:', error);
      }
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  // Calculate data freshness
  const getDataFreshness = () => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const latestTransaction = transactions.reduce((latest, t) => {
      if (!t.date) return latest;
      const tDate = new Date(t.date);
      return !latest || tDate > latest ? tDate : latest;
    }, null);

    const isStale = latestTransaction && latestTransaction < oneMonthAgo;
    const daysSinceLatest = latestTransaction
      ? Math.floor((now - latestTransaction) / (1000 * 60 * 60 * 24))
      : null;

    return { latestTransaction, isStale, daysSinceLatest };
  };

  const dataFreshness = getDataFreshness();

  // Check if P&L report is due
  const getPLReportStatus = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const shouldGeneratePriorYear = currentMonth < 3;
    const reportYear = shouldGeneratePriorYear ? currentYear - 1 : currentYear;

    const hasDataForYear = transactions.some(t => {
      if (!t.date) return false;
      return new Date(t.date).getFullYear() === reportYear;
    });

    return {
      reportDue: shouldGeneratePriorYear && hasDataForYear,
      reportYear
    };
  };

  const plReportStatus = getPLReportStatus();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* System Status */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.darkGray }}>
            <Settings style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
            System Status
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {unidentifiedTransactions.length === 0 ? (
              <>
                <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: '#22C55E', borderRadius: '9999px' }}></div>
                <span style={{ fontSize: '0.875rem', color: '#16A34A', fontWeight: 500 }}>Excellent - All transactions categorized</span>
              </>
            ) : unidentifiedTransactions.length < transactions.length * 0.1 ? (
              <>
                <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: '#EAB308', borderRadius: '9999px' }}></div>
                <span style={{ fontSize: '0.875rem', color: '#CA8A04', fontWeight: 500 }}>Good - {((transactions.length / (transactions.length + unidentifiedTransactions.length)) * 100).toFixed(1)}% categorized</span>
              </>
            ) : (
              <>
                <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: '#EF4444', borderRadius: '9999px' }}></div>
                <span style={{ fontSize: '0.875rem', color: '#DC2626', fontWeight: 500 }}>Needs attention - Many unidentified transactions</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {/* Total Transactions */}
          <div style={{ backgroundColor: '#F0FDF4', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #BBF7D0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#16A34A' }}>Total Transactions</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803D' }}>{transactions.length}</p>
                <p style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '0.25rem' }}>Successfully categorized</p>
              </div>
              <CheckCircle style={{ height: '2rem', width: '2rem', color: '#16A34A' }} />
            </div>
          </div>

          {/* Unidentified */}
          <div style={{ backgroundColor: '#FEFCE8', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #FEF08A' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#CA8A04' }}>Unidentified</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#A16207' }}>{unidentifiedTransactions.length}</p>
                <p style={{ fontSize: '0.75rem', color: '#CA8A04', marginTop: '0.25rem' }}>Require manual review</p>
              </div>
              <AlertCircle style={{ height: '2rem', width: '2rem', color: '#CA8A04' }} />
            </div>
          </div>

          {/* Partially Classified */}
          <button
            onClick={() => refinementCheck.shouldShow && setShowRefinementWizard(true)}
            disabled={!refinementCheck.shouldShow}
            style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              border: refinementCheck.shouldShow ? '1px solid #BFDBFE' : '1px solid #E5E7EB',
              backgroundColor: refinementCheck.shouldShow ? '#EFF6FF' : '#F9FAFB',
              cursor: refinementCheck.shouldShow ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              transition: 'background-color 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: refinementCheck.shouldShow ? '#2563EB' : '#6B7280' }}>
                  Partially Classified
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: refinementCheck.shouldShow ? '#1D4ED8' : '#374151' }}>
                  {refinementCheck.count}
                </p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: refinementCheck.shouldShow ? '#2563EB' : '#6B7280' }}>
                  {refinementCheck.shouldShow ? `${refinementCheck.percentage}% - Click to refine` : 'All specific'}
                </p>
              </div>
              <Layers style={{ height: '2rem', width: '2rem', color: refinementCheck.shouldShow ? '#2563EB' : '#9CA3AF' }} />
            </div>
          </button>

          {/* Data Freshness */}
          <div style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            border: dataFreshness.isStale ? '1px solid #FED7AA' : '1px solid #BFDBFE',
            backgroundColor: dataFreshness.isStale ? '#FFF7ED' : '#EFF6FF'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: dataFreshness.isStale ? '#EA580C' : '#2563EB' }}>
                  Data Freshness
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: dataFreshness.isStale ? '#C2410C' : '#1D4ED8' }}>
                  {dataFreshness.latestTransaction ? `${dataFreshness.daysSinceLatest}d` : 'N/A'}
                </p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: dataFreshness.isStale ? '#EA580C' : '#2563EB' }}>
                  {dataFreshness.isStale ? 'Upload needed' : 'Up to date'}
                </p>
              </div>
              {dataFreshness.isStale ? (
                <Upload style={{ height: '2rem', width: '2rem', color: '#EA580C' }} />
              ) : (
                <CheckCircle style={{ height: '2rem', width: '2rem', color: '#2563EB' }} />
              )}
            </div>
          </div>
        </div>

        {/* P&L Report Status */}
        {plReportStatus.reportDue && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#FAF5FF', borderRadius: '0.5rem', border: '1px solid #E9D5FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#7C3AED' }}>
                P&L Report for {plReportStatus.reportYear} is ready to generate
              </span>
              <FileText style={{ height: '1.25rem', width: '1.25rem', color: '#7C3AED' }} />
            </div>
          </div>
        )}
      </div>

      {/* Practice Profile Section */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <button
          onClick={() => setShowPracticeProfileViewer(!showPracticeProfileViewer)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: showPracticeProfileViewer ? '1rem' : 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.darkGray }}>
            <Building2 style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
            Practice Profile
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {profile?.practiceDetails?.practiceName && (
              <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: `${COLORS.incomeColor}20`, color: COLORS.incomeColor }}>
                {profile.practiceDetails.practiceName}
              </span>
            )}
            <ChevronDown
              style={{
                height: '1.25rem',
                width: '1.25rem',
                transition: 'transform 0.2s',
                transform: showPracticeProfileViewer ? 'rotate(180deg)' : 'rotate(0)',
                color: COLORS.slainteBlue
              }}
            />
          </div>
        </button>

        {showPracticeProfileViewer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Practice Details */}
            <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
              <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
                <Building2 style={{ height: '1rem', width: '1rem' }} />
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
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
                  <UserCog style={{ height: '1rem', width: '1rem' }} />
                  GP Partners ({profile.gps.partners.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {profile.gps.partners.map((partner, idx) => (
                    <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                      <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{partner.name || `Partner ${idx + 1}`}</p>
                      {partner.profitShare && <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>{partner.profitShare}% profit share</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Salaried GPs */}
            {profile?.gps?.salaried && profile.gps.salaried.length > 0 && (
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
                  <UserCog style={{ height: '1rem', width: '1rem' }} />
                  Salaried GPs ({profile.gps.salaried.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {profile.gps.salaried.map((gp, idx) => (
                    <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                      <p style={{ fontWeight: 500, color: COLORS.darkGray }}>{gp.name || `Salaried GP ${idx + 1}`}</p>
                      <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>Salaried GP</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staff Members */}
            {profile?.staff && profile.staff.length > 0 && (
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
                  <UserCog style={{ height: '1rem', width: '1rem' }} />
                  Staff Members ({profile.staff.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {profile.staff.map((staff, idx) => (
                    <div key={idx} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
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
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.darkGray }}>
                  <Activity style={{ height: '1rem', width: '1rem' }} />
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

            {/* Metadata & Edit Button */}
            <div style={{ padding: '1rem', borderRadius: '0.5rem', border: `2px dashed ${COLORS.lightGray}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: COLORS.slainteBlue,
                    color: COLORS.white,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* App Updates Section */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <button
          onClick={() => setShowAppUpdates(!showAppUpdates)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: showAppUpdates ? '1rem' : 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.darkGray }}>
            <Download style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
            App Updates
          </h3>
          <ChevronDown
            style={{
              height: '1.25rem',
              width: '1.25rem',
              transition: 'transform 0.2s',
              transform: showAppUpdates ? 'rotate(180deg)' : 'rotate(0)',
              color: COLORS.slainteBlue
            }}
          />
        </button>

        {showAppUpdates && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Current Version */}
            <div style={{ padding: '1rem', border: `1px solid ${COLORS.lightGray}`, borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Current Version</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray }}>
                    {appVersion || 'Loading...'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Status</p>
                  <p style={{
                    fontWeight: 500,
                    color: updateStatus === 'ready' ? COLORS.incomeColor :
                           updateStatus === 'available' ? COLORS.highlightYellow :
                           updateStatus === 'error' ? COLORS.expenseColor :
                           COLORS.darkGray
                  }}>
                    {updateStatus === 'idle' && 'Up to date'}
                    {updateStatus === 'checking' && 'Checking...'}
                    {updateStatus === 'available' && `v${updateInfo?.version} available`}
                    {updateStatus === 'downloading' && `Downloading... ${downloadProgress.toFixed(0)}%`}
                    {updateStatus === 'ready' && 'Ready to install'}
                    {updateStatus === 'error' && 'Update check failed'}
                  </p>
                </div>
              </div>

              {/* Download Progress Bar */}
              {updateStatus === 'downloading' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ height: '0.5rem', backgroundColor: '#E5E7EB', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${downloadProgress}%`,
                        height: '100%',
                        backgroundColor: COLORS.slainteBlue,
                        transition: 'width 0.3s'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Update Actions */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {(updateStatus === 'idle' || updateStatus === 'error') && (
                <button
                  onClick={handleCheckForUpdates}
                  disabled={updateStatus === 'checking'}
                  style={{
                    flex: 1,
                    padding: '0.5rem 1rem',
                    borderRadius: '0.25rem',
                    fontWeight: 500,
                    color: COLORS.white,
                    backgroundColor: COLORS.slainteBlue,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Download style={{ height: '1rem', width: '1rem' }} />
                  Check for Updates
                </button>
              )}

              {updateStatus === 'checking' && (
                <button
                  disabled
                  style={{
                    flex: 1,
                    padding: '0.5rem 1rem',
                    borderRadius: '0.25rem',
                    fontWeight: 500,
                    color: COLORS.white,
                    backgroundColor: COLORS.slainteBlue,
                    border: 'none',
                    opacity: 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '9999px',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Checking...
                </button>
              )}

              {updateStatus === 'ready' && (
                <button
                  onClick={handleInstallUpdate}
                  style={{
                    flex: 1,
                    padding: '0.5rem 1rem',
                    borderRadius: '0.25rem',
                    fontWeight: 500,
                    color: COLORS.white,
                    backgroundColor: COLORS.incomeColor,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <CheckCircle style={{ height: '1rem', width: '1rem' }} />
                  Restart & Install Update
                </button>
              )}
            </div>

            {/* Update Note */}
            <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
              Updates are downloaded automatically when available. Your data is preserved during updates.
            </p>
          </div>
        )}
      </div>

      {/* Practice Onboarding Edit Modal */}
      {showOnboardingEdit && (
        <PracticeOnboarding
          isEditMode={true}
          onComplete={() => setShowOnboardingEdit(false)}
          onCancel={() => setShowOnboardingEdit(false)}
        />
      )}

      {/* Category Refinement Wizard */}
      <CategoryRefinementWizard
        isOpen={showRefinementWizard}
        onClose={() => setShowRefinementWizard(false)}
      />

      {/* CSS Animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AppSettingsSection;
