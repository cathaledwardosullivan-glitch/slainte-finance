import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, User, MessageCircle, CheckCircle, ArrowRight, AlertCircle, Loader, Table, Tag, SkipForward } from 'lucide-react';
import COLORS from '../../utils/colors';
import Papa from 'papaparse';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function LabelledTransactionImport({ onComplete, onSwitchToRaw, onSkip }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    date: '',
    description: '',
    amount: '',
    debit: '',
    credit: '',
    category: '' // User's existing category label column
  });
  const [step, setStep] = useState('upload'); // upload, map-columns, preview

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const greetingText = "I see you have pre-categorized data!";
  const messageText = "Upload your labelled transactions and I'll map your categories to Sláinte's system. This helps me learn your existing accounting patterns faster.";
  const tipText = "Your CSV should have a column with your category labels - like 'Category', 'Type', or 'Classification'. I'll help you identify which column it is.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);
  const { displayedText: tip, isComplete: tipComplete } = useTypingEffect(showTip ? tipText : '', 15);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setShowGreeting(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowTip(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    const fileName = selectedFile.name.toLowerCase();
    const isValid = fileName.endsWith('.csv');

    if (!isValid) {
      setParseError('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);
    setParseError(null);

    // Parse the CSV to detect columns
    Papa.parse(selectedFile, {
      header: true,
      preview: 10, // Just preview first 10 rows
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError('Error parsing CSV: ' + results.errors[0].message);
          return;
        }

        if (results.data.length === 0) {
          setParseError('CSV file appears to be empty');
          return;
        }

        const detectedColumns = results.meta.fields || [];
        setColumns(detectedColumns);
        setParsedData(results.data);

        // Auto-detect common column names
        const autoMapping = { ...columnMapping };

        detectedColumns.forEach(col => {
          const lowerCol = col.toLowerCase();

          // Date detection
          if (!autoMapping.date && (lowerCol.includes('date') || lowerCol === 'posted')) {
            autoMapping.date = col;
          }

          // Description detection
          if (!autoMapping.description && (
            lowerCol.includes('description') ||
            lowerCol.includes('details') ||
            lowerCol.includes('narrative') ||
            lowerCol.includes('memo') ||
            lowerCol.includes('payee')
          )) {
            autoMapping.description = col;
          }

          // Amount detection (single column)
          if (!autoMapping.amount && (
            lowerCol === 'amount' ||
            lowerCol.includes('value')
          )) {
            autoMapping.amount = col;
          }

          // Debit detection
          if (!autoMapping.debit && (
            lowerCol === 'debit' ||
            lowerCol.includes('withdrawal') ||
            lowerCol.includes('out')
          )) {
            autoMapping.debit = col;
          }

          // Credit detection
          if (!autoMapping.credit && (
            lowerCol === 'credit' ||
            lowerCol.includes('deposit') ||
            lowerCol.includes('in')
          )) {
            autoMapping.credit = col;
          }

          // Category detection - the key field for labelled imports
          if (!autoMapping.category && (
            lowerCol === 'category' ||
            lowerCol.includes('categor') ||
            lowerCol === 'type' ||
            lowerCol.includes('class') ||
            lowerCol.includes('account') ||
            lowerCol.includes('label') ||
            lowerCol === 'code'
          )) {
            autoMapping.category = col;
          }
        });

        setColumnMapping(autoMapping);
        setStep('map-columns');
      },
      error: (error) => {
        setParseError('Error reading file: ' + error.message);
      }
    });
  };

  const handleColumnMappingChange = (field, value) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isValidMapping = () => {
    // Must have date, description, category, and either amount OR (debit and credit)
    const hasDate = !!columnMapping.date;
    const hasDescription = !!columnMapping.description;
    const hasCategory = !!columnMapping.category;
    const hasAmount = !!columnMapping.amount || (!!columnMapping.debit || !!columnMapping.credit);

    return hasDate && hasDescription && hasCategory && hasAmount;
  };

  const handleContinue = () => {
    if (step === 'map-columns') {
      setStep('preview');
    } else if (step === 'preview') {
      // Parse full file with mapping and pass to next step
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const mappedTransactions = results.data
            .filter(row => row[columnMapping.description]) // Filter empty rows
            .map(row => {
              let amount = 0;
              if (columnMapping.amount) {
                amount = parseFloat(String(row[columnMapping.amount]).replace(/[€$£,]/g, '')) || 0;
              } else {
                const debit = parseFloat(String(row[columnMapping.debit] || '0').replace(/[€$£,]/g, '')) || 0;
                const credit = parseFloat(String(row[columnMapping.credit] || '0').replace(/[€$£,]/g, '')) || 0;
                amount = credit - debit;
              }

              return {
                date: row[columnMapping.date] || '',
                description: row[columnMapping.description] || '',
                amount: amount,
                userCategory: row[columnMapping.category] || '',
                rawRow: row
              };
            });

          // Extract unique user categories
          const userCategories = [...new Set(
            mappedTransactions
              .map(t => t.userCategory)
              .filter(c => c && c.trim() !== '')
          )].sort();

          onComplete({
            transactions: mappedTransactions,
            userCategories: userCategories,
            columnMapping: columnMapping,
            fileName: file.name
          });
        }
      });
    }
  };

  // Get sample values for a column
  const getSampleValues = (columnName) => {
    if (!parsedData || !columnName) return [];
    return parsedData
      .slice(0, 3)
      .map(row => row[columnName])
      .filter(v => v !== undefined && v !== null && v !== '');
  };

  // Count unique category values
  const getUniqueCategoryCount = () => {
    if (!parsedData || !columnMapping.category) return 0;
    const unique = new Set(parsedData.map(row => row[columnMapping.category]).filter(Boolean));
    return unique.size;
  };

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(75vh, 700px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
        height: '100%',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.lightGray}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Chat Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            backgroundColor: COLORS.slainteBlueDark,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User style={{ height: '1.25rem', width: '1.25rem' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div style={{
          padding: '1.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          {/* Greeting */}
          {showGreeting && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: COLORS.darkGray
                }}>
                  {greeting}
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          {showMessage && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '0.9375rem',
                  color: COLORS.darkGray,
                  lineHeight: 1.5
                }}>
                  {message}
                </div>
              </div>
            </div>
          )}

          {/* Tip */}
          {showTip && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: COLORS.darkGray,
                  lineHeight: 1.5
                }}>
                  {tip}
                </div>
              </div>
            </div>
          )}

          {/* File selected message */}
          {file && step === 'map-columns' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  Found {columns.length} columns. Now tell me which column has your category labels!
                </div>
              </div>
            </div>
          )}

          {/* Category column identified */}
          {columnMapping.category && step === 'map-columns' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <Tag style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  Found {getUniqueCategoryCount()} unique category labels in "{columnMapping.category}"!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Option to switch to raw import */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.lightGray}`,
          backgroundColor: COLORS.backgroundGray
        }}>
          <p style={{ fontSize: '0.8125rem', color: COLORS.mediumGray, textAlign: 'center', marginBottom: '0.5rem' }}>
            Don't have pre-labelled data?
          </p>
          <button
            onClick={onSwitchToRaw}
            style={{
              width: '100%',
              padding: '0.625rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: COLORS.slainteBlue,
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.slainteBlue}`,
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Upload Raw Transactions Instead
          </button>
        </div>
      </div>

      {/* Right side - Upload/Mapping Card */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '500px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        opacity: messageComplete ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: messageComplete ? 'auto' : 'none',
        overflowY: 'auto'
      }}>
        {/* Upload Step */}
        {step === 'upload' && (
          <div style={{
            backgroundColor: COLORS.white,
            border: `3px solid ${COLORS.slainteBlue}`,
            borderRadius: '16px',
            padding: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: `${COLORS.slainteBlue}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileSpreadsheet style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: COLORS.darkGray,
                  marginBottom: '0.5rem'
                }}>
                  Upload Labelled Transactions
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: COLORS.mediumGray,
                  lineHeight: 1.6
                }}>
                  Upload a CSV that includes your existing category labels.
                </p>
              </div>
            </div>

            {/* Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? COLORS.slainteBlue : parseError ? COLORS.expenseColor : COLORS.lightGray}`,
                borderRadius: '12px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                marginBottom: '1rem',
                backgroundColor: dragActive ? `${COLORS.slainteBlue}05` : COLORS.backgroundGray,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => document.getElementById('labelled-file-upload').click()}
            >
              <input
                id="labelled-file-upload"
                type="file"
                accept=".csv"
                onChange={handleChange}
                style={{ display: 'none' }}
              />

              <Upload style={{ width: '40px', height: '40px', color: COLORS.mediumGray, margin: '0 auto 0.75rem' }} />
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.darkGray,
                marginBottom: '0.375rem'
              }}>
                Drop your CSV file here
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.mediumGray
              }}>
                or click to browse
              </p>
            </div>

            {parseError && (
              <div style={{
                backgroundColor: `${COLORS.expenseColor}10`,
                border: `1px solid ${COLORS.expenseColor}`,
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle style={{ width: '18px', height: '18px', color: COLORS.expenseColor }} />
                <p style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>{parseError}</p>
              </div>
            )}

            {/* Skip option */}
            <div style={{
              textAlign: 'center',
              paddingTop: '1.5rem',
              borderTop: `1px solid ${COLORS.lightGray}`,
              marginTop: '1rem'
            }}>
              <button
                onClick={onSkip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${COLORS.lightGray}`,
                  color: COLORS.mediumGray,
                  backgroundColor: 'transparent'
                }}
              >
                <SkipForward style={{ width: '16px', height: '16px' }} />
                Skip for Now
              </button>
            </div>
          </div>
        )}

        {/* Column Mapping Step */}
        {step === 'map-columns' && (
          <div style={{
            backgroundColor: COLORS.white,
            border: `3px solid ${COLORS.slainteBlue}`,
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: `${COLORS.slainteBlue}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Table style={{ width: '20px', height: '20px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: COLORS.darkGray,
                  marginBottom: '0.25rem'
                }}>
                  Map Your Columns
                </h3>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                  {file.name} • {columns.length} columns detected
                </p>
              </div>
            </div>

            {/* Column mapping fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                  Date Column *
                </label>
                <select
                  value={columnMapping.date}
                  onChange={(e) => handleColumnMappingChange('date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    fontSize: '0.875rem',
                    border: `1px solid ${columnMapping.date ? COLORS.incomeColor : COLORS.lightGray}`,
                    borderRadius: '6px',
                    backgroundColor: COLORS.white
                  }}
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                {columnMapping.date && (
                  <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                    Sample: {getSampleValues(columnMapping.date).join(', ')}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                  Description Column *
                </label>
                <select
                  value={columnMapping.description}
                  onChange={(e) => handleColumnMappingChange('description', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    fontSize: '0.875rem',
                    border: `1px solid ${columnMapping.description ? COLORS.incomeColor : COLORS.lightGray}`,
                    borderRadius: '6px',
                    backgroundColor: COLORS.white
                  }}
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                {columnMapping.description && (
                  <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                    Sample: {getSampleValues(columnMapping.description).slice(0, 2).join('; ')}
                  </p>
                )}
              </div>

              {/* Amount / Debit+Credit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                    Amount
                  </label>
                  <select
                    value={columnMapping.amount}
                    onChange={(e) => handleColumnMappingChange('amount', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      fontSize: '0.875rem',
                      border: `1px solid ${columnMapping.amount ? COLORS.incomeColor : COLORS.lightGray}`,
                      borderRadius: '6px',
                      backgroundColor: COLORS.white
                    }}
                  >
                    <option value="">Select...</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                    OR Debit
                  </label>
                  <select
                    value={columnMapping.debit}
                    onChange={(e) => handleColumnMappingChange('debit', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      fontSize: '0.875rem',
                      border: `1px solid ${columnMapping.debit ? COLORS.incomeColor : COLORS.lightGray}`,
                      borderRadius: '6px',
                      backgroundColor: COLORS.white
                    }}
                  >
                    <option value="">Select...</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                    Credit
                  </label>
                  <select
                    value={columnMapping.credit}
                    onChange={(e) => handleColumnMappingChange('credit', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      fontSize: '0.875rem',
                      border: `1px solid ${columnMapping.credit ? COLORS.incomeColor : COLORS.lightGray}`,
                      borderRadius: '6px',
                      backgroundColor: COLORS.white
                    }}
                  >
                    <option value="">Select...</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category - THE KEY FIELD */}
              <div style={{
                backgroundColor: `${COLORS.highlightYellow}15`,
                border: `2px solid ${COLORS.highlightYellow}`,
                borderRadius: '10px',
                padding: '1rem'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
                  <Tag style={{ width: '16px', height: '16px', color: COLORS.highlightYellow }} />
                  Your Category Labels Column *
                </label>
                <select
                  value={columnMapping.category}
                  onChange={(e) => handleColumnMappingChange('category', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                    border: `2px solid ${columnMapping.category ? COLORS.incomeColor : COLORS.highlightYellow}`,
                    borderRadius: '8px',
                    backgroundColor: COLORS.white
                  }}
                >
                  <option value="">Select the column with your category labels...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                {columnMapping.category && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray }}>
                      Found <strong>{getUniqueCategoryCount()}</strong> unique categories
                    </p>
                    <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                      Samples: {getSampleValues(columnMapping.category).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={handleContinue}
              disabled={!isValidMapping()}
              style={{
                width: '100%',
                marginTop: '1.25rem',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: isValidMapping() ? COLORS.incomeColor : COLORS.mediumGray,
                border: 'none',
                borderRadius: '8px',
                cursor: isValidMapping() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              Preview & Continue
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div style={{
            backgroundColor: COLORS.white,
            border: `3px solid ${COLORS.slainteBlue}`,
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: `${COLORS.incomeColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: COLORS.incomeColor }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: COLORS.darkGray,
                  marginBottom: '0.25rem'
                }}>
                  Preview Your Data
                </h3>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                  Here's how your data will be imported
                </p>
              </div>
            </div>

            {/* Preview table */}
            <div style={{
              overflowX: 'auto',
              marginBottom: '1.25rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: COLORS.backgroundGray }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: COLORS.darkGray, borderBottom: `1px solid ${COLORS.lightGray}` }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: COLORS.darkGray, borderBottom: `1px solid ${COLORS.lightGray}` }}>Description</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: COLORS.darkGray, borderBottom: `1px solid ${COLORS.lightGray}` }}>Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: COLORS.highlightYellow, borderBottom: `1px solid ${COLORS.lightGray}` }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Tag style={{ width: '14px', height: '14px' }} />
                        Category
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, idx) => {
                    let amount = 0;
                    if (columnMapping.amount) {
                      amount = parseFloat(String(row[columnMapping.amount]).replace(/[€$£,]/g, '')) || 0;
                    } else {
                      const debit = parseFloat(String(row[columnMapping.debit] || '0').replace(/[€$£,]/g, '')) || 0;
                      const credit = parseFloat(String(row[columnMapping.credit] || '0').replace(/[€$£,]/g, '')) || 0;
                      amount = credit - debit;
                    }

                    return (
                      <tr key={idx} style={{ borderBottom: idx < 4 ? `1px solid ${COLORS.lightGray}` : 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem', color: COLORS.darkGray }}>
                          {row[columnMapping.date]}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', color: COLORS.darkGray, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[columnMapping.description]}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', color: amount >= 0 ? COLORS.incomeColor : COLORS.expenseColor, fontWeight: 500 }}>
                          €{Math.abs(amount).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: `${COLORS.highlightYellow}20`,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: COLORS.darkGray
                          }}>
                            {row[columnMapping.category] || '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{
              backgroundColor: COLORS.backgroundGray,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                Ready to import <strong>{parsedData.length}</strong> transactions with <strong>{getUniqueCategoryCount()}</strong> unique category labels.
              </p>
              <p style={{ fontSize: '0.8125rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                Next: I'll map your categories to Sláinte's system.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setStep('map-columns')}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: COLORS.mediumGray,
                  backgroundColor: COLORS.white,
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                onClick={handleContinue}
                style={{
                  flex: 2,
                  padding: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: COLORS.incomeColor,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                Continue to Category Mapping
                <ArrowRight style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
