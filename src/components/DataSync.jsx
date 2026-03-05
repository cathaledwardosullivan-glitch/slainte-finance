// Add this function to your main App.jsx or create a new DataSync component
const exportDataForMobile = () => {
    const dataToExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        transactions: transactions,
        unidentifiedTransactions: unidentifiedTransactions,
        learnedIdentifiers: Array.from(learnedIdentifiers.entries()), // Convert Map to Array
        categoryMapping: categoryMapping,
        paymentAnalysisData: paymentAnalysisData,
        settings: {
            selectedYear: selectedYear
        },
        savedReports: JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]')
    };

    const jsonString = JSON.stringify(dataToExport);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gp-finance-mobile-sync-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Data exported! Transfer this file to your mobile device and import it there.');
};
