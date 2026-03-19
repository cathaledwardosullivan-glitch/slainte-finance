import React from 'react';
import COLORS from '../../../utils/colors';
import AccountantExport from '../../AccountantExport';

/**
 * AccountantDataSection - Settings section for accountant data exports
 * Wraps the AccountantExport component for the Settings modal
 */
const AccountantDataSection = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <AccountantExport />
      </div>
    </div>
  );
};

export default AccountantDataSection;
