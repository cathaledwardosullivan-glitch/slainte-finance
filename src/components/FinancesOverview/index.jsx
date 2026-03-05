import React, { useState, useEffect } from 'react';
import COLORS from '../../utils/colors';
import OverviewSection from './OverviewSection';
import ReportsModal from './ReportsModal';
import TransactionListModalV2 from '../TransactionListModalV2';

/**
 * FinancesOverview - Consolidated financial management tab
 * Shows Overview with clickable boxes for Reports and Transactions modals
 */
const FinancesOverview = ({ setCurrentView }) => {
  // Modal states
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Listen for tour/task events to open/close modals
  useEffect(() => {
    const handleOpenReports = () => setShowReportsModal(true);
    const handleCloseReports = () => setShowReportsModal(false);
    const handleOpenTransactions = () => setShowTransactionModal(true);

    window.addEventListener('tour:openReportsModal', handleOpenReports);
    window.addEventListener('tour:closeReportsModal', handleCloseReports);
    window.addEventListener('task:openTransactions', handleOpenTransactions);

    return () => {
      window.removeEventListener('tour:openReportsModal', handleOpenReports);
      window.removeEventListener('tour:closeReportsModal', handleCloseReports);
      window.removeEventListener('task:openTransactions', handleOpenTransactions);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Content area - directly show OverviewSection */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: COLORS.backgroundGray
        }}
      >
        <OverviewSection
          setCurrentView={setCurrentView}
          onOpenReports={() => setShowReportsModal(true)}
          onOpenTransactions={() => setShowTransactionModal(true)}
        />
      </div>

      {/* Reports Modal */}
      <ReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        setCurrentView={setCurrentView}
      />

      {/* Transaction List Modal */}
      <TransactionListModalV2
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />
    </div>
  );
};

export default FinancesOverview;
