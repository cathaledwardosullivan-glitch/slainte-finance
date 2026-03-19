import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import {
    FileText, Download, Save, AlertCircle, CheckCircle,
    ChevronDown, ChevronUp, Calculator, Car, Building
} from 'lucide-react';

export default function PersonalTaxReturnForm() {
    const { transactions, selectedYear, setSelectedYear } = useAppContext();

    // State for all form sections
    const [formData, setFormData] = useState({
        // Part 1: Personal Details
        fullName: '',
        ppsn: '',
        address: '',
        spouseName: '',
        spousePpsn: '',
        businessName: '',
        businessAddress: '',
        taxRegistrationNumber: '',
        vatNumber: '',

        // Part 2: Income (will be auto-populated from transactions)
        privatePatientFees: 0,
        vhiIncome: 0,
        layaIncome: 0,
        irishLifeHealthIncome: 0,
        otherInsurersIncome: 0,
        gmsHseIncome: 0,
        medicoLegalIncome: 0,
        lecturingIncome: 0,
        sessionalIncome: 0,
        otherProfessionalIncome: 0,
        rentalIncome: 0,
        dividendIncome: 0,
        depositInterest: 0,
        payeGrossPay: 0,
        payeTaxPaid: 0,
        payeUscPaid: 0,
        payePrsiPaid: 0,

        // Part 3: Expenses (will be auto-populated from transactions)
        medicalCouncilFee: 0,
        indemnityInsurance: 0,
        professionalSubscriptions: 0,
        medicalJournals: 0,
        clinicRent: 0,
        businessRates: 0,
        lightHeat: 0,
        telephoneInternet: 0,
        clinicInsurance: 0,
        repairsMaintenance: 0,
        staffSalaries: 0,
        employerPrsi: 0,
        medicalSupplies: 0,
        stationeryPostage: 0,

        // Motor expenses (manual - can use calculator)
        businessMileage: 0,
        totalMileage: 0,
        motorFuel: 0,
        motorInsurance: 0,
        motorTax: 0,
        nct: 0,
        motorRepairs: 0,
        motorCalculatedExpense: 0,

        cpdCourses: 0,
        cpdTravel: 0,
        accountancyFees: 0,
        bankCharges: 0,
        softwareSubscriptions: 0,

        // Part 4: Capital Allowances (from depreciation calculator)
        capitalAssets: [],
        depreciationExpense: 0,

        // Part 5: Reliefs
        pensionContributions: 0,
        medicalExpenses: 0,
        charitableDonations: 0,
        preliminaryTaxPaid: 0
    });

    // Expanded sections state
    const [expandedSections, setExpandedSections] = useState({
        part1: true,
        part2: false,
        part3: false,
        part4: false,
        part5: false
    });

    // Auto-populate flag
    const [autoPopulated, setAutoPopulated] = useState(false);

    // Toggle section expansion
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Auto-populate from transaction data
    const autoPopulateFromTransactions = () => {
        if (!transactions || transactions.length === 0) {
            alert('No transaction data available. Upload transactions first to auto-populate income and expenses.');
            return;
        }

        // Filter transactions for selected year
        const yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            return new Date(t.date).getFullYear() === selectedYear;
        });

        if (yearTransactions.length === 0) {
            alert(`No transactions found for ${selectedYear}. Please select a different year.`);
            return;
        }

        // Calculate income by category
        const incomeByCategory = {};
        const expenseByCategory = {};

        yearTransactions.forEach(t => {
            const amount = t.credit || t.debit || t.amount || 0;
            if (amount === 0) return;

            const categoryName = t.category?.name || 'Uncategorized';
            const categoryType = t.category?.type;

            if (categoryType === 'income') {
                incomeByCategory[categoryName] = (incomeByCategory[categoryName] || 0) + amount;
            } else if (categoryType === 'expense') {
                expenseByCategory[categoryName] = (expenseByCategory[categoryName] || 0) + amount;
            }
        });

        // Map to form fields (this is a simplified mapping - you may need to customize)
        const newFormData = { ...formData };

        // Income mapping
        Object.entries(incomeByCategory).forEach(([category, amount]) => {
            const catLower = category.toLowerCase();
            if (catLower.includes('private') || catLower.includes('patient fee')) {
                newFormData.privatePatientFees += amount;
            } else if (catLower.includes('vhi')) {
                newFormData.vhiIncome += amount;
            } else if (catLower.includes('laya')) {
                newFormData.layaIncome += amount;
            } else if (catLower.includes('irish life')) {
                newFormData.irishLifeHealthIncome += amount;
            } else if (catLower.includes('gms') || catLower.includes('hse')) {
                newFormData.gmsHseIncome += amount;
            } else if (catLower.includes('medico') || catLower.includes('legal')) {
                newFormData.medicoLegalIncome += amount;
            } else if (catLower.includes('lecture') || catLower.includes('teaching')) {
                newFormData.lecturingIncome += amount;
            } else if (catLower.includes('sessional')) {
                newFormData.sessionalIncome += amount;
            } else {
                newFormData.otherProfessionalIncome += amount;
            }
        });

        // Expense mapping (simplified)
        Object.entries(expenseByCategory).forEach(([category, amount]) => {
            const catLower = category.toLowerCase();
            if (catLower.includes('medical council')) {
                newFormData.medicalCouncilFee += amount;
            } else if (catLower.includes('indemnity') || catLower.includes('insurance')) {
                newFormData.indemnityInsurance += amount;
            } else if (catLower.includes('subscription')) {
                newFormData.professionalSubscriptions += amount;
            } else if (catLower.includes('rent')) {
                newFormData.clinicRent += amount;
            } else if (catLower.includes('light') || catLower.includes('heat') || catLower.includes('electric') || catLower.includes('gas')) {
                newFormData.lightHeat += amount;
            } else if (catLower.includes('telephone') || catLower.includes('internet') || catLower.includes('phone')) {
                newFormData.telephoneInternet += amount;
            } else if (catLower.includes('repair') || catLower.includes('maintenance')) {
                newFormData.repairsMaintenance += amount;
            } else if (catLower.includes('staff') || catLower.includes('salary') || catLower.includes('wage')) {
                newFormData.staffSalaries += amount;
            } else if (catLower.includes('prsi') && catLower.includes('employer')) {
                newFormData.employerPrsi += amount;
            } else if (catLower.includes('medical supplies') || catLower.includes('consumable')) {
                newFormData.medicalSupplies += amount;
            } else if (catLower.includes('stationery') || catLower.includes('postage') || catLower.includes('printing')) {
                newFormData.stationeryPostage += amount;
            } else if (catLower.includes('cpd') || catLower.includes('course') || catLower.includes('conference')) {
                newFormData.cpdCourses += amount;
            } else if (catLower.includes('accountant') || catLower.includes('accountancy')) {
                newFormData.accountancyFees += amount;
            } else if (catLower.includes('bank') && catLower.includes('charge')) {
                newFormData.bankCharges += amount;
            } else if (catLower.includes('software')) {
                newFormData.softwareSubscriptions += amount;
            }
        });

        setFormData(newFormData);
        setAutoPopulated(true);
        alert(`Successfully populated data from ${yearTransactions.length} transactions for ${selectedYear}!`);
    };

    // Calculate totals
    const calculateTotals = () => {
        const totalIncome =
            formData.privatePatientFees +
            formData.vhiIncome +
            formData.layaIncome +
            formData.irishLifeHealthIncome +
            formData.otherInsurersIncome +
            formData.gmsHseIncome +
            formData.medicoLegalIncome +
            formData.lecturingIncome +
            formData.sessionalIncome +
            formData.otherProfessionalIncome +
            formData.rentalIncome +
            formData.dividendIncome +
            formData.depositInterest;

        const totalProfessionalIncome =
            formData.privatePatientFees +
            formData.vhiIncome +
            formData.layaIncome +
            formData.irishLifeHealthIncome +
            formData.otherInsurersIncome +
            formData.gmsHseIncome +
            formData.medicoLegalIncome +
            formData.lecturingIncome +
            formData.sessionalIncome +
            formData.otherProfessionalIncome;

        const totalBusinessExpenses =
            formData.medicalCouncilFee +
            formData.indemnityInsurance +
            formData.professionalSubscriptions +
            formData.medicalJournals +
            formData.clinicRent +
            formData.businessRates +
            formData.lightHeat +
            formData.telephoneInternet +
            formData.clinicInsurance +
            formData.repairsMaintenance +
            formData.staffSalaries +
            formData.employerPrsi +
            formData.medicalSupplies +
            formData.stationeryPostage +
            (formData.motorCalculatedExpense || (formData.motorFuel + formData.motorInsurance + formData.motorTax + formData.nct + formData.motorRepairs)) +
            formData.cpdCourses +
            formData.cpdTravel +
            formData.accountancyFees +
            formData.bankCharges +
            formData.softwareSubscriptions;

        const netRelevantEarnings = totalProfessionalIncome - totalBusinessExpenses;

        return {
            totalIncome,
            totalProfessionalIncome,
            totalBusinessExpenses,
            netRelevantEarnings
        };
    };

    const totals = calculateTotals();

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Handle field change
    const handleFieldChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: parseFloat(value) || 0
        }));
    };

    // Export to PDF
    const exportToPDF = () => {
        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Personal Tax Return Information - ${selectedYear}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .section h2 { background-color: #e3f2fd; padding: 8px; border-left: 4px solid #1976d2; }
        .field-row { display: grid; grid-template-columns: 60% 40%; padding: 6px; border-bottom: 1px solid #eee; }
        .field-label { font-weight: 500; }
        .field-value { text-align: right; }
        .total-row { background-color: #f5f5f5; font-weight: bold; padding: 8px; margin-top: 8px; }
        .disclaimer { background-color: #fff3cd; padding: 15px; margin-top: 30px; border: 1px solid #ffc107; border-radius: 4px; }
        @media print { body { margin: 10px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Information Checklist for Self-Employed Doctor's Tax Return (Ireland)</h1>
        <h2>For the Tax Year: ${selectedYear}</h2>
        <p>Prepared on: ${new Date().toLocaleDateString('en-IE')}</p>
    </div>

    <div class="section">
        <h2>Part 1: Personal & Business Details</h2>
        <div class="field-row"><div class="field-label">Full Name:</div><div class="field-value">${formData.fullName || '[Not provided]'}</div></div>
        <div class="field-row"><div class="field-label">PPSN:</div><div class="field-value">${formData.ppsn || '[Not provided]'}</div></div>
        <div class="field-row"><div class="field-label">Address:</div><div class="field-value">${formData.address || '[Not provided]'}</div></div>
        <div class="field-row"><div class="field-label">Business Name:</div><div class="field-value">${formData.businessName || '[Not provided]'}</div></div>
        <div class="field-row"><div class="field-label">Business Address:</div><div class="field-value">${formData.businessAddress || '[Not provided]'}</div></div>
    </div>

    <div class="section">
        <h2>Part 2: Income / Revenue</h2>
        <div class="field-row"><div class="field-label">Private Patient Fees:</div><div class="field-value">${formatCurrency(formData.privatePatientFees)}</div></div>
        <div class="field-row"><div class="field-label">VHI Healthcare:</div><div class="field-value">${formatCurrency(formData.vhiIncome)}</div></div>
        <div class="field-row"><div class="field-label">Laya Healthcare:</div><div class="field-value">${formatCurrency(formData.layaIncome)}</div></div>
        <div class="field-row"><div class="field-label">Irish Life Health:</div><div class="field-value">${formatCurrency(formData.irishLifeHealthIncome)}</div></div>
        <div class="field-row"><div class="field-label">Other Insurers:</div><div class="field-value">${formatCurrency(formData.otherInsurersIncome)}</div></div>
        <div class="field-row"><div class="field-label">GMS / HSE Payments:</div><div class="field-value">${formatCurrency(formData.gmsHseIncome)}</div></div>
        <div class="field-row"><div class="field-label">Medico-legal Reports:</div><div class="field-value">${formatCurrency(formData.medicoLegalIncome)}</div></div>
        <div class="field-row"><div class="field-label">Lecturing/Teaching:</div><div class="field-value">${formatCurrency(formData.lecturingIncome)}</div></div>
        <div class="field-row"><div class="field-label">Sessional Work:</div><div class="field-value">${formatCurrency(formData.sessionalIncome)}</div></div>
        <div class="field-row"><div class="field-label">Other Professional Income:</div><div class="field-value">${formatCurrency(formData.otherProfessionalIncome)}</div></div>
        <div class="total-row">
            <div style="display: flex; justify-content: space-between;">
                <span>Total Professional Income:</span>
                <span>${formatCurrency(totals.totalProfessionalIncome)}</span>
            </div>
        </div>
        <div class="field-row"><div class="field-label">Rental Income:</div><div class="field-value">${formatCurrency(formData.rentalIncome)}</div></div>
        <div class="field-row"><div class="field-label">Dividend Income:</div><div class="field-value">${formatCurrency(formData.dividendIncome)}</div></div>
        <div class="field-row"><div class="field-label">Deposit Interest:</div><div class="field-value">${formatCurrency(formData.depositInterest)}</div></div>
        <div class="total-row">
            <div style="display: flex; justify-content: space-between;">
                <span>TOTAL INCOME:</span>
                <span>${formatCurrency(totals.totalIncome)}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Part 3: Allowable Business Expenses</h2>
        <div class="field-row"><div class="field-label">Medical Council Registration:</div><div class="field-value">${formatCurrency(formData.medicalCouncilFee)}</div></div>
        <div class="field-row"><div class="field-label">Medical Indemnity Insurance:</div><div class="field-value">${formatCurrency(formData.indemnityInsurance)}</div></div>
        <div class="field-row"><div class="field-label">Professional Subscriptions:</div><div class="field-value">${formatCurrency(formData.professionalSubscriptions)}</div></div>
        <div class="field-row"><div class="field-label">Clinic Rent:</div><div class="field-value">${formatCurrency(formData.clinicRent)}</div></div>
        <div class="field-row"><div class="field-label">Light & Heat:</div><div class="field-value">${formatCurrency(formData.lightHeat)}</div></div>
        <div class="field-row"><div class="field-label">Telephone & Internet:</div><div class="field-value">${formatCurrency(formData.telephoneInternet)}</div></div>
        <div class="field-row"><div class="field-label">Repairs & Maintenance:</div><div class="field-value">${formatCurrency(formData.repairsMaintenance)}</div></div>
        <div class="field-row"><div class="field-label">Staff Salaries:</div><div class="field-value">${formatCurrency(formData.staffSalaries)}</div></div>
        <div class="field-row"><div class="field-label">Employer's PRSI:</div><div class="field-value">${formatCurrency(formData.employerPrsi)}</div></div>
        <div class="field-row"><div class="field-label">Medical Supplies:</div><div class="field-value">${formatCurrency(formData.medicalSupplies)}</div></div>
        <div class="field-row"><div class="field-label">Stationery & Postage:</div><div class="field-value">${formatCurrency(formData.stationeryPostage)}</div></div>
        <div class="field-row"><div class="field-label">Motor Expenses:</div><div class="field-value">${formatCurrency(formData.motorCalculatedExpense || (formData.motorFuel + formData.motorInsurance + formData.motorTax + formData.nct + formData.motorRepairs))}</div></div>
        <div class="field-row"><div class="field-label">CPD Courses:</div><div class="field-value">${formatCurrency(formData.cpdCourses)}</div></div>
        <div class="field-row"><div class="field-label">Accountancy Fees:</div><div class="field-value">${formatCurrency(formData.accountancyFees)}</div></div>
        <div class="field-row"><div class="field-label">Bank Charges:</div><div class="field-value">${formatCurrency(formData.bankCharges)}</div></div>
        <div class="field-row"><div class="field-label">Software Subscriptions:</div><div class="field-value">${formatCurrency(formData.softwareSubscriptions)}</div></div>
        <div class="total-row">
            <div style="display: flex; justify-content: space-between;">
                <span>TOTAL BUSINESS EXPENSES:</span>
                <span>${formatCurrency(totals.totalBusinessExpenses)}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Part 4: Capital Allowances</h2>
        <div class="field-row"><div class="field-label">Depreciation (from calculator):</div><div class="field-value">${formatCurrency(formData.depreciationExpense)}</div></div>
    </div>

    <div class="section">
        <h2>Part 5: Tax Credits & Reliefs</h2>
        <div class="field-row"><div class="field-label">Pension Contributions:</div><div class="field-value">${formatCurrency(formData.pensionContributions)}</div></div>
        <div class="field-row"><div class="field-label">Medical Expenses:</div><div class="field-value">${formatCurrency(formData.medicalExpenses)}</div></div>
        <div class="field-row"><div class="field-label">Charitable Donations:</div><div class="field-value">${formatCurrency(formData.charitableDonations)}</div></div>
        <div class="field-row"><div class="field-label">Preliminary Tax Paid:</div><div class="field-value">${formatCurrency(formData.preliminaryTaxPaid)}</div></div>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="total-row">
            <div style="display: flex; justify-content: space-between;">
                <span>Total Professional Income:</span>
                <span>${formatCurrency(totals.totalProfessionalIncome)}</span>
            </div>
        </div>
        <div class="total-row">
            <div style="display: flex; justify-content: space-between;">
                <span>Total Business Expenses:</span>
                <span>(${formatCurrency(totals.totalBusinessExpenses)})</span>
            </div>
        </div>
        <div class="total-row" style="background-color: #e3f2fd;">
            <div style="display: flex; justify-content: space-between;">
                <span><strong>Net Relevant Earnings (NRE):</strong></span>
                <span><strong>${formatCurrency(totals.netRelevantEarnings)}</strong></span>
            </div>
        </div>
    </div>

    <div class="disclaimer">
        <h3 style="margin-top: 0;">Important Disclaimer</h3>
        <p><strong>This form is for information-gathering purposes only and is NOT a substitute for professional tax advice.</strong></p>
        <p>The Irish tax system, especially for self-employed professionals, has many specific rules and nuances. This document should be used to prepare your information for a qualified accountant or tax advisor who can ensure everything is filed correctly and that you are availing of all applicable reliefs and credits.</p>
    </div>

    <div style="margin-top: 30px; font-size: 10px; color: #666; text-align: center;">
        Generated on ${new Date().toLocaleDateString('en-IE')} by GP Practice Financial Manager
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
                    Personal Tax Return Information Form
                </h2>
                <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                    Comprehensive tax information checklist for self-employed GPs in Ireland
                </p>

                {/* Disclaimer */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-yellow-900 mb-1">Important Disclaimer</p>
                            <p className="text-xs text-yellow-800">
                                This form is for <strong>information-gathering purposes only</strong> and is <strong>not a substitute for professional tax advice</strong>.
                                Please use this to prepare your information for a qualified accountant or tax advisor.
                            </p>
                        </div>
                    </div>
                </div>
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

                <div className="flex items-end gap-2">
                    <button
                        onClick={autoPopulateFromTransactions}
                        className="px-4 py-2 rounded font-medium text-white flex items-center gap-2"
                        style={{ backgroundColor: COLORS.slainteBlue }}
                    >
                        <Download className="h-4 w-4" />
                        Auto-populate from Transactions
                    </button>

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

            {/* Auto-populated notification */}
            {autoPopulated && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <p className="text-sm text-green-800">
                            Data auto-populated from transactions. Review and adjust as needed.
                        </p>
                    </div>
                </div>
            )}

            {/* Summary Card */}
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                <h3 className="font-semibold mb-3" style={{ color: COLORS.textPrimary }}>Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs" style={{ color: COLORS.textSecondary }}>Total Income</p>
                        <p className="text-lg font-bold" style={{ color: COLORS.incomeColor }}>
                            {formatCurrency(totals.totalIncome)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs" style={{ color: COLORS.textSecondary }}>Total Expenses</p>
                        <p className="text-lg font-bold" style={{ color: COLORS.expenseColor }}>
                            {formatCurrency(totals.totalBusinessExpenses)}
                        </p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-xs" style={{ color: COLORS.textSecondary }}>Net Relevant Earnings (NRE)</p>
                        <p className="text-xl font-bold" style={{ color: COLORS.slainteBlue }}>
                            {formatCurrency(totals.netRelevantEarnings)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                            (Used for pension contribution calculations)
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Sections - Collapsible */}
            <div className="space-y-4">
                {/* Part 1: Personal & Business Details */}
                <div className="border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <button
                        onClick={() => toggleSection('part1')}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{expandedSections.part1 ? '▼' : '▶'}</span>
                            <div className="text-left">
                                <h3 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                                    Part 1: Personal & Business Details
                                </h3>
                                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                                    Your personal and practice information
                                </p>
                            </div>
                        </div>
                    </button>

                    {expandedSections.part1 && (
                        <div className="p-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="Dr. John Smith"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        PPSN
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.ppsn}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ppsn: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="1234567AB"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="123 Main Street, Dublin, D01 ABC1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Spouse's/Civil Partner's Name (if applicable)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.spouseName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, spouseName: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Spouse's/Civil Partner's PPSN (if applicable)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.spousePpsn}
                                        onChange={(e) => setFormData(prev => ({ ...prev, spousePpsn: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Business/Practice Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="Smith Medical Practice"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Business/Practice Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.businessAddress}
                                        onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Revenue Tax Registration Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.taxRegistrationNumber}
                                        onChange={(e) => setFormData(prev => ({ ...prev, taxRegistrationNumber: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        VAT Number (if registered)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.vatNumber}
                                        onChange={(e) => setFormData(prev => ({ ...prev, vatNumber: e.target.value }))}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="Most medical services are VAT exempt"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Part 2: Income/Revenue */}
                <div className="border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <button
                        onClick={() => toggleSection('part2')}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{expandedSections.part2 ? '▼' : '▶'}</span>
                            <div className="text-left flex-1">
                                <h3 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                                    Part 2: Income / Revenue
                                </h3>
                                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                                    All income sources • Total: {formatCurrency(totals.totalIncome)}
                                </p>
                            </div>
                        </div>
                        {autoPopulated && (
                            <span className="text-xs px-2 py-1 rounded mr-2" style={{ backgroundColor: COLORS.incomeColorLight, color: COLORS.incomeColor }}>
                                Auto-populated
                            </span>
                        )}
                    </button>

                    {expandedSections.part2 && (
                        <div className="p-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                            <div className="space-y-6">
                                {/* Professional Income */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Professional Income</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Private Patient Fees
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.privatePatientFees || ''}
                                                onChange={(e) => handleFieldChange('privatePatientFees', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                VHI Healthcare
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.vhiIncome || ''}
                                                onChange={(e) => handleFieldChange('vhiIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Laya Healthcare
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.layaIncome || ''}
                                                onChange={(e) => handleFieldChange('layaIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Irish Life Health
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.irishLifeHealthIncome || ''}
                                                onChange={(e) => handleFieldChange('irishLifeHealthIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Other Health Insurers
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.otherInsurersIncome || ''}
                                                onChange={(e) => handleFieldChange('otherInsurersIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                GMS / HSE Payments
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.gmsHseIncome || ''}
                                                onChange={(e) => handleFieldChange('gmsHseIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Medico-legal Reports
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.medicoLegalIncome || ''}
                                                onChange={(e) => handleFieldChange('medicoLegalIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Lecturing or Teaching Fees
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.lecturingIncome || ''}
                                                onChange={(e) => handleFieldChange('lecturingIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Sessional Work (non-PAYE)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.sessionalIncome || ''}
                                                onChange={(e) => handleFieldChange('sessionalIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Other Professional Income
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.otherProfessionalIncome || ''}
                                                onChange={(e) => handleFieldChange('otherProfessionalIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 p-3 rounded" style={{ backgroundColor: COLORS.incomeColorLight }}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold" style={{ color: COLORS.incomeColor }}>
                                                Total Professional Income:
                                            </span>
                                            <span className="text-lg font-bold" style={{ color: COLORS.incomeColor }}>
                                                {formatCurrency(totals.totalProfessionalIncome)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Other Income */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Other Non-Medical Income</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Rental Income
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.rentalIncome || ''}
                                                onChange={(e) => handleFieldChange('rentalIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Dividends from Shares
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.dividendIncome || ''}
                                                onChange={(e) => handleFieldChange('dividendIncome', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Deposit Interest (note if DIRT already deducted)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.depositInterest || ''}
                                                onChange={(e) => handleFieldChange('depositInterest', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* PAYE Income */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>PAYE Income (if applicable)</h4>
                                    <p className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>
                                        If you also have a salaried position, enter the details from your P60
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Gross Pay from Employment
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.payeGrossPay || ''}
                                                onChange={(e) => handleFieldChange('payeGrossPay', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                PAYE Tax Paid
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.payeTaxPaid || ''}
                                                onChange={(e) => handleFieldChange('payeTaxPaid', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                USC Paid
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.payeUscPaid || ''}
                                                onChange={(e) => handleFieldChange('payeUscPaid', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                PRSI Paid
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.payePrsiPaid || ''}
                                                onChange={(e) => handleFieldChange('payePrsiPaid', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Part 3: Allowable Business Expenses */}
                <div className="border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <button
                        onClick={() => toggleSection('part3')}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{expandedSections.part3 ? '▼' : '▶'}</span>
                            <div className="text-left flex-1">
                                <h3 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                                    Part 3: Allowable Business Expenses
                                </h3>
                                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                                    Costs incurred wholly and exclusively for your practice • Total: {formatCurrency(totals.totalBusinessExpenses)}
                                </p>
                            </div>
                        </div>
                        {autoPopulated && (
                            <span className="text-xs px-2 py-1 rounded mr-2" style={{ backgroundColor: COLORS.errorLighter, color: COLORS.expenseColor }}>
                                Auto-populated
                            </span>
                        )}
                    </button>

                    {expandedSections.part3 && (
                        <div className="p-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                            <div className="space-y-6">
                                {/* Professional Fees & Subscriptions */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Professional Fees & Subscriptions</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Medical Council Registration Fee
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.medicalCouncilFee || ''}
                                                onChange={(e) => handleFieldChange('medicalCouncilFee', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Medical Indemnity/Defence Insurance
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.indemnityInsurance || ''}
                                                onChange={(e) => handleFieldChange('indemnityInsurance', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Professional Subscriptions (ICGP, RCPI, etc.)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.professionalSubscriptions || ''}
                                                onChange={(e) => handleFieldChange('professionalSubscriptions', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Medical Journals Subscriptions
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.medicalJournals || ''}
                                                onChange={(e) => handleFieldChange('medicalJournals', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Clinic & Operational Costs */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Clinic & Operational Costs</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Clinic Rent (or proportion of mortgage interest)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.clinicRent || ''}
                                                onChange={(e) => handleFieldChange('clinicRent', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Business Rates
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.businessRates || ''}
                                                onChange={(e) => handleFieldChange('businessRates', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Light & Heat
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.lightHeat || ''}
                                                onChange={(e) => handleFieldChange('lightHeat', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Telephone & Internet
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.telephoneInternet || ''}
                                                onChange={(e) => handleFieldChange('telephoneInternet', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Clinic Insurance (Public liability, contents)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.clinicInsurance || ''}
                                                onChange={(e) => handleFieldChange('clinicInsurance', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Repairs & Maintenance (premises/equipment)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.repairsMaintenance || ''}
                                                onChange={(e) => handleFieldChange('repairsMaintenance', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Staff Costs */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Staff Costs</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Gross Salaries (receptionist, nurse, etc.)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.staffSalaries || ''}
                                                onChange={(e) => handleFieldChange('staffSalaries', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Employer's PRSI Contributions
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.employerPrsi || ''}
                                                onChange={(e) => handleFieldChange('employerPrsi', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Medical & Office Supplies */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Medical & Office Supplies</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Medical Supplies & Consumables
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.medicalSupplies || ''}
                                                onChange={(e) => handleFieldChange('medicalSupplies', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Stationery, Postage & Printing
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.stationeryPostage || ''}
                                                onChange={(e) => handleFieldChange('stationeryPostage', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Motor & Travel Expenses */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Motor & Travel Expenses (Business Use Only)</h4>
                                    <p className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>
                                        You need to separate business use from private use. Keep a logbook.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Total Business Mileage (km)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.businessMileage || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, businessMileage: parseFloat(e.target.value) || 0 }))}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="0"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Total Overall Mileage (km)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.totalMileage || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, totalMileage: parseFloat(e.target.value) || 0 }))}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Fuel
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.motorFuel || ''}
                                                onChange={(e) => handleFieldChange('motorFuel', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Insurance
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.motorInsurance || ''}
                                                onChange={(e) => handleFieldChange('motorInsurance', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Motor Tax
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.motorTax || ''}
                                                onChange={(e) => handleFieldChange('motorTax', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                NCT
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.nct || ''}
                                                onChange={(e) => handleFieldChange('nct', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Repairs, Servicing, Tyres
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.motorRepairs || ''}
                                                onChange={(e) => handleFieldChange('motorRepairs', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        className="flex items-center gap-2 px-4 py-2 rounded border-2 hover:bg-gray-50"
                                        style={{ borderColor: COLORS.slainteBlue, color: COLORS.slainteBlue }}
                                        onClick={() => alert('Motor Expense Calculator integration coming soon!')}
                                    >
                                        <Car className="h-4 w-4" />
                                        Use Motor Expense Calculator
                                    </button>
                                </div>

                                {/* CPD */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Continuing Professional Development (CPD)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Course and Conference Fees
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.cpdCourses || ''}
                                                onChange={(e) => handleFieldChange('cpdCourses', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Related Travel and Accommodation
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.cpdTravel || ''}
                                                onChange={(e) => handleFieldChange('cpdTravel', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Financial & Administrative */}
                                <div>
                                    <h4 className="font-semibold mb-3" style={{ color: COLORS.slainteBlue }}>Financial & Administrative</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Accountancy & Legal Fees
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.accountancyFees || ''}
                                                onChange={(e) => handleFieldChange('accountancyFees', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Business Bank Charges and Interest
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.bankCharges || ''}
                                                onChange={(e) => handleFieldChange('bankCharges', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                                Software Subscriptions (patient management, etc.)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.softwareSubscriptions || ''}
                                                onChange={(e) => handleFieldChange('softwareSubscriptions', e.target.value)}
                                                className="w-full border rounded px-3 py-2"
                                                style={{ borderColor: COLORS.borderLight }}
                                                placeholder="€0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="mt-3 p-3 rounded" style={{ backgroundColor: COLORS.errorLighter }}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold" style={{ color: COLORS.expenseColor }}>
                                            Total Business Expenses:
                                        </span>
                                        <span className="text-lg font-bold" style={{ color: COLORS.expenseColor }}>
                                            {formatCurrency(totals.totalBusinessExpenses)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Part 4: Capital Allowances */}
                <div className="border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <button
                        onClick={() => toggleSection('part4')}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{expandedSections.part4 ? '▼' : '▶'}</span>
                            <div className="text-left flex-1">
                                <h3 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                                    Part 4: Capital Allowances
                                </h3>
                                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                                    Assets purchased for the business (12.5% annual relief over 8 years)
                                </p>
                            </div>
                        </div>
                    </button>

                    {expandedSections.part4 && (
                        <div className="p-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                            <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                                This is for significant items you bought for the business that will last for several years (e.g., medical equipment, computers, office furniture). Tax relief is usually claimed at 12.5% per year over 8 years.
                            </p>

                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                    Total Depreciation/Capital Allowance for {selectedYear}
                                </label>
                                <input
                                    type="number"
                                    value={formData.depreciationExpense || ''}
                                    onChange={(e) => handleFieldChange('depreciationExpense', e.target.value)}
                                    className="w-full border rounded px-3 py-2"
                                    style={{ borderColor: COLORS.borderLight }}
                                    placeholder="€0.00"
                                />
                                <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                    Enter the total capital allowance claimed for this year from all assets
                                </p>
                            </div>

                            <button
                                className="flex items-center gap-2 px-4 py-2 rounded border-2 hover:bg-gray-50"
                                style={{ borderColor: COLORS.slainteBlue, color: COLORS.slainteBlue }}
                                onClick={() => alert('Depreciation Calculator integration coming soon!')}
                            >
                                <Calculator className="h-4 w-4" />
                                Use Depreciation Calculator
                            </button>

                            <div className="mt-4 p-3 rounded bg-blue-50">
                                <p className="text-xs" style={{ color: COLORS.textPrimary }}>
                                    <strong>Note:</strong> Keep receipts for all capital assets purchased. Your accountant will calculate the exact allowances based on purchase dates and asset types.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Part 5: Tax Credits, Reliefs & Payments on Account */}
                <div className="border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <button
                        onClick={() => toggleSection('part5')}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{expandedSections.part5 ? '▼' : '▶'}</span>
                            <div className="text-left flex-1">
                                <h3 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                                    Part 5: Tax Credits, Reliefs & Payments on Account
                                </h3>
                                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                                    Additional reliefs and tax already paid
                                </p>
                            </div>
                        </div>
                    </button>

                    {expandedSections.part5 && (
                        <div className="p-4 border-t" style={{ borderColor: COLORS.borderLight }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Pension Contributions
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.pensionContributions || ''}
                                        onChange={(e) => handleFieldChange('pensionContributions', e.target.value)}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="€0.00"
                                    />
                                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                        Total paid into PRSA or Retirement Annuity Contract (RAC)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Personal Medical Expenses
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.medicalExpenses || ''}
                                        onChange={(e) => handleFieldChange('medicalExpenses', e.target.value)}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="€0.00"
                                    />
                                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                        Your own or your family's qualifying health expenses (not reimbursed)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Charitable Donations
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.charitableDonations || ''}
                                        onChange={(e) => handleFieldChange('charitableDonations', e.target.value)}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="€0.00"
                                    />
                                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                        Donations to approved charities (if over €250)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                                        Preliminary Tax Paid
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.preliminaryTaxPaid || ''}
                                        onChange={(e) => handleFieldChange('preliminaryTaxPaid', e.target.value)}
                                        className="w-full border rounded px-3 py-2"
                                        style={{ borderColor: COLORS.borderLight }}
                                        placeholder="€0.00"
                                    />
                                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                        Amount of preliminary tax already paid for this tax year
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
