/**
 * Curated EHR Knowledge Base for Dara Virtual IT Support
 *
 * Each EHR system has topic sections with keywords for retrieval.
 * Content is sourced from official user manuals and research:
 * - Socrates: Live installation experience + user knowledge
 * - HPM: User Manual V3.6.6 (435 pages), CDM2 Manual, Quick Guides
 * - HealthOne: Clanwilliam user guides website
 * - CompleteGP: Public information (limited documentation available)
 */

export const EHR_KNOWLEDGE = {
  socrates: {
    name: 'Socrates',
    version: 'Current',
    topics: [
      {
        id: 'soc_patient_finder',
        title: 'Patient Finder',
        keywords: ['patient', 'finder', 'search', 'find', 'list', 'filter', 'control panel'],
        content: `The Patient Finder is accessed from My Control Panel in the main Socrates screen.

**To search for patients:**
1. Go to My Control Panel → Patient Finder
2. Click "New List" to start a fresh search
3. Choose your criteria: Patients → by Age, Gender, Patient Type, CDM Registrations, etc.
4. The patient count appears at the top of the results
5. You can export the list or refine with additional filters

**Tips:**
- You can combine multiple filters to narrow results
- "CDM Registrations" under New List → Patients shows all patients registered for Chronic Disease Management
- Patient Type filter lets you separate GMS, DVC, and Private patients`
      },
      {
        id: 'soc_cdm',
        title: 'CDM - Chronic Disease Management',
        keywords: ['cdm', 'chronic', 'disease', 'management', 'registration', 'programme', 'treatment', 'prevention', 'ocf'],
        content: `CDM (Chronic Disease Management) in Socrates covers three programme tiers:
- **CDM Treatment Programme**: Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA
- **Prevention Programme**: High-risk patients (high BMI, smokers, family history)
- **OCF (Opportunistic Case Finding)**: Screening patients not on other programmes

**To find CDM patient counts:**
1. My Control Panel → Patient Finder → New List → Patients → CDM Registrations
2. The count shows at the top of the results
3. You can filter by specific condition

**Alternative - Patients with Multiple Conditions report:**
1. Reports → Patients → Patients with Multiple Conditions
2. Click "Add ICPC-2" and enter the code (e.g., T90 for Type 2 Diabetes)
3. Run the report — patient count is shown at the top
4. Note: this includes ALL patient types (GMS + Private)

**ICPC-2 Codes for CDM conditions:**
- Type 2 Diabetes: T90
- Asthma: R96
- COPD: R95
- Heart Failure: K77
- Atrial Fibrillation: K78
- IHD (Ischaemic Heart Disease): K74 / K76
- Stroke/TIA: K90`
      },
      {
        id: 'soc_reports_diagnosis',
        title: 'Diagnosis Reports',
        keywords: ['diagnosis', 'report', 'condition', 'disease', 'ICPC', 'ICD', 'medical', 'history'],
        content: `**Running a Diagnosis Report in Socrates:**
1. Go to Reports → Patients
2. Select "Patients with Multiple Conditions"
3. Click "Add ICPC-2" to search by diagnosis code, or type the condition name
4. You can add multiple conditions and choose "Show All" or "Show Any"
5. Set date range, age, and gender filters as needed
6. Click "Run Report"
7. Patient count appears at the top; individual records listed below
8. Export to Word (for printing) or Excel

**Common ICPC-2 codes:**
- T90: Type 2 Diabetes
- R96: Asthma
- R95: COPD
- K77: Heart Failure
- K78: Atrial Fibrillation
- K74/K76: Ischaemic Heart Disease
- K90: Stroke/TIA
- K86/K87: Hypertension`
      },
      {
        id: 'soc_reports_patient',
        title: 'Patient Reports',
        keywords: ['patient', 'report', 'demographics', 'age', 'gender', 'GMS', 'private', 'DVC', 'list'],
        content: `**Patient Reports in Socrates:**
1. Go to Reports → Patients
2. Available report types include:
   - Patient List by Age/Gender
   - Practice Distribution Breakdown (aggregate counts by age band + patient type)
   - Patients with Multiple Conditions
3. Filter by: Age range, Gender, Patient Type (GMS/Private/DVC), Clinician
4. Reports output individual patient records (not aggregate counts, except Practice Distribution Breakdown)
5. Export: Word (print) or Export to Excel

**Practice Distribution Breakdown (for GMS Health Check):**
1. Reports → Patients → Practice Distribution Breakdown
2. Click "Run Report" (default filters are usually fine)
3. Click Save → CSV File
4. This gives aggregate counts by age band, patient type, and gender — no patient identifiers`
      },
      {
        id: 'soc_reports_drug',
        title: 'Drug / Medication Reports',
        keywords: ['drug', 'medication', 'medicine', 'prescribing', 'prescription', 'report'],
        content: `**Drug Reports in Socrates:**
1. Go to Reports → Medications (or Drug Reports)
2. Search by medication name — supports generic names, brand names, and wildcards
3. Filter by: Date prescribed, Age, Gender
4. Export to Word or Excel
5. Shows which patients are on a specific medication

**Tips:**
- Use wildcards for broad searches (e.g., "Metformin*" to catch all formulations)
- Useful for audits, drug recalls, or switching patients between formulations`
      },
      {
        id: 'soc_prescribing',
        title: 'Prescribing',
        keywords: ['prescribe', 'prescription', 'script', 'medication', 'drug', 'dose', 'repeat'],
        content: `**Prescribing in Socrates:**
1. Open the patient file
2. Go to the Medications/Prescribing tab
3. To add a new prescription: Click "New Prescription" or similar
4. Search for the drug by name (generic or brand)
5. Select dose, frequency, and quantity
6. For repeat prescriptions, set the repeat interval
7. Print or electronically transmit via Healthlink

**Repeat Prescriptions:**
- Set up from the Medications tab
- Can be batch-printed for multiple patients
- Check the repeat prescriptions due list regularly`
      },
      {
        id: 'soc_appointments',
        title: 'Appointments',
        keywords: ['appointment', 'schedule', 'book', 'diary', 'calendar', 'slot', 'clinic'],
        content: `**Appointments in Socrates:**
- The appointment diary is accessed from the main screen or via the Appointments menu
- You can view by day, week, or clinician
- Book appointments by clicking on a free slot and selecting a patient
- Appointment types can be configured (standard, long, phone, etc.)
- Recurring clinics can be set up for chronic disease reviews, immunisations, etc.

**Tips:**
- Use the search function to find a patient's upcoming or past appointments
- The diary view can be filtered by clinician to see individual schedules`
      },
      {
        id: 'soc_healthlink',
        title: 'Healthlink',
        keywords: ['healthlink', 'electronic', 'referral', 'lab', 'results', 'messaging', 'HL7'],
        content: `**Healthlink in Socrates:**
Healthlink is the national electronic messaging system used for:
- Receiving lab results
- Sending electronic referrals
- CDM claim submissions
- Discharge summaries

**Setup:**
- Healthlink must be configured by your IT support or Clanwilliam
- Requires a Healthlink mailbox ID and certificates
- Once configured, messages appear automatically in the Incoming Messages area

**Receiving Lab Results:**
- Lab results arrive via Healthlink and appear in the patient's file
- Review and file results from the Incoming Messages queue
- Abnormal results are typically flagged

**Sending CDM Claims:**
- CDM registrations and reviews are submitted via Healthlink
- Go to the patient's CDM section → Submit via Healthlink`
      },
      {
        id: 'soc_pcrs_import',
        title: 'PCRS Data Import',
        keywords: ['PCRS', 'import', 'csv', 'panel', 'GMS', 'download', 'upload', 'IHI'],
        content: `**Importing PCRS Data into Socrates:**
1. Download your panel file from the PCRS website (pcrs.ie)
2. The file is typically a CSV containing patient IHI numbers and GMS status
3. In Socrates, go to the import function (usually under Tools or Administration)
4. Select the PCRS CSV file
5. The system matches patients by name/DOB and updates their GMS status and IHI numbers

**Tips:**
- Run this regularly to keep your panel up to date
- Mismatches may need manual review
- The import updates Patient Identifiers with IHI numbers`
      },
      {
        id: 'soc_cervical_smears',
        title: 'Cervical Screening (CervicalCheck)',
        keywords: ['cervical', 'smear', 'screening', 'cervicalcheck', 'women', 'HPV'],
        content: `**Cervical Screening in Socrates:**
- Record cervical smear results in the patient's file under Women's Health or Cervical Smears section
- Socrates tracks screening dates and results
- Reports available under Reports → Cervical Smears
- Filter by date, age, result type
- Useful for identifying women due for screening

**CervicalCheck Eligibility:**
- Women aged 25-65 are eligible
- Screening interval: Every 3 years (25-29) or 5 years (30-65) depending on test type
- HPV testing is now the primary screening method`
      },
      {
        id: 'soc_immunisations',
        title: 'Immunisations & Vaccines',
        keywords: ['immunisation', 'immunization', 'vaccine', 'vaccination', 'flu', 'covid', 'childhood'],
        content: `**Immunisations in Socrates:**
- Record vaccinations in the patient's file under Immunisations
- Enter: Vaccine name, batch number, date, site, administrator
- Reports available under Reports → Immunisations/Vaccines
- Filter by: Date, age, gender, clinician, vaccine type, batch number
- Export to CSV or Excel

**Flu Vaccine Campaign:**
- Use the flu vaccine report to track coverage
- Can generate lists of eligible patients who haven't been vaccinated
- Batch number tracking for recall purposes`
      },
      {
        id: 'soc_recalls',
        title: 'Recalls & Reminders',
        keywords: ['recall', 'reminder', 'follow', 'up', 'due', 'overdue', 'alert'],
        content: `**Recalls in Socrates:**
- Set up patient recalls for follow-up appointments, screening, or reviews
- Recalls can be date-based (e.g., "Review in 3 months")
- View overdue recalls from the Recalls section
- Generate recall lists for batch contact (letters, texts)
- Common uses: CDM reviews, cervical screening, immunisation boosters

**Tips:**
- Check your recall list regularly for overdue patients
- Some recalls are automatically generated from CDM programme schedules`
      },
      {
        id: 'soc_backup',
        title: 'Backup & Data Safety',
        keywords: ['backup', 'restore', 'data', 'safety', 'disaster', 'recovery', 'database'],
        content: `**Backup in Socrates:**
- Socrates databases should be backed up daily
- Backup is typically configured by your IT support
- The database runs on SQL Server Express
- Backup location should be on a separate drive or network storage, NOT the same drive as the database

**Important:**
- Test your backups regularly by doing a test restore
- Keep at least 7 days of rolling backups
- Consider offsite/cloud backup for disaster recovery
- If you're unsure about your backup status, contact your IT support immediately`
      },
      {
        id: 'soc_common_errors',
        title: 'Common Issues & Troubleshooting',
        keywords: ['error', 'problem', 'issue', 'crash', 'slow', 'not working', 'fix', 'trouble', 'help'],
        content: `**Common Socrates Issues:**

**"Cannot connect to database":**
- Check that the SQL Server service is running (Services panel → SQL Server)
- Verify the server name in Socrates connection settings
- Restart the SQL Server service if needed
- If on a network, check network connectivity to the server

**Slow performance:**
- Check available disk space on the server
- Ensure the database is not excessively large (consider archiving old data)
- Check for Windows updates running in the background
- Restart Socrates and the server if it's been running for a long time

**Printing issues:**
- Check printer is set as default in Windows
- Verify paper size settings match your printer
- For prescription printing, check the template settings in Socrates

**Healthlink not receiving messages:**
- Check internet connectivity
- Verify Healthlink service is running
- Contact Healthlink support if messages are delayed (support@healthlink.ie)`
      },
      {
        id: 'soc_ad_hoc_reports',
        title: 'Ad-Hoc / Custom Reports',
        keywords: ['ad-hoc', 'custom', 'report', 'builder', 'query', 'data', 'export', 'csv', 'excel'],
        content: `**Ad-Hoc Reports in Socrates:**
- Socrates provides various pre-built report templates
- Reports can be exported to Word or Excel format
- For custom data extraction, use the Patient Finder with multiple filters

**Exporting Data:**
- Most reports have an "Export to Excel" button
- The Practice Distribution Breakdown can be saved as CSV
- Use Excel for further analysis of exported data

**Tips:**
- Combine Patient Finder filters for complex queries
- Save commonly used filter combinations for quick access`
      },
      {
        id: 'soc_practice_distribution',
        title: 'Practice Distribution Breakdown Report',
        keywords: ['practice', 'distribution', 'breakdown', 'panel', 'demographics', 'age', 'band', 'csv', 'export', 'aggregate'],
        content: `**Practice Distribution Breakdown in Socrates:**
This is a key report that shows aggregate patient counts by age band, patient type, and gender.

**How to run it:**
1. Go to Reports → Patients
2. Select "Practice Distribution Breakdown"
3. Click "Run Report" (default filters are fine)
4. The report shows a grid: Age bands (rows) × Patient types (columns: GMS, DVC, Private)
5. Each cell is broken down by Female/Male

**Exporting:**
1. Click Save → CSV File
2. Save to your computer
3. This CSV can be uploaded to Slainte Finance for the GMS Health Check

**What it contains:**
- No patient names or identifiers — just aggregate counts
- Age bands: Under 6, 06-09, 10-15, 16-24, 25-29, 30-34, etc. through 95+
- Patient types: GMS, DVC, Private
- Gender breakdown within each cell`
      }
    ]
  },

  practicemanager: {
    name: 'Helix Practice Manager',
    version: 'V3.6.6',
    topics: [
      {
        id: 'hpm_patient_reports',
        title: 'Patient Reports',
        keywords: ['patient', 'report', 'demographics', 'age', 'gender', 'GMS', 'list', 'filter'],
        content: `**Patient Reports in Helix Practice Manager (HPM):**
1. Go to Reports → Patient Reports
2. Filter by: Age, Gender, Patient Type (GMS/Private/DVC/EU), Clinician
3. Output: Individual patient records (not aggregate counts)
4. Export: Word (for printing) or Export to Excel

**Tips:**
- Patient Type field is available as a filter (GMS, Private, DVC, EU)
- Reports output patient lists — you'll need to count records manually or in Excel
- For aggregate demographic counts, use the Ad-Hoc Report Builder instead`
      },
      {
        id: 'hpm_diagnosis_reports',
        title: 'Diagnosis Reports',
        keywords: ['diagnosis', 'report', 'condition', 'disease', 'medical', 'history', 'search', 'ICPC', 'ICD'],
        content: `**Diagnosis Reports in HPM:**
1. Go to Reports → Diagnosis Reports
2. Search by condition name (coded under Medical History)
3. Filter by: Diagnosis date range, Age, Gender
4. Can search multiple conditions using "Show All" or "Show Any"
5. Export: Word or Export to Excel
6. The patient count is visible at the top of the results

**Medical History Coding:**
HPM uses BOTH coding systems:
- **ICPC-2** (International Classification of Primary Care)
- **ICD-10** (International Classification of Diseases)
- Conditions are stored under Medical History → Active (Acute/Chronic) or Inactive

**Key ICPC-2 Codes for CDM:**
- T90: Type 2 Diabetes
- R96: Asthma
- R95: COPD
- K77: Heart Failure
- K78: Atrial Fibrillation
- K74/K76: IHD
- K90: Stroke/TIA`
      },
      {
        id: 'hpm_drug_reports',
        title: 'Drug / Medication Reports',
        keywords: ['drug', 'medication', 'report', 'prescribing', 'prescription', 'search'],
        content: `**Drug Reports in HPM:**
1. Go to Reports → Drug Reports
2. Search by medication name (generic, brand, or wildcard)
3. Filter by: Date prescribed, Age, Gender
4. Export: Word or Excel
5. Useful for drug audits, recalls, and formulary reviews`
      },
      {
        id: 'hpm_report_builder',
        title: 'Ad-Hoc Report Builder',
        keywords: ['ad-hoc', 'report', 'builder', 'custom', 'query', 'SSRS', 'data', 'source', 'csv', 'excel', 'export'],
        content: `**Ad-Hoc Report Builder (Report Builder 3) in HPM:**
HPM includes a powerful drag-and-drop report builder powered by Microsoft Reporting Services (SSRS).

**How to access:**
1. Go to Reports → Ad-Hoc Reports
2. The Report Builder connects to database tables via "Data Source Properties"

**Available Data Modules:**
Accounts, Attendance, Consultations, Family Planning, Flu Vaccine, HeartWatch, Immunisations, Maternity, Medical Conditions, Medications, Patients, Recalls, Cervical Smears, Group Schema

**Export formats:** XML, CSV, TFF, PDF, Web, Excel

**Tips:**
- Standard ad-hoc reports are pre-built and categorised
- You can create custom reports with filters and grouping
- The CSV export makes this useful for data extraction
- "Test Connection" in Data Source Properties verifies database connectivity
- This is the most flexible reporting tool in HPM`
      },
      {
        id: 'hpm_cdm',
        title: 'CDM - Chronic Disease Management',
        keywords: ['cdm', 'chronic', 'disease', 'management', 'registration', 'review', 'care plan', 'programme'],
        content: `**CDM in HPM (requires v3.7.0.50+):**

**CDM Review Workflow:**
1. Open the patient file → Protocols → Chronic Disease Management
2. Click "Add Review"
3. Choose the programme: OCF (Opportunistic Case Finding), PP (Prevention Programme), or CDM Treatment
4. Complete the three phases: Registration → Review → Care Plan
5. Submit via Healthlink

**Finding CDM Patient Counts:**
- **Option A:** Reports → Diagnosis Report → search for the condition → count
- **Option B:** Tasks → Claim Tracker → Chronic Disease Tracker → filter by Status and Type
- The Claim Tracker shows unsent, incomplete, and rejected claims

**CDM Auto-Population:**
HPM automatically populates the diseases list from coded conditions in the patient's Medical History. Ensure conditions are properly coded using ICPC-2 or ICD-10.

**Programme Tiers:**
- CDM Treatment: 7 chronic diseases (Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA)
- Prevention Programme: High-risk patients
- OCF: Opportunistic screening`
      },
      {
        id: 'hpm_claim_tracker',
        title: 'Claim Tracker',
        keywords: ['claim', 'tracker', 'submit', 'unsent', 'incomplete', 'rejected', 'status', 'billing'],
        content: `**Claim Tracker in HPM:**
1. Go to Tasks → Claim Tracker → Chronic Disease Tracker
2. Filter by: Dates, Status, Type
3. View categories: Unsent, Incomplete, Rejected
4. You can submit multiple unsent claims in batch
5. Archive or delete old claims

**Claim Statuses:**
- **Unsent**: Ready but not yet transmitted
- **Incomplete**: Missing required fields
- **Rejected**: Returned by PCRS — check the rejection reason
- **Sent**: Successfully transmitted

**Tips:**
- Check the Claim Tracker regularly for incomplete or rejected claims
- Rejection reasons often indicate missing coding or patient registration issues
- Batch submission saves time when multiple claims are due`
      },
      {
        id: 'hpm_prescribing',
        title: 'Prescribing',
        keywords: ['prescribe', 'prescription', 'script', 'medication', 'drug', 'dose', 'repeat'],
        content: `**Prescribing in HPM:**
1. Open the patient file
2. Go to the Prescribing/Medications section
3. Search for the drug and select formulation
4. Enter dose, frequency, and quantity
5. Print or send electronically

**Repeat Prescriptions:**
- Set up from the Medications tab
- Batch printing available for repeat prescriptions due
- Review repeat medication lists regularly`
      },
      {
        id: 'hpm_medical_history',
        title: 'Medical History & Coding',
        keywords: ['medical', 'history', 'coding', 'ICPC', 'ICD', 'condition', 'diagnosis', 'active', 'inactive'],
        content: `**Medical History in HPM:**
HPM uses a dual coding system:
- **ICPC-2** (International Classification of Primary Care) — commonly used in Irish general practice
- **ICD-10** (International Classification of Diseases) — more detailed, used for hospital referrals

**Recording Conditions:**
1. Open the patient file → Medical History
2. Add a new condition → search by name or code
3. Set status: Active (Acute or Chronic) or Inactive
4. CDM programmes auto-populate from coded active conditions

**IPCRN Export Codes (for reference):**
- Diabetes: ICD-10 E10%, E11%, O24, O24.4, O24.9; ICPC-2 T89, T90, W85
- Dementia: ICD P70, F00*, F01*, G30*, F02*, F03, G31.8

**Tips:**
- Accurate coding is essential for CDM auto-population
- Review and clean up uncoded or incorrectly coded conditions periodically`
      },
      {
        id: 'hpm_pcrs_import',
        title: 'PCRS Import',
        keywords: ['PCRS', 'import', 'csv', 'panel', 'GMS', 'IHI', 'upload'],
        content: `**Importing PCRS Data into HPM:**
1. Download the CSV file from the PCRS website
2. In HPM, go to the import function
3. Select the PCRS CSV file
4. The system uploads IHI numbers to patient identifiers

**Tips:**
- Run this regularly to keep IHI numbers current
- Mismatched patients may need manual review`
      },
      {
        id: 'hpm_healthlink',
        title: 'Healthlink',
        keywords: ['healthlink', 'electronic', 'referral', 'lab', 'results', 'messaging'],
        content: `**Healthlink in HPM:**
Healthlink integration allows:
- Receiving lab results electronically
- Sending CDM claims and registrations
- Electronic referrals

**Setup:**
- Configured during HPM installation
- Requires Healthlink mailbox credentials
- Contact Clanwilliam or Healthlink support for setup issues

**Receiving Results:**
- Lab results arrive in the Incoming Messages area
- Review and file to the appropriate patient record`
      },
      {
        id: 'hpm_appointments',
        title: 'Appointments',
        keywords: ['appointment', 'schedule', 'book', 'diary', 'calendar', 'slot'],
        content: `**Appointments in HPM:**
- Access the appointment diary from the main menu
- View by day, week, or clinician
- Book by clicking a free slot and selecting a patient
- Configure appointment types and durations
- Recurring clinic slots can be set up for regular clinics`
      },
      {
        id: 'hpm_database',
        title: 'Database & Technical',
        keywords: ['database', 'sql', 'server', 'SSRS', 'connection', 'backup', 'technical', 'IT'],
        content: `**HPM Technical Architecture:**
- HPM uses Microsoft SQL Server as its database backend
- Reporting is powered by SQL Server Reporting Services (SSRS)
- The Report Builder connects via "Data Source Properties" with test connection capability

**Database Backup:**
- SQL Server databases should be backed up daily
- Use SQL Server Management Studio or automated scripts
- Store backups on a separate drive or network location
- Test restores periodically

**Connection Issues:**
- Check SQL Server service is running
- Verify connection strings in HPM settings
- Test database connectivity via Report Builder → Data Source Properties → Test Connection`
      },
      {
        id: 'hpm_common_errors',
        title: 'Common Issues & Troubleshooting',
        keywords: ['error', 'problem', 'issue', 'crash', 'slow', 'not working', 'fix', 'trouble', 'help'],
        content: `**Common HPM Issues:**

**"Cannot connect to database":**
- Check SQL Server service is running
- Verify the server name and instance in HPM settings
- Ensure network connectivity to the database server
- Try Test Connection in Report Builder → Data Source Properties

**Slow performance:**
- Check available disk space on the server
- Review database size — consider archiving old data
- Ensure regular database maintenance (index rebuilds, statistics updates)
- Check for Windows updates running in the background

**CDM claims not submitting:**
- Verify Healthlink is configured and connected
- Check all required fields are complete (use Claim Tracker → Incomplete)
- Ensure the patient has correct medical coding

**Reports not generating:**
- Verify SSRS is running
- Check data source connectivity
- Ensure you have appropriate user permissions`
      },
      {
        id: 'hpm_quick_guides',
        title: 'Quick Reference Guides',
        keywords: ['quick', 'guide', 'reference', 'how to', 'shortcut', 'navigation'],
        content: `**HPM Quick Navigation:**
- Reports: Main menu → Reports → [Report Type]
- Patient file: Search bar → type patient name → select
- CDM: Patient file → Protocols → Chronic Disease Management
- Claim Tracker: Tasks → Claim Tracker
- Appointments: Main menu → Appointments/Diary
- Ad-Hoc Reports: Reports → Ad-Hoc Reports → Report Builder

**Keyboard Shortcuts:**
- F1: Help
- Ctrl+F: Find/Search
- Refer to HPM Quick Guides document for full shortcut list`
      }
    ]
  },

  healthone: {
    name: 'HealthOne',
    version: 'Current',
    topics: [
      {
        id: 'ho_cdm_dashboard',
        title: 'CDM Dashboard',
        keywords: ['cdm', 'chronic', 'disease', 'dashboard', 'management', 'registration', 'review'],
        content: `**CDM Dashboard in HealthOne:**
HealthOne has a dedicated CDM Dashboard for managing Chronic Disease Management programmes.

**Accessing the CDM Dashboard:**
1. Open HealthOne
2. Navigate to CDM Dashboard (usually under Clinical or Programmes menu)
3. The dashboard shows patients registered for CDM, their review status, and pending actions

**Features:**
- View all CDM-registered patients
- Track review dates and overdue reviews
- Submit claims via Healthlink
- Filter by programme type (CDM Treatment, Prevention, OCF)

**CDM Treatment Programme conditions:**
- Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA`
      },
      {
        id: 'ho_database_analysis',
        title: 'Database Analysis Tool',
        keywords: ['database', 'analysis', 'query', 'search', 'data', 'extract', 'report'],
        content: `**Database Analysis in HealthOne:**
HealthOne includes a Database Analysis tool for querying patient data.

**How to use:**
1. Go to Tools → Database Analysis (or similar path)
2. Select the data you want to query (patients, conditions, medications)
3. Apply filters (age, gender, condition, medication)
4. Run the query
5. Results show individual patient records

**Limitations:**
- Outputs patient-level data (not aggregate counts)
- No direct CSV export from Database Analysis
- For aggregate counts, you'll need to export to Excel and count there
- The database uses a proprietary format, not standard SQL Server`
      },
      {
        id: 'ho_patient_management',
        title: 'Patient Management',
        keywords: ['patient', 'file', 'record', 'demographics', 'search', 'find'],
        content: `**Patient Management in HealthOne:**
- Search for patients using the search bar (by name, DOB, or chart number)
- Patient file contains: Demographics, Medical History, Medications, Lab Results, Letters, CDM
- Update patient details from the Demographics tab
- Patient type (GMS/Private/DVC) is recorded in the patient demographics`
      },
      {
        id: 'ho_prescribing',
        title: 'Prescribing',
        keywords: ['prescribe', 'prescription', 'script', 'medication', 'drug', 'dose', 'repeat'],
        content: `**Prescribing in HealthOne:**
1. Open the patient file
2. Go to the Prescribing section
3. Search for the medication
4. Enter dose, frequency, quantity
5. Print or send electronically

**Repeat Prescriptions:**
- Managed from the Prescribing module
- Batch repeat prescribing available
- Review repeat medications during consultations`
      },
      {
        id: 'ho_reports',
        title: 'Reports',
        keywords: ['report', 'export', 'print', 'list', 'data'],
        content: `**Reports in HealthOne:**
- HealthOne provides various built-in report templates
- Access from the Reports menu
- Filter by various criteria (date, age, condition, etc.)
- Export options vary by report type — some support Excel export
- Note: HealthOne does not have an equivalent of Socrates's Practice Distribution Breakdown CSV export

**For GMS Health Check data:**
- Use Database Analysis tool to query CDM conditions
- Count patients manually or export to Excel
- Demographic data requires individual patient type filtering`
      },
      {
        id: 'ho_healthlink',
        title: 'Healthlink',
        keywords: ['healthlink', 'electronic', 'referral', 'lab', 'results', 'messaging'],
        content: `**Healthlink in HealthOne:**
- Lab results arrive via Healthlink and appear in the Incoming Messages area
- CDM claims are submitted via Healthlink
- Electronic referrals can be sent to hospitals
- Configure Healthlink from the system settings or administration area`
      },
      {
        id: 'ho_configuration',
        title: 'Configuration & Settings',
        keywords: ['configuration', 'settings', 'setup', 'preferences', 'admin', 'administration'],
        content: `**HealthOne Configuration:**
- System settings are accessed from the Administration or Tools menu
- User management: Add/remove users, set permissions
- Practice details: Update practice name, address, GMS number
- Healthlink configuration: Mailbox settings, certificates
- Printing: Configure templates for prescriptions, referrals, letters

**Database:**
- HealthOne uses a proprietary database format
- Backup should be configured by your IT support
- Contact Clanwilliam for database-related issues`
      },
      {
        id: 'ho_common_errors',
        title: 'Common Issues & Troubleshooting',
        keywords: ['error', 'problem', 'issue', 'crash', 'slow', 'not working', 'fix', 'trouble', 'help'],
        content: `**Common HealthOne Issues:**

**Slow performance:**
- Check available disk space
- Ensure regular database maintenance
- Close unnecessary applications
- Check for Windows updates

**Lab results not appearing:**
- Verify Healthlink is connected
- Check Incoming Messages area
- Contact Healthlink support if results are delayed

**Printing issues:**
- Check default printer settings in Windows
- Verify template configuration in HealthOne settings
- Check paper size and orientation settings

**For technical support:**
- Contact Clanwilliam Health support
- Ensure you have your practice ID and software version ready`
      }
    ]
  },

  completegp: {
    name: 'CompleteGP',
    version: 'Current',
    topics: [
      {
        id: 'cgp_search',
        title: 'Search Tool',
        keywords: ['search', 'query', 'find', 'patient', 'list', 'filter', 'sophisticated'],
        content: `**CompleteGP Search Tool:**
CompleteGP features a "Sophisticated Search Tool" that allows complex patient searches.

**How to use:**
1. Access the Search Tool from the main menu
2. Build your search criteria using multiple filters
3. Search by: Condition (coded), Medication, Age, Gender, Patient type
4. Results can be exported
5. Supports coding systems: SNOMED, ICD-10, ICPC-2, LOINC

**Tips:**
- Use coding-based searches for the most accurate results
- The Search Tool is the primary data extraction method in CompleteGP
- Export results for further analysis in Excel`
      },
      {
        id: 'cgp_coding',
        title: 'Medical Coding',
        keywords: ['coding', 'SNOMED', 'ICD', 'ICPC', 'LOINC', 'diagnosis', 'condition'],
        content: `**Coding in CompleteGP:**
CompleteGP supports multiple coding systems:
- **SNOMED CT** — the most comprehensive clinical terminology
- **ICD-10** — International Classification of Diseases
- **ICPC-2** — International Classification of Primary Care
- **LOINC** — for laboratory and clinical observations

**CDM Conditions (ICPC-2 codes):**
- T90: Type 2 Diabetes
- R96: Asthma
- R95: COPD
- K77: Heart Failure
- K78: Atrial Fibrillation
- K74/K76: IHD
- K90: Stroke/TIA

**Tips:**
- Use the coding system most familiar to you
- Accurate coding enables better search results and CDM tracking
- SNOMED provides the most granular coding if needed`
      },
      {
        id: 'cgp_cdm',
        title: 'CDM - Chronic Disease Management',
        keywords: ['cdm', 'chronic', 'disease', 'management', 'programme', 'registration'],
        content: `**CDM in CompleteGP:**
- CDM is managed through the patient's clinical record
- Register patients for CDM programmes and record reviews
- Submit claims via Healthlink
- Use the Search Tool to find patients by CDM condition codes
- Track review dates and care plans within the patient file

**Finding CDM counts:**
- Use the Search Tool with relevant condition codes (ICPC-2 or ICD-10)
- Filter by patient type if needed (GMS/DVC for health check)
- Count results for each condition`
      },
      {
        id: 'cgp_general',
        title: 'General Navigation',
        keywords: ['navigate', 'menu', 'how to', 'get started', 'overview', 'interface'],
        content: `**CompleteGP General Information:**
- CompleteGP is an independent EHR system (not owned by Clanwilliam)
- It provides a modern interface for clinical record keeping
- Key areas: Patient file, Consultations, Prescribing, Reports, CDM, Search Tool
- Supports electronic prescribing and Healthlink messaging

**For specific navigation help:**
CompleteGP's documentation is not publicly available. For detailed guidance:
- Contact CompleteGP support directly
- Refer to any training materials provided during your software installation
- Ask your local IT support for system-specific questions`
      }
    ]
  },

  pippo: {
    name: 'Pippo Patient Portal',
    version: 'v0.2.2',
    topics: [
      {
        id: 'pippo_overview',
        title: 'Pippo Overview & Setup',
        keywords: ['pippo', 'patient portal', 'online booking', 'portal', 'app', 'clanwilliam', 'setup', 'register', 'install'],
        content: `**Pippo** is a patient portal by Clanwilliam Health that integrates with Socrates and Helix Practice Manager. It allows patients to book appointments online via the Pippo app or website.

**Key features:**
- Online appointment booking for patients
- Integrated with Socrates and HPM (appointments sync automatically)
- SMS and email confirmations/reminders
- Online payment via Billink
- Open Clinic scheduling for specific clinics (flu vaccines, COVID etc.)

**To get started:**
1. Register your practice for Pippo — contact Clanwilliam or click the registration link in your EHR
2. Once installed, accept the Pippo Terms & Conditions in your EHR system
3. If you don't accept T&Cs, you can only see practice details — no booking features
4. After accepting, your practice appears in the Pippo app/website for patients to find

**Requirements:**
- **Esendex account** — needed for SMS text messages (2FA, confirmations, reminders). Contact support@clanwilliamhealth.com if not set up
- **Billink account** — needed to receive online payments. Click the Billink icon in your EHR to activate (takes ~5 minutes)

**Support:** Email support@clanwilliamhealth.com for any Pippo queries.`
      },
      {
        id: 'pippo_dashboard',
        title: 'Pippo Dashboard & Settings',
        keywords: ['pippo', 'dashboard', 'settings', 'cancellation', 'patient type', 'GMS', 'private', 'esendex', 'billink', 'payment'],
        content: `**Pippo Dashboard:**
The Dashboard shows your practice details, contact details, Esendex account number, and Billink Key. It is read-only — to change practice details, edit them in your EHR system and they sync automatically.

**Pippo Settings:**
Go to the Settings tab to configure:
1. **Cancellation Policy** — set your cancellation terms for online bookings
2. **Patient Type** — choose GMS, Private, or Both
3. **Appointment Message** — custom text displayed to patients (e.g. emergency helpline numbers)
4. **Esendex Sender Name** — the name shown on SMS messages to patients
5. **Payment** — tick the checkbox to enable receiving payments from patients online
6. **Notifications** — configure whether to send Email, SMS, or both

**Your Team section:**
Shows all GPs, nurses, and healthcare professionals. These are pulled from your EHR system — to add or change staff, update them in Socrates/HPM and Pippo syncs automatically.`
      },
      {
        id: 'pippo_availability',
        title: 'Setting Up Appointment Availability in Pippo',
        keywords: ['pippo', 'availability', 'appointment', 'slots', 'time', 'schedule', 'booking', 'online', 'HCP', 'doctor'],
        content: `**Setting up which appointments patients can book online:**

Appointment types, durations, and charges are set within your EHR system and published to Pippo.

**To configure availability for an appointment type:**
1. Go to the **Availability** tab in the Pippo Portal
2. Find the appointment type (e.g. "General") — use the search bar if needed
3. Click the appointment type to highlight it, then click **Edit**
4. Set the **Charge Type** and enable email/SMS templates for confirmations
5. Toggle **Status** to enabled and click **Save**

**To add HCP availability for that appointment type:**
1. In the Availability section, click **Add**
2. Select the **days of the week**, the **HCP** (doctor/nurse), and the **time range**
3. Toggle **Status** to on (green) and click **Save**
4. The HCP is now bookable for that appointment type via the Pippo app

**Tips:**
- Use the **Clone** button to duplicate availability settings for other days/HCPs
- If today's date is selected, Pippo ignores it and starts from the next selected day
- Tick "Opt out for Dependants" if the appointment type shouldn't be available for dependant patients
- Use the **Notes** section to inform patients of requirements (e.g. "Please fast before blood test")`
      },
      {
        id: 'pippo_open_clinic',
        title: 'Pippo Open Clinic (Flu/COVID Vaccination Clinics)',
        keywords: ['pippo', 'open clinic', 'clinic', 'flu', 'vaccine', 'vaccination', 'covid', 'session', 'bulk'],
        content: `**Open Clinic** lets you create dedicated online booking slots for specific clinics (e.g. flu vaccines, COVID boosters).

**How it works:**
- Open Clinic appointments override standard availability for that HCP on the same day
- Each additional HCP assigned adds more bookable slots (e.g. 2 HCPs = 2 slots per time)
- We recommend creating a new appointment type in your EHR like "Open Clinic - Flu Vaccine"

**To create an Open Clinic:**
1. Go to **Open Clinic** tab and click **+Add**
2. Enter the clinic name and appointment description
3. Select the HCPs who will run the clinic
4. Toggle **Status** to green (live for patients)
5. Click **Save**

**To set availability for the clinic:**
1. Click the clinic, then click **Edit**
2. Under Availability, click **Add**
3. Select the days, date range, and time range
4. Enable status and click **Save**
5. Use **Clone** to duplicate settings for more dates

**Patient experience:**
Patients see the clinic slots in the Pippo app. After booking and paying, they are automatically assigned to an available HCP. The booking syncs to your EHR system and the patient gets a confirmation.`
      },
      {
        id: 'pippo_templates',
        title: 'Pippo Email & SMS Templates',
        keywords: ['pippo', 'template', 'email', 'SMS', 'text', 'notification', 'reminder', 'confirmation', 'message'],
        content: `All Pippo appointments automatically trigger an SMS confirmation. You can create custom templates:

**Email Templates:**
1. Go to **Email Template** from the side menu, click **Add**
2. Fill in:
   - **Title** — e.g. "New Appointment", "Review Appointment"
   - **Template Type** — choose from dropdown (Email Verification, Appointment, etc.)
   - **Placeholders** — insert dynamic fields: Patient Name, Consultant Name, Appointment Date, Appointment Time
   - **Subject** — the email subject line
3. Placeholders auto-fill in the Preview pane on the right
4. Toggle "Default" to make it the default email template
5. Click **Save**

**SMS Templates:**
1. Go to **SMS Template** from the side menu, click **Add**
2. Fill in **Title** and select **Placeholders**
3. Toggle "Default" for the default SMS template
4. Click **Save**

**Assigning templates to appointment types:**
When editing availability for an appointment type, choose the email and SMS templates from the dropdown lists.

To edit or delete templates, select the template and click Edit or Delete.`
      },
      {
        id: 'pippo_bookings_patients',
        title: 'Pippo Bookings & Patient Management',
        keywords: ['pippo', 'booking', 'patient', 'list', 'registration', 'accepted', 'declined', 'mismatch', 'view'],
        content: `**Bookings tab:**
View available and booked slots for each HCP by appointment type:
1. Select a GP and appointment type from the lists
2. The calendar shows slots — booked appointments appear in green
3. Use the arrows at the top to navigate between weeks

**Patient List tab:**
View all patient registrations:

**Accepted tab:**
- Shows fully registered Pippo patients
- Search by first name, surname, or mobile number
- Double-click a record to view registration details

**Declined tab:**
- Shows patients who failed to register (usually due to detail mismatch)
- If patient details don't match your EHR records, update the details in Socrates/HPM
- You can send a pre-registration link to patients' emails from your EHR
- Patient clicks the link, confirms mobile via OTP, agrees to T&Cs, and registers
- Once successfully registered, click **Complete** to remove from the Declined list

**Common issue:** If a patient is in the Declined list, it usually means their name, date of birth, or mobile number doesn't match what's in your EHR. Update the patient record in Socrates/HPM first, then ask them to re-register.`
      }
    ]
  },

  general: {
    name: 'General GP IT',
    version: 'Current',
    topics: [
      {
        id: 'gen_pcrs_website',
        title: 'PCRS Website Navigation',
        keywords: ['PCRS', 'website', 'portal', 'login', 'panel', 'download', 'claims', 'payments'],
        content: `**PCRS Website (pcrs.ie):**
The Primary Care Reimbursement Service (PCRS) website is used for:
- Viewing your GMS panel
- Downloading panel files
- Checking claim status
- Viewing payment statements

**Common Tasks:**
1. **Download panel file:** Log in → GMS → Panel → Export/Download
2. **Check payments:** Log in → Payments → View statements
3. **View claims:** Log in → Claims → Search by date/type

**Login Issues:**
- Use your practice's PCRS credentials
- If locked out, contact PCRS helpdesk: 1890 252 919
- Passwords expire periodically — check if a reset is needed`
      },
      {
        id: 'gen_healthlink_setup',
        title: 'Healthlink Setup & Troubleshooting',
        keywords: ['healthlink', 'setup', 'install', 'configure', 'certificate', 'mailbox', 'not working'],
        content: `**Healthlink Overview:**
Healthlink is Ireland's national health messaging service for electronic communication between healthcare providers.

**Used for:**
- Receiving lab results
- Sending electronic referrals
- CDM claim submissions
- Discharge summaries

**Setup Requirements:**
- Healthlink mailbox ID (assigned by Healthlink)
- Digital certificates (installed on your computer)
- Configuration within your EHR system
- Internet connectivity

**Troubleshooting:**
- **No messages arriving:** Check internet connection, verify Healthlink service is running, contact support@healthlink.ie
- **Certificate expired:** Contact Healthlink for certificate renewal
- **Messages delayed:** Can happen during peak times; check Healthlink status page`
      },
      {
        id: 'gen_gms_claims',
        title: 'GMS Claim Submission',
        keywords: ['GMS', 'claim', 'submit', 'submission', 'payment', 'reimbursement', 'reject', 'rejection'],
        content: `**GMS Claim Submission:**
GMS claims are submitted electronically via Healthlink from your EHR system.

**Common Claim Types:**
- Capitation claims (automatic based on panel)
- CDM claims (per review/registration)
- Special Items of Service
- Out-of-hours claims

**If a claim is rejected:**
1. Check the rejection reason in your EHR's claim tracker
2. Common reasons: Patient not on panel, incorrect coding, duplicate claim, missing data
3. Correct the issue and resubmit
4. If unclear, contact PCRS helpdesk

**Tips:**
- Submit claims promptly — there are time limits
- Check your claim tracker regularly for rejected claims
- Keep patient GMS eligibility up to date by importing PCRS panel files`
      },
      {
        id: 'gen_cervicalcheck',
        title: 'CervicalCheck Programme',
        keywords: ['cervical', 'check', 'screening', 'smear', 'HPV', 'women', 'cervicalcheck'],
        content: `**CervicalCheck (National Cervical Screening Programme):**

**Eligibility:**
- Women aged 25-65 registered with CervicalCheck
- Free screening every 3 years (age 25-29) or 5 years (age 30-65)
- HPV testing is now the primary screening method

**In your EHR:**
- Record results in the Cervical Screening section of the patient file
- Use reports to identify women due for screening
- Flag overdue patients for recall

**For GMS Health Check:**
- Eligible women 25-44 and 45-65 are separate categories
- Use your EHR's patient reports filtered by age and gender to get counts`
      },
      {
        id: 'gen_backup_basics',
        title: 'Backup & IT Basics',
        keywords: ['backup', 'restore', 'IT', 'basic', 'computer', 'network', 'server', 'security'],
        content: `**Essential IT Practices for GP Surgeries:**

**Backups:**
- Your EHR database should be backed up DAILY
- Store backups on a separate drive AND offsite (cloud or external)
- Test restores periodically — a backup that can't be restored is useless
- Keep at least 7 days of rolling backups

**Security:**
- Keep Windows and your EHR software up to date
- Use strong passwords and change them regularly
- Enable screen lock on all computers
- Don't share login credentials between staff
- Be cautious with email attachments (ransomware risk)

**Network:**
- Ensure reliable internet for Healthlink and PCRS
- Use a business-grade router, not a domestic one
- Consider a backup internet connection (e.g., 4G failover)

**When to Call IT Support:**
- Database connection errors
- Persistent slow performance
- Any suspected security breach
- Hardware failures (server, printers, network equipment)`
      },
      {
        id: 'gen_printing',
        title: 'Printing Issues',
        keywords: ['print', 'printer', 'paper', 'prescription', 'template', 'not printing'],
        content: `**Common Printing Issues in GP Practices:**

**Prescriptions not printing correctly:**
1. Check the default printer in Windows (Settings → Printers & Scanners)
2. Verify paper size matches your prescription paper (usually A5 or custom)
3. Check template settings in your EHR's print configuration
4. Try a test print from another application (e.g., Notepad) to rule out EHR issues

**General printing troubleshooting:**
1. Check the printer is powered on and connected
2. Clear the print queue (Windows → Printers → See what's printing → Cancel all)
3. Restart the print spooler service (Services → Print Spooler → Restart)
4. Check for paper jams or low toner
5. Reinstall the printer driver if issues persist`
      },
      {
        id: 'gen_windows_basics',
        title: 'Windows Basics for Practice Staff',
        keywords: ['windows', 'restart', 'update', 'slow', 'disk', 'space', 'memory'],
        content: `**Windows Tips for Practice Computers:**

**Computer is slow:**
1. Restart the computer (fixes most issues)
2. Check disk space: Settings → System → Storage (need >10% free)
3. Close unnecessary programs (Ctrl+Alt+Del → Task Manager)
4. Check for Windows updates running in the background

**Windows Updates:**
- Updates should be installed regularly for security
- Schedule updates for after hours to avoid disruption
- If an update causes issues, contact your IT support

**Disk Space:**
- Delete old downloads and temporary files
- Use Disk Cleanup (search "Disk Cleanup" in Start menu)
- Move old documents to external storage`
      }
    ]
  }
};
