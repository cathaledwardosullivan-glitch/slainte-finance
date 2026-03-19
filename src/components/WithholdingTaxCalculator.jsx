import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { Calculator, Info, FileText } from 'lucide-react';

export default function WithholdingTaxCalculator({ onCalculate, partnerProfitShares = {} }) {
    const { transactions, selectedYear, categoryMapping } = useAppContext();

    // Get partner names from category mapping (memoized to prevent infinite loops)
    const availablePartners = useMemo(() => {
        return categoryMapping
            .filter(c => (c.role === '90' || c.code?.startsWith('90.')) && c.staffMember) // Partner categories (check role OR code pattern)
            .map(c => c.staffMember)
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [categoryMapping]);

    // State for each partner's withholding tax
    const [partnerTax, setPartnerTax] = useState(
        availablePartners.reduce((acc, partner) => {
            acc[partner] = {
                stateContractIncome: 0,
                stateContractRate: 25,
                gmsWithholdingTax: 0
            };
            return acc;
        }, {})
    );

    // Auto-calculate state contract income from transactions
    useEffect(() => {
        if (!transactions || transactions.length === 0) return;

        const yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            return new Date(t.date).getFullYear() === selectedYear;
        });

        // Calculate total income from state contract categories
        // Look for categories that might be state contracts (you can customize these)
        const stateContractCategories = ['DSP', 'Department', 'State', 'HSE'];

        let totalStateContractIncome = 0;
        yearTransactions.forEach(t => {
            const amount = t.credit || t.amount || 0;
            if (amount === 0) return;

            const categoryName = t.category?.name || '';
            const isStateContract = stateContractCategories.some(keyword =>
                categoryName.toLowerCase().includes(keyword.toLowerCase())
            );

            if (isStateContract && t.category?.type === 'income') {
                totalStateContractIncome += amount;
            }
        });

        // If we found state contract income and have partners, distribute it based on profit share
        if (totalStateContractIncome > 0 && availablePartners.length > 0) {
            setPartnerTax(prev => {
                const updated = { ...prev };
                availablePartners.forEach(partner => {
                    if (updated[partner]) {
                        // Use profit share if available, otherwise distribute equally
                        const profitShare = partnerProfitShares[partner] || (100 / availablePartners.length);
                        updated[partner].stateContractIncome = totalStateContractIncome * (profitShare / 100);
                    }
                });
                return updated;
            });
        }
    }, [transactions, selectedYear, availablePartners, partnerProfitShares]);

    // Calculate totals for each partner
    const calculatePartnerTotal = (partner) => {
        const data = partnerTax[partner];
        if (!data) return { stateContractTax: 0, gmsWithholdingTax: 0, total: 0 };

        const stateContractTax = data.stateContractIncome * (data.stateContractRate / 100);
        const gmsWithholdingTax = data.gmsWithholdingTax;
        const total = stateContractTax + gmsWithholdingTax;

        return { stateContractTax, gmsWithholdingTax, total };
    };

    // Calculate practice totals
    const calculatePracticeTotals = () => {
        let totalStateContractIncome = 0;
        let totalStateContractTax = 0;
        let totalGmsTax = 0;

        availablePartners.forEach(partner => {
            const data = partnerTax[partner];
            if (data) {
                totalStateContractIncome += data.stateContractIncome;
                const partnerTotals = calculatePartnerTotal(partner);
                totalStateContractTax += partnerTotals.stateContractTax;
                totalGmsTax += partnerTotals.gmsWithholdingTax;
            }
        });

        return {
            totalStateContractIncome,
            totalStateContractTax,
            totalGmsTax,
            grandTotal: totalStateContractTax + totalGmsTax
        };
    };

    const practiceTotals = calculatePracticeTotals();

    // Update partner field
    const updatePartnerField = (partner, field, value) => {
        setPartnerTax(prev => ({
            ...prev,
            [partner]: {
                ...prev[partner],
                [field]: parseFloat(value) || 0
            }
        }));
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Apply to Capital Accounts
    const applyToCapitalAccounts = () => {
        const withholdingTaxByPartner = {};
        availablePartners.forEach(partner => {
            const totals = calculatePartnerTotal(partner);
            withholdingTaxByPartner[partner] = totals.total;
        });

        if (onCalculate) {
            onCalculate(withholdingTaxByPartner);
        }

        alert('Withholding tax amounts have been applied to the Partner\'s Capital Accounts!');
    };

    if (availablePartners.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
                    Withholding Tax Calculator
                </h3>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-900 mb-1">No Partners Set Up</p>
                            <p className="text-xs text-blue-800">
                                Set up partners in Admin Settings first to use the withholding tax calculator.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2" style={{ color: COLORS.textPrimary }}>
                    Withholding Tax Calculator
                </h3>
                <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                    Calculate withholding tax from State Contracts and GMS payments for {selectedYear}
                </p>
            </div>

            {/* Explanation */}
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: COLORS.slainteBlue }} />
                    <div className="text-sm" style={{ color: COLORS.textPrimary }}>
                        <p className="font-medium mb-2">How This Works:</p>
                        <ul className="space-y-1 ml-4">
                            <li>• <strong>State Contract Income:</strong> Net income received (before grossing up). Tax is calculated at the specified rate (typically 25%).</li>
                            <li>• <strong>GMS Withholding Tax:</strong> Enter the amount from your PCRS Panel Analysis (usually shown as annual total).</li>
                            <li>• <strong>Total:</strong> Combined withholding tax that reduces each partner's capital account.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Partner Calculations */}
            <div className="space-y-4 mb-6">
                {availablePartners.map(partner => {
                    const totals = calculatePartnerTotal(partner);
                    const data = partnerTax[partner];

                    return (
                        <div key={partner} className="border rounded-lg p-4" style={{ borderColor: COLORS.borderLight }}>
                            <h4 className="font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
                                {partner}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* State Contract Section */}
                                <div className="space-y-3">
                                    <h5 className="text-sm font-medium" style={{ color: COLORS.slainteBlue }}>
                                        State Contract Income
                                    </h5>

                                    <div>
                                        <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                                            Net Income Received
                                        </label>
                                        <input
                                            type="number"
                                            value={data?.stateContractIncome || ''}
                                            onChange={(e) => updatePartnerField(partner, 'stateContractIncome', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                            style={{ borderColor: COLORS.borderLight }}
                                            placeholder="€0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                                            Withholding Tax Rate (%)
                                        </label>
                                        <input
                                            type="number"
                                            value={data?.stateContractRate || ''}
                                            onChange={(e) => updatePartnerField(partner, 'stateContractRate', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                            style={{ borderColor: COLORS.borderLight }}
                                            placeholder="25"
                                            step="0.1"
                                        />
                                    </div>

                                    <div className="p-3 rounded" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                                        <p className="text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                                            Calculated Withholding Tax:
                                        </p>
                                        <p className="text-sm font-semibold" style={{ color: COLORS.expenseColor }}>
                                            {formatCurrency(data?.stateContractIncome || 0)} × {data?.stateContractRate || 0}% = {formatCurrency(totals.stateContractTax)}
                                        </p>
                                    </div>
                                </div>

                                {/* GMS Section */}
                                <div className="space-y-3">
                                    <h5 className="text-sm font-medium" style={{ color: COLORS.slainteBlue }}>
                                        GMS Panel Analysis
                                    </h5>

                                    <div>
                                        <label className="block text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                                            Withholding Tax (from PCRS)
                                        </label>
                                        <input
                                            type="number"
                                            value={data?.gmsWithholdingTax || ''}
                                            onChange={(e) => updatePartnerField(partner, 'gmsWithholdingTax', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                            style={{ borderColor: COLORS.borderLight }}
                                            placeholder="€0.00"
                                        />
                                        <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                            Enter total from annual PCRS statement
                                        </p>
                                    </div>

                                    <div className="p-3 rounded" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                                        <p className="text-xs mb-1" style={{ color: COLORS.textSecondary }}>
                                            GMS Withholding Tax:
                                        </p>
                                        <p className="text-sm font-semibold" style={{ color: COLORS.expenseColor }}>
                                            {formatCurrency(totals.gmsWithholdingTax)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Partner Total */}
                            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold" style={{ color: COLORS.textPrimary }}>
                                        Total Withholding Tax for {partner}:
                                    </span>
                                    <span className="text-xl font-bold" style={{ color: COLORS.expenseColor }}>
                                        {formatCurrency(totals.total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Practice Summary */}
            <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: `${COLORS.slainteBlue}10`, border: `2px solid ${COLORS.slainteBlue}` }}>
                <h4 className="font-semibold mb-4" style={{ color: COLORS.slainteBlue }}>
                    Practice Summary for {selectedYear}
                </h4>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span style={{ color: COLORS.textPrimary }}>Total State Contract Income (Net):</span>
                        <span className="font-medium" style={{ color: COLORS.textPrimary }}>
                            {formatCurrency(practiceTotals.totalStateContractIncome)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span style={{ color: COLORS.textPrimary }}>Total State Contract Tax:</span>
                        <span className="font-medium" style={{ color: COLORS.expenseColor }}>
                            {formatCurrency(practiceTotals.totalStateContractTax)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span style={{ color: COLORS.textPrimary }}>Total GMS Withholding Tax:</span>
                        <span className="font-medium" style={{ color: COLORS.expenseColor }}>
                            {formatCurrency(practiceTotals.totalGmsTax)}
                        </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t" style={{ borderColor: COLORS.borderLight }}>
                        <span className="font-bold" style={{ color: COLORS.textPrimary }}>TOTAL WITHHOLDING TAX:</span>
                        <span className="text-lg font-bold" style={{ color: COLORS.expenseColor }}>
                            {formatCurrency(practiceTotals.grandTotal)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Button */}
            {onCalculate && (
                <div className="flex justify-end">
                    <button
                        onClick={applyToCapitalAccounts}
                        className="px-6 py-3 rounded-lg text-white font-medium flex items-center gap-2"
                        style={{ backgroundColor: COLORS.slainteBlue }}
                    >
                        <FileText className="h-5 w-5" />
                        Apply to Partner's Capital Accounts
                    </button>
                </div>
            )}
        </div>
    );
}
