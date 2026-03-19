// src/components/ClaimsCards.jsx
import React from 'react';
import { Activity } from 'lucide-react';
import COLORS from '../utils/colors';

export const ClaimsCards = ({ data }) => {
    return (
        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                <Activity style={{ color: COLORS.slainteBlue }} />
                Latest Claims & Leave Data
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>STC Claims</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{data.totalSTCClaims.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.incomeColor }}>STC Claims Paid</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{data.totalSTCClaimsPaid.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}30` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.textPrimary }}>Annual Leave Balance</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{data.totalAnnualLeaveBalance.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.expenseColor }}>Study Leave Balance</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{data.totalStudyLeaveBalance.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};