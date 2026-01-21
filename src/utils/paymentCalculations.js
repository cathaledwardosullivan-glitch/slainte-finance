// src/utils/paymentCalculations.js

export const getLatestMonthData = (paymentAnalysisData, selectedYear) => {
    const emptyResult = {
        totalPanelSize: 0,
        totalPatientsOver70: 0,
        totalNursingHome: 0,
        totalSTCClaims: 0,
        totalSTCClaimsPaid: 0,
        totalAnnualLeaveBalance: 0,
        totalStudyLeaveBalance: 0
    };

    if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
        return emptyResult;
    }

    // First try to get data for the selected year
    let currentYearData = paymentAnalysisData.filter(d => String(d.year) === String(selectedYear));

    // If no data for selected year, find the most recent year with data
    if (currentYearData.length === 0) {
        const availableYears = [...new Set(paymentAnalysisData.map(d => d.year))].sort((a, b) => b - a);
        if (availableYears.length > 0) {
            const mostRecentYear = availableYears[0];
            currentYearData = paymentAnalysisData.filter(d => String(d.year) === String(mostRecentYear));
            console.log(`📊 Dashboard: No PCRS data for ${selectedYear}, using most recent year: ${mostRecentYear}`);
        }
    }

    if (currentYearData.length === 0) {
        return emptyResult;
    }

    // Find the latest month with data
    let latestMonth = null;
    for (const month of ['Dec', 'Nov', 'Oct', 'Sep', 'Aug', 'Jul', 'Jun', 'May', 'Apr', 'Mar', 'Feb', 'Jan']) {
        if (currentYearData.some(d => d.month === month)) {
            latestMonth = month;
            break;
        }
    }

    const monthData = latestMonth ? currentYearData.filter(d => d.month === latestMonth) : [];

    // Calculate and return all summary figures
    return {
        totalPanelSize: monthData.reduce((sum, data) => sum + (data.panelSize || 0), 0),
        totalPatientsOver70: monthData.reduce((sum, data) => sum + (data.demographics?.total70Plus || 0), 0),
        totalNursingHome: monthData.reduce((sum, data) => sum + ((data.demographics?.nursingHome70Plus || 0) + (data.demographics?.stateMed70Plus || 0)), 0),
        totalSTCClaims: monthData.reduce((sum, data) => sum + (data.claims?.stcClaims || data.numberOfClaims || 0), 0),
        totalSTCClaimsPaid: monthData.reduce((sum, data) => sum + (data.claims?.stcClaimsPaid || data.claimsPaid || 0), 0),
        totalAnnualLeaveBalance: monthData.reduce((sum, data) => sum + (data.leaveData?.annualLeaveBalance || 0), 0),
        totalStudyLeaveBalance: monthData.reduce((sum, data) => sum + (data.leaveData?.studyLeaveBalance || 0), 0)
    };
};