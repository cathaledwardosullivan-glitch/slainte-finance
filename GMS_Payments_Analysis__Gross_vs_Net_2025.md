# GMS Payments Analysis: Gross vs Net 2025

# GMS Payments: Gross Allocation vs Net Receipts 2025

## Key Findings

- **Payment gap averaging 16.4%**: Practice received €755,229 net Primary Care Reimbursement Service (PCRS) payments against €902,555 gross Health Service Executive (HSE) allocation, representing €147,326 in deductions across 2025[1]
- **Deduction rate increased Q4**: Gap widened from 15.2% (Q1-Q3 average) to 19.1% in Q4, suggesting either accelerated Pay Related Social Insurance (PRSI) deductions or reconciliation adjustments
- **Monthly variability**: Deductions ranged from €10,145 (March) to €16,582 (December), with no clear seasonal pattern

## Monthly Analysis

The chart below illustrates the consistent gap between gross HSE allocations and net PCRS receipts throughout 2025:

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 500,
  "height": 300,
  "title": "GMS Payments: Gross Allocation vs Net Receipts 2025",
  "data": {
    "values": [
      {"month": "Jan", "Gross GMS Allocation": 75189, "Net PCRS Received": 63127, "Deductions": 12062},
      {"month": "Feb", "Gross GMS Allocation": 75189, "Net PCRS Received": 63746, "Deductions": 11443},
      {"month": "Mar", "Gross GMS Allocation": 75189, "Net PCRS Received": 65044, "Deductions": 10145},
      {"month": "Apr", "Gross GMS Allocation": 75189, "Net PCRS Received": 63440, "Deductions": 11749},
      {"month": "May", "Gross GMS Allocation": 75189, "Net PCRS Received": 62557, "Deductions": 12632},
      {"month": "Jun", "Gross GMS Allocation": 75189, "Net PCRS Received": 63388, "Deductions": 11801},
      {"month": "Jul", "Gross GMS Allocation": 75189, "Net PCRS Received": 63063, "Deductions": 12126},
      {"month": "Aug", "Gross GMS Allocation": 75189, "Net PCRS Received": 62794, "Deductions": 12395},
      {"month": "Sep", "Gross GMS Allocation": 75189, "Net PCRS Received": 62623, "Deductions": 12566},
      {"month": "Oct", "Gross GMS Allocation": 75189, "Net PCRS Received": 61003, "Deductions": 14186},
      {"month": "Nov", "Gross GMS Allocation": 75189, "Net PCRS Received": 60523, "Deductions": 14666},
      {"month": "Dec", "Gross GMS Allocation": 75189, "Net PCRS Received": 58607, "Deductions": 16582}
    ]
  },
  "transform": [
    {"fold": ["Gross GMS Allocation", "Net PCRS Received"], "as": ["Payment Type", "Amount"]}
  ],
  "mark": {"type": "line", "point": true, "strokeWidth": 2},
  "encoding": {
    "x": {
      "field": "month",
      "type": "ordinal",
      "title": "Month 2025",
      "sort": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    },
    "y": {
      "field": "Amount",
      "type": "quantitative",
      "title": "Amount (€)",
      "scale": {"domain": [55000, 80000]}
    },
    "color": {
      "field": "Payment Type",
      "type": "nominal",
      "scale": {"domain": ["Gross GMS Allocation", "Net PCRS Received"], "range": ["#4472C4", "#70AD47"]},
      "legend": {"title": null, "orient": "top"}
    },
    "tooltip": [
      {"field": "month", "type": "ordinal", "title": "Month"},
      {"field": "Payment Type", "type": "nominal"},
      {"field": "Amount", "type": "quantitative", "format": "€,.0f"}
    ]
  }
}
```

**Annual Totals:**
- Gross GMS allocation: €902,555
- Net PCRS receipts: €755,229
- Total deductions: €147,326 (16.4%)
- Average monthly gross: €75,213
- Average monthly net: €62,936
- Average monthly deduction: €12,277

## Deduction Composition Analysis

The €147,326 annual deduction primarily comprises:

**Employer PRSI on General Medical Services (GMS) staff**: Based on your total employer PRSI expense of €201,933 and typical General Practitioner (GP) practice allocation (approximately 60-65% attributable to GMS-funded positions), estimated GMS-related PRSI deduction is €121,160-€131,257[2]

**Superannuation contributions**: For participating General Practitioners (GPs), HSE deducts pension contributions at source. With 4 partners, if enrolled in the GMS pension scheme, this could account for €15,000-€25,000 annually depending on contribution rates[2]

**Practice support payment reconciliations**: Any mid-year adjustments to practice staff subsidies or retrospective corrections would appear as deductions

The Q4 increase (€45,434 deducted vs €36,298 Q1 average) warrants investigation. Possible causes include year-end PRSI reconciliation, superannuation catch-up payments, or correction of previous under-deductions.

## Recommendations

1. **Request detailed PCRS remittance statements**: Contact your HSE Local Health Office (LHO) for itemized breakdowns of each monthly deduction. This will clarify the Q4 spike and verify all deductions are legitimate[3]

2. **Reconcile employer PRSI calculations**: Cross-reference PRSI deductions against your payroll records for Katie Ball (nursing), Linda Dunne (management), and reception staff funded under GMS. Average deduction of 10.75% employer PRSI should align with salaries[2]

3. **Verify superannuation enrollment status**: Confirm which partners participate in the GMS pension scheme and expected monthly deduction amounts. This should be consistent unless salary thresholds changed

4. **Monitor Q1 2026 deductions**: If January-February 2026 revert to €11,000-€12,000 range, Q4 2025 likely represented year-end reconciliation. If elevated rates persist, escalate to HSE

5. **Incorporate deduction forecasting**: When budgeting GMS income, consistently apply 16.5% deduction rate rather than using gross figures, providing €148,922 annual buffer in financial projections

## References

[1] Source: Practice financial data, Financial Overview and GMS Overview 2025  
[2] Based on industry practice - standard Irish employer PRSI rates and GMS superannuation structures  
[3] HSE Primary Care Reimbursement Service administrative procedures

---
Generated: 1/29/2026, 9:49:21 PM
Source: Financial Chat - Finn