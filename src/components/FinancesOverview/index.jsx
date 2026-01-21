import React, { useState } from 'react';
import COLORS from '../../utils/colors';
import OverviewSection from './OverviewSection';
import ReportsModal from './ReportsModal';
import TransactionListModal from '../TransactionListModal';

/**
 * FinancesOverview - Consolidated financial management tab
 * Shows Overview with clickable boxes for Reports and Transactions modals
 */
const FinancesOverview = ({ setCurrentView }) => {
  // Modal states
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

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
      <TransactionListModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />
    </div>
  );
};

export default FinancesOverview;
