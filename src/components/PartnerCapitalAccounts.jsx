import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { Users, Download, FileText, Plus, Trash2, AlertCircle, Calculator } from 'lucide-react';
import WithholdingTaxCalculator from './WithholdingTaxCalculator';

export default function PartnerCapitalAccounts() {
    const { transactions, selectedYear, setSelectedYear, categoryMapping } = useAppContext();

    // Show/hide withholding tax calculator
    const [showWithholdingTaxCalc, setShowWithholdingTaxCalc] = useState(false);

    // Get partner names from category mapping
    const availablePartners = categoryMapping
        .filter(c => (c.role === '90' || c.code?.startsWith('90.')) && c.staffMember) // Partner categories (check role OR code pattern)
        .map(c => c.staffMember)
        .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

    // State for partners
    const [partners, setPartners] = useState([
        {
            name: availablePartners.length > 0 ? availablePartners[0] : '',
            profitSharePercentage: 0,
            openingBalance: 0,
            drawings: 0
        }
    ]);

    // Practice profit (from P&L)
    const [practiceProfitLoss, setPracticeProfitLoss] = useState(0);

    // Total withholding tax for the practice
    const [totalWithholdingTax, setTotalWithholdingTax] = useState(0);

    // Auto-calculate practice profit from transactions
    useEffect(() => {
        if (!transactions || transactions.length === 0) return;

        const yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            return new Date(t.date).getFullYear() === selectedYear;
        });

        let totalIncome = 0;
        let totalExpenses = 0;

        yearTransactions.forEach(t => {
            const amount = t.credit || t.debit || t.amount || 0;
            if (amount === 0) return;

            const categoryType = t.category?.type;
            if (categoryType === 'income') {
                totalIncome += amount;
            } else if (categoryType === 'expense') {
                totalExpenses += amount;
            }
        });

        setPracticeProfitLoss(totalIncome - totalExpenses);
    }, [transactions, selectedYear]);

    // Add partner
    const addPartner = () => {
        setPartners([...partners, {
            name: '',
            profitSharePercentage: 0,
            openingBalance: 0,
            drawings: 0
        }]);
    };

    // Remove partner
    const removePartner = (index) => {
        const newPartners = partners.filter((_, i) => i !== index);
        setPartners(newPartners);
    };

    // Update partner field
    const updatePartner = (index, field, value) => {
        const newPartners = [...partners];
        newPartners[index][field] = field === 'name' ? value : parseFloat(value) || 0;
        setPartners(newPartners);
    };

    // Handle withholding tax calculation from calculator
    const handleWithholdingTaxCalculation = (withholdingTaxByPartner) => {
        // Sum up all the withholding tax amounts to get the total
        const total = Object.values(withholdingTaxByPartner).reduce((sum, amount) => sum + amount, 0);
        setTotalWithholdingTax(total);
        setShowWithholdingTaxCalc(false);
    };

    // Calculate allocations for each partner
    const calculateAllocations = () => {
        return partners.map(partner => {
            const shareOfProfit = practiceProfitLoss * (partner.profitSharePercentage / 100);
            // Allocate withholding tax based on profit share percentage
            const allocatedWithholdingTax = totalWithholdingTax * (partner.profitSharePercentage / 100);
            const closingBalance = partner.openingBalance + shareOfProfit - partner.drawings - allocatedWithholdingTax;

            return {
                ...partner,
                shareOfProfit,
                allocatedWithholdingTax,
                closingBalance
            };
        });
    };

    const allocations = calculateAllocations();

    // Validation
    const totalProfitShare = partners.reduce((sum, p) => sum + p.profitSharePercentage, 0);
    const totalAllocated = allocations.reduce((sum, a) => sum + a.shareOfProfit, 0);

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Export to PDF
    const exportToPDF = () => {
        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Partner's Capital Accounts - ${selectedYear}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .summary { margin-bottom: 20px; padding: 10px; background-color: #f5f5f5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #1976d2; color: white; padding: 10px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .total-row { font-weight: bold; background-color: #f5f5f5; }
        .number { text-align: right; }
        .warning { background-color: #fff3cd; padding: 10px; margin: 10px 0; border: 1px solid #ffc107; }
        @media print { body { margin: 10px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Partner's Capital Accounts</h1>
        <h2>For the Year Ended 31 December ${selectedYear}</h2>
        <p>Prepared on: ${new Date().toLocaleDateString('en-IE')}</p>
    </div>

    <div class="summary">
        <h3>Practice Summary</h3>
        <p><strong>Total Practice Profit/(Loss):</strong> ${formatCurrency(practiceProfitLoss)}</p>
        <p><strong>Number of Partners:</strong> ${partners.length}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Partner Name</th>
                <th class="number">Profit Share %</th>
                <th class="number">Opening Balance</th>
                <th class="number">Share of Profit</th>
                <th class="number">Drawings</th>
                <th class="number">Withholding Tax</th>
                <th class="number">Closing Balance</th>
            </tr>
        </thead>
        <tbody>
            ${allocations.map(a => `
                <tr>
                    <td>${a.name || 'Unnamed Partner'}</td>
                    <td class="number">${a.profitSharePercentage.toFixed(2)}%</td>
                    <td class="number">${formatCurrency(a.openingBalance)}</td>
                    <td class="number">${formatCurrency(a.shareOfProfit)}</td>
                    <td class="number">(${formatCurrency(a.drawings)})</td>
                    <td class="number">(${formatCurrency(a.allocatedWithholdingTax)})</td>
                    <td class="number">${formatCurrency(a.closingBalance)}</td>
                </tr>
            `).join('')}
            <tr class="total-row">
                <td>TOTAL</td>
                <td class="number">${totalProfitShare.toFixed(2)}%</td>
                <td class="number">${formatCurrency(allocations.reduce((sum, a) => sum + a.openingBalance, 0))}</td>
                <td class="number">${formatCurrency(totalAllocated)}</td>
                <td class="number">(${formatCurrency(allocations.reduce((sum, a) => sum + a.drawings, 0))})</td>
                <td class="number">(${formatCurrency(totalWithholdingTax)})</td>
                <td class="number">${formatCurrency(allocations.reduce((sum, a) => sum + a.closingBalance, 0))}</td>
            </tr>
        </tbody>
    </table>

    ${totalProfitShare !== 100 ? `
        <div class="warning">
            <strong>Warning:</strong> Total profit share is ${totalProfitShare.toFixed(2)}% (should be 100%)
        </div>
    ` : ''}

    <div style="margin-top: 30px; font-size: 10px; color: #666;">
        <p><strong>Note:</strong> This statement shows the allocation of practice profit to each partner based on the agreed profit-sharing ratio, adjusted for drawings and withholding tax paid during the year.</p>
        <p>Generated on ${new Date().toLocaleDateString('en-IE')} by GP Practice Financial Manager</p>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-semibold mb-2" style={{ color: COLORS.textPrimary }}>
                    Partner's Capital Accounts
                </h2>
                <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                    Allocate practice profit to partners and track capital balances
                </p>
            </div>

            {/* Controls */}
            <div className="mb-6 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                        Tax Year
                    </label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full border rounded px-3 py-2"
                        style={{ borderColor: COLORS.borderLight }}
                    >
                        {[2024, 2023, 2022, 2021, 2020].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                        Practice Profit/(Loss) for {selectedYear}
                    </label>
                    <input
                        type="number"
                        value={practiceProfitLoss || ''}
                        onChange={(e) => setPracticeProfitLoss(parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-3 py-2 font-bold text-lg"
                        style={{
                            borderColor: COLORS.borderLight,
                            color: practiceProfitLoss >= 0 ? COLORS.incomeColor : COLORS.expenseColor
                        }}
                        placeholder="€0.00"
                    />
                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                        Auto-calculated from transactions, or enter manually
                    </p>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                        Total Withholding Tax for {selectedYear}
                    </label>
                    <input
                        type="number"
                        value={totalWithholdingTax || ''}
                        onChange={(e) => setTotalWithholdingTax(parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-3 py-2 font-bold text-lg"
                        style={{
                            borderColor: COLORS.borderLight,
                            color: COLORS.expenseColor
                        }}
                        placeholder="€0.00"
                    />
                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                        Will be allocated per profit share (use calculator below)
                    </p>
                </div>

                <div className="flex items-end gap-2">
                    <button
                        onClick={exportToPDF}
                        className="px-4 py-2 rounded font-medium flex items-center gap-2"
                        style={{
                            color: COLORS.slainteBlue,
                            backgroundColor: 'transparent',
                            border: `2px solid ${COLORS.slainteBlue}`
                        }}
                    >
                        <FileText className="h-4 w-4" />
                        Export to PDF
                    </button>
                </div>
            </div>

            {/* Validation Warning */}
            {totalProfitShare !== 100 && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm text-yellow-800">
                            <strong>Warning:</strong> Total profit share is {totalProfitShare.toFixed(2)}% (should be 100%)
                        </p>
                    </div>
                </div>
            )}

            {/* No Partners Warning */}
            {availablePartners.length === 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-900 mb-1">No Partners Set Up</p>
                            <p className="text-xs text-blue-800">
                                You haven't set up any partners yet. Partners are configured during practice setup
                                or in Admin Settings under Category Management. Partner names come from categories
                                with "Partner Drawings" labels (code 90.x).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Partners Table */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
                        Partners
                    </h3>
                    <button
                        onClick={addPartner}
                        className="flex items-center gap-2 px-4 py-2 rounded text-white"
                        style={{ backgroundColor: COLORS.slainteBlue }}
                        disabled={availablePartners.length === 0}
                        title={availablePartners.length === 0 ? "Set up partners in Admin Settings first" : ""}
                    >
                        <Plus className="h-4 w-4" />
                        Add Partner
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr style={{ backgroundColor: COLORS.bgPage }}>
                                <th className="p-3 text-left text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Partner Name</th>
                                <th className="p-3 text-right text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Profit Share %</th>
                                <th className="p-3 text-right text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Opening Balance</th>
                                <th className="p-3 text-right text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Share of Profit</th>
                                <th className="p-3 text-right text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Drawings</th>
                                <th className="p-3 text-right text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Withholding Tax</th>
                                <th className="p-3 text-right text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Closing Balance</th>
                                <th className="p-3 text-center text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partners.map((partner, index) => {
                                const allocation = allocations[index];
                                return (
                                    <tr key={index} className="border-b" style={{ borderColor: COLORS.borderLight }}>
                                        <td className="p-3">
                                            <select
                                                value={partner.name}
                                                onChange={(e) => updatePartner(index, 'name', e.target.value)}
                                                className="w-full border rounded px-2 py-1"
                                                style={{ borderColor: COLORS.borderLight }}
                                            >
                                                <option value="">-- Select Partner --</option>
                                                {availablePartners.map((partnerName, i) => (
                                                    <option key={i} value={partnerName}>{partnerName}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="number"
                                                value={partner.profitSharePercentage || ''}
                                                onChange={(e) => updatePartner(index, 'profitSharePercentage', e.target.value)}
                                                className="w-full border rounded px-2 py-1 text-right"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="0"
                                                step="0.01"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="number"
                                                value={partner.openingBalance || ''}
                                                onChange={(e) => updatePartner(index, 'openingBalance', e.target.value)}
                                                className="w-full border rounded px-2 py-1 text-right"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </td>
                                        <td className="p-3 text-right font-semibold" style={{ color: COLORS.incomeColor }}>
                                            {formatCurrency(allocation.shareOfProfit)}
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="number"
                                                value={partner.drawings || ''}
                                                onChange={(e) => updatePartner(index, 'drawings', e.target.value)}
                                                className="w-full border rounded px-2 py-1 text-right"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </td>
                                        <td className="p-3 text-right font-semibold" style={{ color: COLORS.expenseColor }}>
                                            {formatCurrency(allocation.allocatedWithholdingTax)}
                                        </td>
                                        <td className="p-3 text-right font-bold" style={{
                                            color: allocation.closingBalance >= 0 ? COLORS.slainteBlue : COLORS.expenseColor
                                        }}>
                                            {formatCurrency(allocation.closingBalance)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => removePartner(index)}
                                                className="p-1 hover:bg-red-50 rounded"
                                                style={{ color: COLORS.expenseColor }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Totals Row */}
                            <tr style={{ backgroundColor: COLORS.bgPage, fontWeight: 'bold' }}>
                                <td className="p-3">TOTAL</td>
                                <td className="p-3 text-right">{totalProfitShare.toFixed(2)}%</td>
                                <td className="p-3 text-right">{formatCurrency(allocations.reduce((sum, a) => sum + a.openingBalance, 0))}</td>
                                <td className="p-3 text-right" style={{ color: COLORS.incomeColor }}>
                                    {formatCurrency(totalAllocated)}
                                </td>
                                <td className="p-3 text-right">{formatCurrency(allocations.reduce((sum, a) => sum + a.drawings, 0))}</td>
                                <td className="p-3 text-right">{formatCurrency(totalWithholdingTax)}</td>
                                <td className="p-3 text-right" style={{ color: COLORS.slainteBlue }}>
                                    {formatCurrency(allocations.reduce((sum, a) => sum + a.closingBalance, 0))}
                                </td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Withholding Tax Calculator Section */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="font-semibold" style={{ color: COLORS.textPrimary }}>Withholding Tax Calculator</h4>
                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                            Calculate withholding tax from State Contracts and GMS payments
                        </p>
                    </div>
                    <button
                        onClick={() => setShowWithholdingTaxCalc(!showWithholdingTaxCalc)}
                        className="flex items-center gap-2 px-4 py-2 rounded border-2"
                        style={{
                            borderColor: COLORS.slainteBlue,
                            color: COLORS.slainteBlue,
                            backgroundColor: showWithholdingTaxCalc ? `${COLORS.slainteBlue}15` : 'transparent'
                        }}
                    >
                        <Calculator className="h-4 w-4" />
                        {showWithholdingTaxCalc ? 'Hide Calculator' : 'Open Calculator'}
                    </button>
                </div>

                {showWithholdingTaxCalc && (
                    <WithholdingTaxCalculator
                        onCalculate={handleWithholdingTaxCalculation}
                        partnerProfitShares={partners.reduce((acc, p) => {
                            if (p.name) {
                                acc[p.name] = p.profitSharePercentage;
                            }
                            return acc;
                        }, {})}
                    />
                )}
            </div>

            {/* Help Text */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                <h4 className="font-semibold mb-2" style={{ color: COLORS.textPrimary }}>How This Works:</h4>
                <ul className="text-sm space-y-1" style={{ color: COLORS.textSecondary }}>
                    <li>• <strong>Opening Balance:</strong> Each partner's capital account balance at the start of the year</li>
                    <li>• <strong>Share of Profit:</strong> Automatically calculated based on profit share percentage</li>
                    <li>• <strong>Drawings:</strong> Money withdrawn by the partner during the year</li>
                    <li>• <strong>Withholding Tax:</strong> Tax deducted at source (e.g., from GMS income and State Contracts). Enter the total practice withholding tax above, and it will be allocated to each partner based on their profit share percentage. Use the calculator to compute the total.</li>
                    <li>• <strong>Closing Balance:</strong> Opening Balance + Share of Profit - Drawings - Allocated Withholding Tax</li>
                </ul>
            </div>
        </div>
    );
}
