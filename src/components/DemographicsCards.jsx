// src/components/DemographicsCards.jsx
import React from 'react';
import { User } from 'lucide-react';
import COLORS from '../utils/colors';

export const DemographicsCards = ({ data }) => {
    return (
        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                <User style={{ color: COLORS.slainteBlue }} />
                Latest Patient Demographics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>Total Panel Size</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>{data.totalPanelSize.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}20` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>Patients Over 70</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>{data.totalPatientsOver70.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}30` }}>
                    <h4 className="font-semibold" style={{ color: COLORS.darkGray }}>Nursing Home Residents</h4>
                    <p className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>{data.totalNursingHome.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};