import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Trash2, ChevronDown, ChevronUp, DollarSign, Users, Briefcase, TrendingUp, X } from 'lucide-react';
import { parsePCRSPaymentPDF, validateExtractedData } from '../utils/pdfParser';
import { PCRS_PAYMENT_CATEGORIES, MONTHS } from '../data/paymentCategories';
import { getUniquePanelCount, analyzeGMSIncome } from '../utils/healthCheckCalculations';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import COLORS from '../utils/colors';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const PaymentAnalysis = ({ setCurrentView, selectedYear: propSelectedYear, setSelectedYear: propSetSelectedYear, useRollingYear = false }) => {
    const {
        paymentAnalysisData,
        setPaymentAnalysisData
    } = useAppContext();
    const [uploadedFiles, setUploadedFiles] = useState([]);
    // Use prop if provided, otherwise use local state (for standalone usage)
    const [localSelectedYear, setLocalSelectedYear] = useState(new Date().getFullYear().toString());
    const selectedYear = propSelectedYear || localSelectedYear;
    const setSelectedYear = propSetSelectedYear || setLocalSelectedYear;

    // Calculate number of unique partners dynamically from PCRS data
    const partnerCount = useMemo(() => {
        return getUniquePanelCount(paymentAnalysisData);
    }, [paymentAnalysisData]);
    const [processing, setProcessing] = useState(false);
    const fileInputRef = useRef(null);

    // Collapsible section state
    const [paymentOverviewExpanded, setPaymentOverviewExpanded] = useState(false);
    const [uploadStatusExpanded, setUploadStatusExpanded] = useState(false);

    // GMS KPI state
    const { profile } = usePracticeProfile();
    const [showGMSKPIModal, setShowGMSKPIModal] = useState(null);

    // GMS Payment Category Chart state
    const [gmsChartMode, setGmsChartMode] = useState('capitation'); // 'capitation', 'stc', 'practiceSupport', 'locum', 'cervical', 'maternity', 'other'

    // Handle file upload and processing
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setProcessing(true);

        for (const file of files) {
            if (file.type === 'application/pdf') {
                // Add file to uploaded list with processing status
                const fileEntry = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    size: file.size,
                    status: 'processing',
                    uploadTime: new Date(),
                    error: null
                };

                setUploadedFiles(prev => [...prev, fileEntry]);

                try {
                    // Parse the PDF
                    const extractedData = await parsePCRSPaymentPDF(file);
                    extractedData.fileName = file.name;

                    // Validate the extracted data
                    const validationErrors = validateExtractedData(extractedData);

                    if (validationErrors.length > 0) {
                        // Update file status to error
                        setUploadedFiles(prev =>
                            prev.map(f =>
                                f.id === fileEntry.id
                                    ? { ...f, status: 'error', error: validationErrors.join(', ') }
                                    : f
                            )
                        );
                        continue;
                    }

                    // Add to persistent payment data
                    setPaymentAnalysisData(prev => {
                        // Check for duplicates (same doctor, same month)
                        const existing = prev.findIndex(
                            d => d.doctorNumber === extractedData.doctorNumber &&
                                d.month === extractedData.month &&
                                d.year === extractedData.year
                        );

                        if (existing >= 0) {
                            // Replace existing data
                            const updated = [...prev];
                            updated[existing] = extractedData;
                            return updated;
                        } else {
                            // Add new data
                            return [...prev, extractedData];
                        }
                    });

                    // Update file status to completed
                    setUploadedFiles(prev =>
                        prev.map(f =>
                            f.id === fileEntry.id
                                ? { ...f, status: 'completed', extractedData }
                                : f
                        )
                    );

                } catch (error) {
                    console.error('Error processing PDF:', error);
                    // Update file status to error
                    setUploadedFiles(prev =>
                        prev.map(f =>
                            f.id === fileEntry.id
                                ? { ...f, status: 'error', error: error.message }
                                : f
                        )
                    );
                }
            } else {
                // Non-PDF file
                const fileEntry = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    status: 'error',
                    error: 'Only PDF files are supported',
                    uploadTime: new Date()
                };
                setUploadedFiles(prev => [...prev, fileEntry]);
            }
        }

        setProcessing(false);
        // Clear the file input
        event.target.value = '';
    };

    // Generate summary table (like your Excel PRACTICE PAY sheet)
    const generateSummaryTable = () => {
        const summary = {};

        // Initialize summary structure
        PCRS_PAYMENT_CATEGORIES.forEach(category => {
            summary[category] = { TOTAL: 0 };
            MONTHS.forEach(month => {
                summary[category][month] = 0;
            });
        });

        // Populate with payment data
        paymentAnalysisData
            .filter(data => data.year === selectedYear)
            .forEach(data => {
                PCRS_PAYMENT_CATEGORIES.forEach(category => {
                    const amount = data.payments[category] || 0;
                    summary[category][data.month] += amount;
                    summary[category].TOTAL += amount;
                });
            });

        return summary;
    };

    // Export to CSV
    const exportToCSV = () => {
        const summaryData = generateSummaryTable();

        let csvContent = "Category,TOTAL," + MONTHS.join(",") + "\n";

        PCRS_PAYMENT_CATEGORIES.forEach(category => {
            const row = [
                `"${category}"`,
                summaryData[category].TOTAL.toFixed(2),
                ...MONTHS.map(month => summaryData[category][month].toFixed(2))
            ];
            csvContent += row.join(",") + "\n";
        });

        // Download the file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `payment-summary-${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    // Remove file from uploaded list
    const removeFile = (fileId) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
        // Also remove from payment data if it exists
        const file = uploadedFiles.find(f => f.id === fileId);
        if (file && file.extractedData) {
            setPaymentAnalysisData(prev =>
                prev.filter(d => d.fileName !== file.name)
            );
        }
    };

    // Clear all data
    const clearAllData = () => {
        setUploadedFiles([]);
        setPaymentAnalysisData([]);
    };

    // Helper function to get latest month data (shared logic)
    const getLatestMonthData = () => {
        const currentYearData = paymentAnalysisData.filter(d => d.year === selectedYear);
        if (currentYearData.length === 0) return { latestMonth: null, monthData: [] };

        // Find the latest month with data
        let latestMonth = null;
        for (const month of ['Dec', 'Nov', 'Oct', 'Sep', 'Aug', 'Jul', 'Jun', 'May', 'Apr', 'Mar', 'Feb', 'Jan']) {
            const monthData = currentYearData.filter(d => d.month === month);
            if (monthData.length > 0) {
                latestMonth = month;
                break;
            }
        }

        const monthData = latestMonth ? currentYearData.filter(d => d.month === latestMonth) : [];
        return { latestMonth, monthData };
    };

    const summaryData = generateSummaryTable();
    const totalGrossPayment = paymentAnalysisData
        .filter(data => data.year === selectedYear)
        .reduce((sum, data) => sum + data.totalGrossPayment, 0);

    return (
        <div className="space-y-6">
            {/* GMS KPI Boxes */}
            {(() => {
                const hasHealthCheckData = profile?.healthCheckData?.healthCheckComplete === true;

                // Calculate GMS metrics
                let gmsMetrics = {
                    unclaimedAmount: 0,
                    unclaimedBreakdown: [],
                    panelSize: 0,
                    weightedPanel: 0,
                    leaveUnclaimed: 0,
                    leaveBreakdown: [],
                    hasRecentGMSData: false
                };

                if (hasHealthCheckData) {
                    try {
                        const analysis = analyzeGMSIncome(paymentAnalysisData, profile, profile.healthCheckData);

                        const registrationGapValue = analysis.potentialBreakdowns?.capitationAnalysis?.totalPotentialValue || 0;
                        const psIssues = analysis.potentialBreakdowns?.issues || [];
                        const psIssuesValue = psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0);
                        const studyLeaveUnclaimed = analysis.potentialBreakdowns?.leaveDetails?.studyLeaveUnclaimedValue || 0;
                        const annualLeaveUnclaimed = analysis.potentialBreakdowns?.leaveDetails?.annualLeaveUnclaimedValue || 0;
                        const cervicalLost = analysis.potentialBreakdowns?.cervicalScreeningAnalysis?.lostIncome || 0;

                        gmsMetrics.unclaimedAmount = registrationGapValue + psIssuesValue + studyLeaveUnclaimed + annualLeaveUnclaimed + cervicalLost;

                        if (registrationGapValue > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Capitation Registration Gaps', value: registrationGapValue });
                        if (psIssuesValue > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Practice Support Issues', value: psIssuesValue });
                        if (studyLeaveUnclaimed > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Study Leave Unclaimed', value: studyLeaveUnclaimed });
                        if (annualLeaveUnclaimed > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Annual Leave Unclaimed', value: annualLeaveUnclaimed });
                        if (cervicalLost > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Cervical Check Zero Payments', value: cervicalLost });

                        gmsMetrics.panelSize = analysis.actualIncome?.pcrsDemographics?.panelSize || 0;
                        gmsMetrics.weightedPanel = analysis.potentialBreakdowns?.weightedPanel || 0;
                        gmsMetrics.leaveUnclaimed = studyLeaveUnclaimed + annualLeaveUnclaimed;

                        const leaveDetails = analysis.potentialBreakdowns?.leaveDetails;
                        if (leaveDetails) {
                            gmsMetrics.leaveBreakdown = [
                                {
                                    label: 'Study Leave',
                                    entitled: leaveDetails.studyLeavePotential || 0,
                                    claimed: leaveDetails.actualStudyLeave || 0,
                                    unclaimed: studyLeaveUnclaimed,
                                    daysEntitled: leaveDetails.studyLeaveEntitlement || 10,
                                    daysClaimed: leaveDetails.studyLeaveEntitlement ? (leaveDetails.studyLeaveEntitlement - (leaveDetails.studyLeaveUnclaimedDays || 0)) : 0
                                },
                                {
                                    label: 'Annual Leave',
                                    entitled: leaveDetails.annualLeavePotential || 0,
                                    claimed: leaveDetails.actualAnnualLeave || 0,
                                    unclaimed: annualLeaveUnclaimed,
                                    daysEntitled: leaveDetails.annualLeaveEntitlement || 0,
                                    daysClaimed: leaveDetails.annualLeaveEntitlement ? (leaveDetails.annualLeaveEntitlement - (leaveDetails.annualLeaveUnclaimedDays || 0)) : 0
                                }
                            ];
                        }

                        const pcrsDemographics = analysis.actualIncome?.pcrsDemographics;
                        if (pcrsDemographics) {
                            gmsMetrics.demographics = {
                                under6: pcrsDemographics.totalUnder6 || 0,
                                over70: pcrsDemographics.total70PlusAllCategories || pcrsDemographics.total70Plus || 0,
                                nursingHome: pcrsDemographics.nursingHome70Plus || 0
                            };
                        }
                    } catch (error) {
                        console.error('Error calculating GMS metrics:', error);
                    }
                }

                // Fallback: compute panel size from raw paymentAnalysisData if health check hasn't been run
                if (gmsMetrics.panelSize === 0 && paymentAnalysisData.length > 0) {
                    const { monthData } = getLatestMonthData();
                    if (monthData.length > 0) {
                        gmsMetrics.panelSize = monthData.reduce((sum, data) => sum + (data.panelSize || 0), 0);
                    } else {
                        // No data for selected year — try all data
                        gmsMetrics.panelSize = paymentAnalysisData.reduce((max, data) => Math.max(max, data.panelSize || 0), 0);
                    }
                }

                // Check for GMS data availability
                gmsMetrics.hasRecentGMSData = paymentAnalysisData.length > 0;

                return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour-id="gms-overview-section">
                        {/* Unclaimed GMS Income */}
                        <div
                            onClick={() => hasHealthCheckData ? setShowGMSKPIModal('unclaimed') : window.dispatchEvent(new CustomEvent('tour:switchToHealthCheck'))}
                            className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                            style={{ backgroundColor: COLORS.incomeColor }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white opacity-90">Unclaimed GMS Income</p>
                                    <p className="text-2xl font-bold text-white mt-1">
                                        {hasHealthCheckData
                                            ? `€${Math.round(gmsMetrics.unclaimedAmount).toLocaleString()}`
                                            : 'Run Check'}
                                    </p>
                                    <p className="text-xs text-white opacity-90 mt-1">
                                        {hasHealthCheckData ? 'Click for breakdown' : 'Click to analyze'}
                                    </p>
                                </div>
                                <DollarSign className="h-8 w-8 text-white opacity-80" />
                            </div>
                        </div>

                        {/* Total Panel Size */}
                        <div
                            onClick={() => gmsMetrics.panelSize > 0 ? setShowGMSKPIModal('panel') : window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section: 'data' } }))}
                            className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                            style={{ backgroundColor: COLORS.expenseColor }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white opacity-90">Total Panel Size</p>
                                    <p className="text-2xl font-bold text-white mt-1">
                                        {gmsMetrics.panelSize > 0
                                            ? gmsMetrics.panelSize.toLocaleString()
                                            : 'No Data'}
                                    </p>
                                    <p className="text-xs text-white opacity-90 mt-1">
                                        {gmsMetrics.panelSize > 0 ? 'GMS patients' : 'Upload PCRS data'}
                                    </p>
                                </div>
                                <Users className="h-8 w-8 text-white opacity-80" />
                            </div>
                        </div>

                        {/* GMS Panel Data Status */}
                        <div
                            onClick={() => {
                                if (!gmsMetrics.hasRecentGMSData) {
                                    // Navigate to Settings > Data section for GMS upload
                                    window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section: 'data' } }));
                                } else {
                                    setShowGMSKPIModal('upload');
                                }
                            }}
                            className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                            style={{ backgroundColor: gmsMetrics.hasRecentGMSData ? COLORS.slainteBlue : '#F59E0B' }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white opacity-90">GMS Panel Data</p>
                                    <p className="text-2xl font-bold text-white mt-1">
                                        {(() => {
                                            if (!gmsMetrics.hasRecentGMSData) return 'Upload Due';
                                            const uniqueMonths = new Set(paymentAnalysisData.map(d => `${d.month}-${d.year}`)).size;
                                            return `${uniqueMonths} Month${uniqueMonths !== 1 ? 's' : ''}`;
                                        })()}
                                    </p>
                                    <p className="text-xs text-white opacity-90 mt-1">
                                        {gmsMetrics.hasRecentGMSData ? 'Data uploaded' : 'Click to upload'}
                                    </p>
                                </div>
                                {gmsMetrics.hasRecentGMSData
                                    ? <CheckCircle className="h-8 w-8 text-white opacity-80" />
                                    : <Upload className="h-8 w-8 text-white opacity-80" />
                                }
                            </div>
                        </div>

                        {/* Unclaimed Leave */}
                        <div
                            onClick={() => hasHealthCheckData ? setShowGMSKPIModal('leave') : window.dispatchEvent(new CustomEvent('tour:switchToHealthCheck'))}
                            className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                            style={{ backgroundColor: '#8B5CF6' }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white opacity-90">Unclaimed Leave</p>
                                    <p className="text-2xl font-bold text-white mt-1">
                                        {hasHealthCheckData
                                            ? `€${Math.round(gmsMetrics.leaveUnclaimed).toLocaleString()}`
                                            : 'Run Check'}
                                    </p>
                                    <p className="text-xs text-white opacity-90 mt-1">
                                        {hasHealthCheckData ? 'Study + Annual Leave' : 'Click to analyze'}
                                    </p>
                                </div>
                                <Briefcase className="h-8 w-8 text-white opacity-80" />
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* GMS KPI Modal */}
            {showGMSKPIModal && (() => {
                const hasHealthCheckData = profile?.healthCheckData?.healthCheckComplete === true;

                let gmsMetrics = {
                    unclaimedAmount: 0,
                    unclaimedBreakdown: [],
                    panelSize: 0,
                    weightedPanel: 0,
                    leaveUnclaimed: 0,
                    leaveBreakdown: [],
                    demographics: null
                };

                if (hasHealthCheckData) {
                    try {
                        const analysis = analyzeGMSIncome(paymentAnalysisData, profile, profile.healthCheckData);

                        const registrationGapValue = analysis.potentialBreakdowns?.capitationAnalysis?.totalPotentialValue || 0;
                        const psIssues = analysis.potentialBreakdowns?.issues || [];
                        const psIssuesValue = psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0);
                        const studyLeaveUnclaimed = analysis.potentialBreakdowns?.leaveDetails?.studyLeaveUnclaimedValue || 0;
                        const annualLeaveUnclaimed = analysis.potentialBreakdowns?.leaveDetails?.annualLeaveUnclaimedValue || 0;
                        const cervicalLost = analysis.potentialBreakdowns?.cervicalScreeningAnalysis?.lostIncome || 0;

                        gmsMetrics.unclaimedAmount = registrationGapValue + psIssuesValue + studyLeaveUnclaimed + annualLeaveUnclaimed + cervicalLost;

                        if (registrationGapValue > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Capitation Registration Gaps', value: registrationGapValue });
                        if (psIssuesValue > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Practice Support Issues', value: psIssuesValue });
                        if (studyLeaveUnclaimed > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Study Leave Unclaimed', value: studyLeaveUnclaimed });
                        if (annualLeaveUnclaimed > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Annual Leave Unclaimed', value: annualLeaveUnclaimed });
                        if (cervicalLost > 0) gmsMetrics.unclaimedBreakdown.push({ label: 'Cervical Check Zero Payments', value: cervicalLost });

                        gmsMetrics.panelSize = analysis.actualIncome?.pcrsDemographics?.panelSize || 0;
                        gmsMetrics.weightedPanel = analysis.potentialBreakdowns?.weightedPanel || 0;
                        gmsMetrics.leaveUnclaimed = studyLeaveUnclaimed + annualLeaveUnclaimed;

                        const leaveDetails = analysis.potentialBreakdowns?.leaveDetails;
                        if (leaveDetails) {
                            gmsMetrics.leaveBreakdown = [
                                { label: 'Study Leave', entitled: leaveDetails.studyLeavePotential || 0, claimed: leaveDetails.actualStudyLeave || 0, unclaimed: studyLeaveUnclaimed, daysEntitled: leaveDetails.studyLeaveEntitlement || 10, daysClaimed: leaveDetails.studyLeaveEntitlement ? (leaveDetails.studyLeaveEntitlement - (leaveDetails.studyLeaveUnclaimedDays || 0)) : 0 },
                                { label: 'Annual Leave', entitled: leaveDetails.annualLeavePotential || 0, claimed: leaveDetails.actualAnnualLeave || 0, unclaimed: annualLeaveUnclaimed, daysEntitled: leaveDetails.annualLeaveEntitlement || 0, daysClaimed: leaveDetails.annualLeaveEntitlement ? (leaveDetails.annualLeaveEntitlement - (leaveDetails.annualLeaveUnclaimedDays || 0)) : 0 }
                            ];
                        }

                        const pcrsDemographics = analysis.actualIncome?.pcrsDemographics;
                        if (pcrsDemographics) {
                            gmsMetrics.demographics = { under6: pcrsDemographics.totalUnder6 || 0, over70: pcrsDemographics.total70PlusAllCategories || pcrsDemographics.total70Plus || 0, nursingHome: pcrsDemographics.nursingHome70Plus || 0 };
                        }
                    } catch (error) {
                        console.error('Error calculating GMS metrics for modal:', error);
                    }
                }

                // Fallback: compute panel size from raw paymentAnalysisData if health check hasn't been run
                if (gmsMetrics.panelSize === 0 && paymentAnalysisData.length > 0) {
                    const { monthData } = getLatestMonthData();
                    if (monthData.length > 0) {
                        gmsMetrics.panelSize = monthData.reduce((sum, data) => sum + (data.panelSize || 0), 0);
                    } else {
                        gmsMetrics.panelSize = paymentAnalysisData.reduce((max, data) => Math.max(max, data.panelSize || 0), 0);
                    }
                }

                // Fallback: compute demographics from raw paymentAnalysisData if health check hasn't been run
                if (!gmsMetrics.demographics && paymentAnalysisData.length > 0) {
                    const { monthData } = getLatestMonthData();
                    const sourceData = monthData.length > 0 ? monthData : paymentAnalysisData;
                    const under6 = sourceData.reduce((sum, d) => sum + (d.demographics?.totalUnder6 || 0), 0);
                    const over70 = sourceData.reduce((sum, d) => sum + (d.demographics?.total70PlusAllCategories || d.demographics?.total70Plus || 0), 0);
                    const nursingHome = sourceData.reduce((sum, d) => sum + (d.demographics?.nursingHome70Plus || 0), 0);
                    if (under6 > 0 || over70 > 0 || nursingHome > 0) {
                        gmsMetrics.demographics = { under6, over70, nursingHome };
                    }
                }

                const modalConfig = {
                    unclaimed: { title: 'Unclaimed GMS Income Breakdown', color: COLORS.incomeColor, icon: DollarSign },
                    panel: { title: 'Panel Size Details', color: COLORS.expenseColor, icon: Users },
                    upload: { title: 'GMS Panel Data Status', color: COLORS.slainteBlue, icon: Upload },
                    leave: { title: 'Leave Entitlement Breakdown', color: '#8B5CF6', icon: Briefcase }
                };

                const config = modalConfig[showGMSKPIModal];
                const Icon = config.icon;

                return (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: COLORS.lightGray }}>
                                <h3 className="text-lg font-semibold flex items-center" style={{ color: config.color }}>
                                    <Icon className="h-5 w-5 mr-2" />
                                    {config.title}
                                </h3>
                                <button onClick={() => setShowGMSKPIModal(null)} className="p-1 hover:bg-gray-100 rounded">
                                    <X className="h-5 w-5" style={{ color: COLORS.mediumGray }} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {showGMSKPIModal === 'unclaimed' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                                            <div className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>{`€${Math.round(gmsMetrics.unclaimedAmount).toLocaleString()}`}</div>
                                            <div className="text-sm" style={{ color: COLORS.incomeColor }}>Total Unclaimed Income</div>
                                        </div>
                                        {gmsMetrics.unclaimedBreakdown.length > 0 ? (
                                            <div className="space-y-2">
                                                {gmsMetrics.unclaimedBreakdown.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: COLORS.lightGray }}>
                                                        <span style={{ color: COLORS.darkGray }}>{item.label}</span>
                                                        <span className="font-bold" style={{ color: COLORS.incomeColor }}>{`€${Math.round(item.value).toLocaleString()}`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-center py-4" style={{ color: COLORS.mediumGray }}>No unclaimed income identified</p>
                                        )}
                                    </div>
                                )}
                                {showGMSKPIModal === 'panel' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                                            <div className="text-2xl font-bold" style={{ color: COLORS.expenseColor }}>{gmsMetrics.panelSize.toLocaleString()}</div>
                                            <div className="text-sm" style={{ color: COLORS.expenseColor }}>Total Panel Size</div>
                                        </div>
                                        {gmsMetrics.weightedPanel > 0 && (
                                            <div className="p-3 rounded-lg border" style={{ borderColor: COLORS.lightGray }}>
                                                <div className="flex justify-between"><span style={{ color: COLORS.darkGray }}>Weighted Panel</span><span className="font-bold" style={{ color: COLORS.slainteBlue }}>{gmsMetrics.weightedPanel.toLocaleString()}</span></div>
                                                <p className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>Over 70s counted double</p>
                                            </div>
                                        )}
                                        {gmsMetrics.demographics && (
                                            <div className="space-y-2">
                                                <h4 className="font-medium" style={{ color: COLORS.darkGray }}>Demographics</h4>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="p-2 rounded text-center" style={{ backgroundColor: COLORS.backgroundGray }}><div className="text-lg font-bold" style={{ color: COLORS.darkGray }}>{gmsMetrics.demographics.under6}</div><div className="text-xs" style={{ color: COLORS.mediumGray }}>Under 6</div></div>
                                                    <div className="p-2 rounded text-center" style={{ backgroundColor: COLORS.backgroundGray }}><div className="text-lg font-bold" style={{ color: COLORS.darkGray }}>{gmsMetrics.demographics.over70}</div><div className="text-xs" style={{ color: COLORS.mediumGray }}>Over 70</div></div>
                                                    <div className="p-2 rounded text-center" style={{ backgroundColor: COLORS.backgroundGray }}><div className="text-lg font-bold" style={{ color: COLORS.darkGray }}>{gmsMetrics.demographics.nursingHome}</div><div className="text-xs" style={{ color: COLORS.mediumGray }}>Nursing Home</div></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {showGMSKPIModal === 'upload' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                                            <div className="text-xl font-bold" style={{ color: COLORS.slainteBlue }}>{paymentAnalysisData.length} PDFs uploaded</div>
                                            <div className="text-sm" style={{ color: COLORS.slainteBlue }}>PCRS Payment Statements</div>
                                        </div>
                                        <p className="text-sm" style={{ color: COLORS.mediumGray }}>Upload your monthly PCRS payment PDFs to keep your panel data current and accurate.</p>
                                    </div>
                                )}
                                {showGMSKPIModal === 'leave' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#8B5CF615' }}>
                                            <div className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{`€${Math.round(gmsMetrics.leaveUnclaimed).toLocaleString()}`}</div>
                                            <div className="text-sm" style={{ color: '#8B5CF6' }}>Total Unclaimed Leave Value</div>
                                        </div>
                                        {gmsMetrics.leaveBreakdown.length > 0 && (
                                            <div className="space-y-3">
                                                {gmsMetrics.leaveBreakdown.map((leave, idx) => (
                                                    <div key={idx} className="p-3 rounded-lg border" style={{ borderColor: COLORS.lightGray }}>
                                                        <div className="font-medium mb-2" style={{ color: COLORS.darkGray }}>{leave.label}</div>
                                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                                            <div><span style={{ color: COLORS.mediumGray }}>Entitled:</span> <span className="font-medium">{`€${Math.round(leave.entitled).toLocaleString()}`}</span></div>
                                                            <div><span style={{ color: COLORS.mediumGray }}>Claimed:</span> <span className="font-medium">{`€${Math.round(leave.claimed).toLocaleString()}`}</span></div>
                                                            <div><span style={{ color: COLORS.mediumGray }}>Unclaimed:</span> <span className="font-bold" style={{ color: '#8B5CF6' }}>{`€${Math.round(leave.unclaimed).toLocaleString()}`}</span></div>
                                                        </div>
                                                        <div className="text-xs mt-2" style={{ color: COLORS.mediumGray }}>{leave.daysClaimed} of {leave.daysEntitled} days claimed</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t" style={{ borderColor: COLORS.lightGray }}>
                                <button onClick={() => setShowGMSKPIModal(null)} className="w-full py-2 rounded-lg text-white font-medium" style={{ backgroundColor: config.color }}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* GMS Payment Category Comparison Chart */}
            {paymentAnalysisData.length > 0 && (() => {
                const currentYear = parseInt(selectedYear);
                const previousYear = currentYear - 1;

                // Category mapping for grouping payments
                const categoryGroups = {
                    capitation: {
                        label: 'Capitation',
                        color: COLORS.slainteBlue,
                        lightColor: '#93C5FD',
                        categories: ['Capitation Payment/Supplementary Allowance']
                    },
                    stc: {
                        label: 'STC (incl CDM)',
                        color: '#059669',
                        lightColor: '#6EE7B7',
                        categories: ['Special Type/OOH/SS/H1N1', 'Enhanced Capitation for Asthma', 'Enhanced Capitation for Diabetes', 'Asthma registration fee', 'Diabetes registration fee']
                    },
                    practiceSupport: {
                        label: 'Practice Subsidy',
                        color: '#8B5CF6',
                        lightColor: '#C4B5FD',
                        categories: ['Practice Support Subsidy']
                    },
                    locum: {
                        label: 'Locum Expenses',
                        color: '#F59E0B',
                        lightColor: '#FCD34D',
                        categories: ['Locum Expenses For Leave']
                    },
                    cervical: {
                        label: 'Cervical Check',
                        color: '#EC4899',
                        lightColor: '#F9A8D4',
                        categories: ['National Cervical Screening Programme']
                    },
                    maternity: {
                        label: 'Maternity & Infant',
                        color: '#14B8A6',
                        lightColor: '#5EEAD4',
                        categories: ['Maternity and Infant Care Scheme']
                    },
                    other: {
                        label: 'Other',
                        color: '#6B7280',
                        lightColor: '#D1D5DB',
                        categories: ['Doctor Vaccinations', 'Doctor Outbreak Vaccinations', 'Covid-19 Vaccine Admin Fee', 'Incentivised payments under Covid Vaccine', 'Incentivised payments under QIV vaccine', 'Incentivised payments under LAIV vaccine', 'Winter Plan Support Grant', 'Asylum Seeker/ Non EU Registration fee', 'Ukrainian Patient Registration']
                    }
                };

                // Build monthly data for a given year
                const buildMonthlyData = (year) => {
                    const yearData = paymentAnalysisData.filter(d => d.year === year.toString());
                    return MONTHS.map(month => {
                        const monthData = yearData.filter(d => d.month === month);
                        const totals = {};

                        Object.keys(categoryGroups).forEach(groupKey => {
                            const group = categoryGroups[groupKey];
                            totals[groupKey] = monthData.reduce((sum, data) => {
                                return sum + group.categories.reduce((catSum, cat) => catSum + (data.payments?.[cat] || 0), 0);
                            }, 0);
                        });

                        return { month, ...totals };
                    });
                };

                // Build rolling 12-month data
                const buildRolling12MonthData = (offsetYears = 0) => {
                    const today = new Date();
                    const result = [];
                    for (let i = 11; i >= 0; i--) {
                        const date = new Date(today.getFullYear() - offsetYears, today.getMonth() - i, 1);
                        const year = date.getFullYear().toString();
                        const month = MONTHS[date.getMonth()];
                        const label = `${month} ${date.getFullYear().toString().slice(2)}`;

                        const monthData = paymentAnalysisData.filter(d => d.year === year && d.month === month);
                        const totals = {};

                        Object.keys(categoryGroups).forEach(groupKey => {
                            const group = categoryGroups[groupKey];
                            totals[groupKey] = monthData.reduce((sum, data) => {
                                return sum + group.categories.reduce((catSum, cat) => catSum + (data.payments?.[cat] || 0), 0);
                            }, 0);
                        });

                        result.push({ month: label, ...totals });
                    }
                    return result;
                };

                let comparisonData;
                if (useRollingYear) {
                    const currentRolling = buildRolling12MonthData(0);
                    const previousRolling = buildRolling12MonthData(1);
                    comparisonData = currentRolling.map((d, idx) => ({
                        month: d.month,
                        current: d[gmsChartMode] || 0,
                        previous: previousRolling[idx][gmsChartMode] || 0
                    }));
                } else {
                    const currentYearData = buildMonthlyData(currentYear);
                    const previousYearData = buildMonthlyData(previousYear);
                    comparisonData = MONTHS.map((month, idx) => ({
                        month,
                        current: currentYearData[idx][gmsChartMode] || 0,
                        previous: previousYearData[idx][gmsChartMode] || 0
                    }));
                }

                const config = categoryGroups[gmsChartMode];

                // Calculate totals for summary
                const currentTotal = comparisonData.reduce((sum, d) => sum + d.current, 0);
                const previousTotal = comparisonData.reduce((sum, d) => sum + d.previous, 0);
                const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
                const isPositive = change >= 0;

                return (
                    <div className="bg-white p-6 rounded-lg border" style={{ borderColor: COLORS.lightGray }} data-tour-id="gms-dashboard-chart">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center" style={{ color: COLORS.darkGray }}>
                                <TrendingUp className="h-5 w-5 mr-2" style={{ color: config.color }} />
                                {config.label}: {useRollingYear ? 'Last 12 Months vs Prior 12' : `${currentYear} vs ${previousYear}`}
                            </h3>
                        </div>

                        {/* Toggle buttons - scrollable on mobile */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {Object.entries(categoryGroups).map(([key, group]) => (
                                <button
                                    key={key}
                                    onClick={() => setGmsChartMode(key)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                                    style={{
                                        backgroundColor: gmsChartMode === key ? group.color : COLORS.backgroundGray,
                                        color: gmsChartMode === key ? 'white' : COLORS.mediumGray,
                                    }}
                                >
                                    {group.label}
                                </button>
                            ))}
                        </div>

                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: COLORS.mediumGray, fontSize: 12 }}
                                    axisLine={{ stroke: COLORS.lightGray }}
                                />
                                <YAxis
                                    tick={{ fill: COLORS.mediumGray, fontSize: 12 }}
                                    axisLine={{ stroke: COLORS.lightGray }}
                                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    formatter={(value, name) => [
                                        `€${value.toLocaleString()}`,
                                        name === 'current' ? (useRollingYear ? 'Last 12 Months' : currentYear) : (useRollingYear ? 'Prior 12 Months' : previousYear)
                                    ]}
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: `1px solid ${COLORS.lightGray}`,
                                        borderRadius: '8px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                />
                                <Legend
                                    formatter={(value) => value === 'current' ? (useRollingYear ? 'Last 12 Months' : currentYear) : (useRollingYear ? 'Prior 12 Months' : previousYear)}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="current"
                                    stroke={config.color}
                                    strokeWidth={2.5}
                                    name="current"
                                    dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="previous"
                                    stroke={config.lightColor}
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name="previous"
                                    dot={{ fill: config.lightColor, strokeWidth: 2, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>

                        {/* Year-over-year summary */}
                        <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: COLORS.lightGray }}>
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-xs" style={{ color: COLORS.mediumGray }}>{useRollingYear ? 'Last 12 Months' : `${currentYear} Total`}</p>
                                    <p className="text-lg font-semibold" style={{ color: config.color }}>
                                        {`€${Math.round(currentTotal).toLocaleString()}`}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs" style={{ color: COLORS.mediumGray }}>{useRollingYear ? 'Prior 12 Months' : `${previousYear} Total`}</p>
                                    <p className="text-lg font-semibold" style={{ color: config.lightColor }}>
                                        {`€${Math.round(previousTotal).toLocaleString()}`}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs" style={{ color: COLORS.mediumGray }}>Year-over-Year</p>
                                <p className="text-lg font-semibold flex items-center justify-end gap-1" style={{ color: isPositive ? COLORS.incomeColor : COLORS.expenseColor }}>
                                    {isPositive ? '↗' : '↘'} {`${Math.abs(change).toFixed(1)}%`}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Payment Overview */}
            {paymentAnalysisData.length > 0 && (
                <div
                    style={{
                        backgroundColor: COLORS.white,
                        borderRadius: '0.5rem',
                        border: `1px solid ${COLORS.lightGray}`,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                        padding: '1.5rem'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <button
                            onClick={() => setPaymentOverviewExpanded(!paymentOverviewExpanded)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                        >
                            <h3 style={{
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: COLORS.darkGray,
                                margin: 0
                            }}>
                                {paymentOverviewExpanded ? <ChevronUp style={{ color: COLORS.slainteBlue }} /> : <ChevronDown style={{ color: COLORS.slainteBlue }} />}
                                Payment Overview - {selectedYear}
                            </h3>
                        </button>
                        <button
                            onClick={exportToCSV}
                            style={{
                                backgroundColor: COLORS.slainteBlue,
                                color: COLORS.white,
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500
                            }}
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>

                    {/* Summary stats - ALWAYS VISIBLE */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            backgroundColor: COLORS.backgroundGray,
                            border: `1px solid ${COLORS.lightGray}`
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>Total Payments</h4>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.slainteBlue, margin: 0 }}>
                                {`€${totalGrossPayment.toLocaleString()}`}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                                {paymentAnalysisData.filter(d => d.year === selectedYear).length} statements processed
                            </p>
                        </div>
                        <div style={{
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            backgroundColor: COLORS.backgroundGray,
                            border: `1px solid ${COLORS.lightGray}`
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>Partners</h4>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.slainteBlue, margin: 0 }}>{partnerCount}</p>
                            <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>Detected from PCRS data</p>
                        </div>
                    </div>

                    {/* Detailed content - COLLAPSIBLE */}
                    {paymentOverviewExpanded && (
                        <>
                    {/* Summary Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                                        Category
                                    </th>
                                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold">
                                        TOTAL
                                    </th>
                                    {MONTHS.map(month => (
                                        <th key={month} className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">
                                            {month}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {PCRS_PAYMENT_CATEGORIES.map((category, index) => (
                                    <tr key={category} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="border border-gray-300 px-3 py-2 text-sm font-medium">
                                            {category}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                                            {summaryData[category].TOTAL > 0 ? `€${summaryData[category].TOTAL.toLocaleString()}` : '-'}
                                        </td>
                                        {MONTHS.map(month => (
                                            <td key={month} className="border border-gray-300 px-3 py-2 text-right text-sm">
                                                {summaryData[category][month] > 0 ? `€${summaryData[category][month].toLocaleString()}` : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {/* Total Gross Payment Row */}
                                <tr className="bg-blue-50 font-semibold">
                                    <td className="border border-gray-300 px-3 py-2 text-sm">
                                        <strong>TOTAL GROSS PAYMENT</strong>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right">
                                        <strong>€{totalGrossPayment.toLocaleString()}</strong>
                                    </td>
                                    {MONTHS.map(month => {
                                        const monthTotal = paymentAnalysisData
                                            .filter(data => data.year === selectedYear && data.month === month)
                                            .reduce((sum, data) => sum + data.totalGrossPayment, 0);
                                        return (
                                            <td key={month} className="border border-gray-300 px-3 py-2 text-right text-sm">
                                                <strong>{monthTotal > 0 ? `€${monthTotal.toLocaleString()}` : '-'}</strong>
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* Deductions Rows - Dynamic based on what's found */}
                                {(() => {
                                    // Get all unique deduction types from payment data
                                    const allDeductions = new Set();
                                    paymentAnalysisData.forEach(data => {
                                        Object.keys(data.deductions).forEach(deduction => {
                                            allDeductions.add(deduction);
                                        });
                                    });

                                    return Array.from(allDeductions).map((deduction, index) => {
                                        // Special handling for withholding tax - it's practice-wide, not per-panel
                                        const isWithholdingTax = deduction === "Less Withholding Tax";

                                        const deductionTotal = isWithholdingTax
                                            ? (() => {
                                                // For withholding tax, sum unique values per month (since it's the same across panels)
                                                const monthlyValues = {};
                                                paymentAnalysisData
                                                    .filter(data => data.year === selectedYear)
                                                    .forEach(data => {
                                                        const month = data.month;
                                                        // Only take the first value for each month
                                                        if (!monthlyValues[month]) {
                                                            monthlyValues[month] = data.deductions[deduction] || 0;
                                                        }
                                                    });
                                                return Object.values(monthlyValues).reduce((sum, val) => sum + val, 0);
                                            })()
                                            : paymentAnalysisData
                                                .filter(data => data.year === selectedYear)
                                                .reduce((sum, data) => sum + (data.deductions[deduction] || 0), 0);

                                        // Special styling for placeholder items
                                        const isPlaceholder = deduction.includes('YTD - needs monthly breakdown');
                                        const isPositive = deduction.toLowerCase().includes('plus');

                                        return (
                                            <tr key={deduction} className={isPositive ? "bg-green-50" : "bg-red-50"}>
                                                <td className={`border border-gray-300 px-3 py-2 text-sm ${isPositive ? 'text-green-700' : 'text-red-700'
                                                    } ${isPlaceholder ? 'italic' : ''}`}>
                                                    {deduction}
                                                    {isPlaceholder && (
                                                        <span className="text-xs text-gray-500 ml-2">(TODO: Monthly breakdown needed)</span>
                                                    )}
                                                </td>
                                                <td className={`border border-gray-300 px-3 py-2 text-right ${isPositive ? 'text-green-700' : 'text-red-700'
                                                    }`}>
                                                    {isPlaceholder ? (
                                                        <span className="italic text-gray-500">TBD</span>
                                                    ) : deductionTotal > 0 ? (
                                                        `${isPositive ? '+' : '-'}€${deductionTotal.toLocaleString()}`
                                                    ) : '-'}
                                                </td>
                                                {MONTHS.map(month => {
                                                    // Special handling for withholding tax - take first value only (it's practice-wide)
                                                    const monthDeduction = isWithholdingTax
                                                        ? (() => {
                                                            const monthData = paymentAnalysisData
                                                                .filter(data => data.year === selectedYear && data.month === month);
                                                            return monthData.length > 0 ? (monthData[0].deductions[deduction] || 0) : 0;
                                                        })()
                                                        : paymentAnalysisData
                                                            .filter(data => data.year === selectedYear && data.month === month)
                                                            .reduce((sum, data) => sum + (data.deductions[deduction] || 0), 0);
                                                    return (
                                                        <td key={month} className={`border border-gray-300 px-3 py-2 text-right text-sm ${isPositive ? 'text-green-700' : 'text-red-700'
                                                            }`}>
                                                            {isPlaceholder ? (
                                                                <span className="italic text-gray-400">TBD</span>
                                                            ) : monthDeduction > 0 ? (
                                                                `${isPositive ? '+' : '-'}€${monthDeduction.toLocaleString()}`
                                                            ) : '-'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    });
                                })()}
                                {/* Net Payment Row */}
                                <tr className="bg-green-50 font-semibold">
                                    <td className="border border-gray-300 px-3 py-2 text-sm">
                                        <strong>TOTAL NET PAYMENT</strong>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right">
                                        <strong>€{(totalGrossPayment -
                                            paymentAnalysisData
                                                .filter(data => data.year === selectedYear)
                                                .reduce((sum, data) => sum + Object.values(data.deductions).reduce((a, b) => a + b, 0), 0)
                                        ).toLocaleString()}</strong>
                                    </td>
                                    {MONTHS.map(month => {
                                        const monthGross = paymentAnalysisData
                                            .filter(data => data.year === selectedYear && data.month === month)
                                            .reduce((sum, data) => sum + data.totalGrossPayment, 0);
                                        const monthDeductions = paymentAnalysisData
                                            .filter(data => data.year === selectedYear && data.month === month)
                                            .reduce((sum, data) => sum + Object.values(data.deductions).reduce((a, b) => a + b, 0), 0);
                                        const monthNet = monthGross - monthDeductions;
                                        return (
                                            <td key={month} className="border border-gray-300 px-3 py-2 text-right text-sm">
                                                <strong>{monthNet > 0 ? `€${monthNet.toLocaleString()}` : '-'}</strong>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                        </>
                    )}
                </div>
            )}

            {/* Upload Status - Moved to Bottom */}
            {uploadedFiles.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <button
                        onClick={() => setUploadStatusExpanded(!uploadStatusExpanded)}
                        className="w-full text-left"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            {uploadStatusExpanded ? <ChevronUp className="text-gray-600" /> : <ChevronDown className="text-gray-600" />}
                            Upload Status
                        </h3>
                    </button>

                    {uploadStatusExpanded && (
                        <div className="space-y-3">
                        {uploadedFiles.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileText size={20} />
                                    <div>
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {file.size && `${(file.size / 1024 / 1024).toFixed(2)} MB • `}
                                            {file.uploadTime.toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {file.status === 'completed' && (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-600" />
                                            <span className="text-sm text-green-700">Completed</span>
                                            {file.extractedData && (
                                                <span className="text-xs text-gray-500">
                                                    €{file.extractedData.totalGrossPayment.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {file.status === 'processing' && (
                                        <div className="flex items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                            <span className="text-sm text-blue-700">Processing</span>
                                        </div>
                                    )}
                                    {file.status === 'error' && (
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={16} className="text-red-600" />
                                            <span className="text-sm text-red-700">Error</span>
                                            {file.error && (
                                                <span className="text-xs text-red-600 max-w-xs truncate" title={file.error}>
                                                    {file.error}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeFile(file.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        </div>
                    )}
                </div>
            )}

            {/* No Data State */}
            {paymentAnalysisData.length === 0 && (
                <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                    <FileText className="mx-auto text-gray-400 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Payment Data</h3>
                    <p className="text-gray-500 mb-2">
                        Upload PCRS payment PDFs in the <strong>Upload Data</strong> tab to start analyzing your practice payments
                    </p>
                    <p className="text-sm text-gray-400">
                        Go to Upload Data → PCRS Payments section
                    </p>
                </div>
            )}
        </div>
    );
};

export default PaymentAnalysis;