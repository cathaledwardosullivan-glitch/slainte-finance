import React, { useState, useEffect, useRef } from 'react';
import { TOUR_STEPS } from './Tour/tourSteps';
import { COLORS } from '../utils/colors';
import {
  Printer,
  X,
  Camera,
  Home,
  FileText,
  CreditCard,
  MessageSquare,
  PieChart,
  Activity,
  Settings,
  HelpCircle
} from 'lucide-react';

// Map page names to icons
const pageIcons = {
  'dashboard': Home,
  'export': FileText,
  'transactions': CreditCard,
  'chat': MessageSquare,
  'gms-panel': PieChart,
  'gms-health-check': Activity,
  'admin': Settings,
};

// Group steps by section for better organization
const groupStepsBySection = (steps) => {
  const sections = [
    { name: 'Welcome', steps: steps.filter(s => s.id === 'welcome') },
    { name: 'Navigation', steps: steps.filter(s => s.id === 'navigation') },
    { name: 'Finances - Home', steps: steps.filter(s => ['summary-cards', 'charts-section', 'action-plans'].includes(s.id)) },
    { name: 'Reports', steps: steps.filter(s => ['reports', 'report-types'].includes(s.id)) },
    { name: 'Transactions', steps: steps.filter(s => ['transaction-table', 'repeating-transactions'].includes(s.id)) },
    { name: 'Financial Consultation', steps: steps.filter(s => s.id === 'financial-consultation') },
    { name: 'GMS Overview', steps: steps.filter(s => ['gms-overview', 'gms-action-plan'].includes(s.id)) },
    { name: 'GMS Health Check', steps: steps.filter(s => s.id.startsWith('gms-health-check') || s.id.startsWith('hc-')) },
    { name: 'Admin Settings', steps: steps.filter(s => s.id === 'admin-settings') },
    { name: 'Getting Help', steps: steps.filter(s => ['meet-cara', 'complete'].includes(s.id)) },
  ];
  return sections.filter(s => s.steps.length > 0);
};

const PrintableGuide = ({ onClose }) => {
  const [imageErrors, setImageErrors] = useState({});
  const sections = groupStepsBySection(TOUR_STEPS);
  const contentRef = useRef(null);

  const handleImageError = (stepIndex) => {
    setImageErrors(prev => ({ ...prev, [stepIndex]: true }));
  };

  // Get the global step number
  const getStepNumber = (stepId) => {
    return TOUR_STEPS.findIndex(s => s.id === stepId) + 1;
  };

  // Open print in new window for clean PDF generation
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the guide');
      return;
    }

    const content = contentRef.current;
    if (!content) return;

    // Build the HTML for the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sláinte Finance - User Guide</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: white;
            color: #1a1a1a;
            line-height: 1.6;
          }

          .guide-header {
            text-align: center;
            padding: 60px 40px;
            border-bottom: 3px solid ${COLORS.slainteBlue};
            margin-bottom: 40px;
          }

          .guide-title {
            font-size: 36px;
            font-weight: 700;
            color: ${COLORS.slainteBlue};
            margin: 0 0 8px 0;
          }

          .guide-subtitle {
            font-size: 20px;
            color: #6b7280;
            margin: 0;
          }

          .guide-version {
            font-size: 14px;
            color: #6b7280;
            margin-top: 16px;
          }

          .toc {
            background: #f8f9fa;
            padding: 24px 32px;
            border-radius: 8px;
            margin-bottom: 40px;
            page-break-after: always;
          }

          .toc h2 {
            font-size: 20px;
            margin: 0 0 16px 0;
            color: #374151;
          }

          .toc-list {
            list-style: none;
            padding: 0;
            margin: 0;
            columns: 2;
            column-gap: 32px;
          }

          .toc-item {
            padding: 4px 0;
            font-size: 15px;
            color: #374151;
          }

          .toc-item span {
            color: ${COLORS.slainteBlue};
            font-weight: 600;
            margin-right: 8px;
          }

          .section {
            margin-bottom: 48px;
            page-break-before: always;
          }

          .section:first-of-type {
            page-break-before: avoid;
          }

          .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 24px;
            background: ${COLORS.slainteBlue};
            color: white;
            border-radius: 8px 8px 0 0;
            margin-bottom: 0;
          }

          .section-header h2 {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
          }

          .section-header svg {
            flex-shrink: 0;
          }

          .section-content {
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 8px 8px;
            padding: 24px;
          }

          .step {
            margin-bottom: 32px;
            padding-bottom: 32px;
            border-bottom: 1px solid #e5e7eb;
            page-break-inside: avoid;
          }

          .step:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }

          .step-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }

          .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${COLORS.slainteBlue};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            flex-shrink: 0;
          }

          .step-title {
            font-size: 20px;
            font-weight: 600;
            color: #374151;
            margin: 0;
          }

          .screenshot-container {
            margin: 16px 0;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: #f8fafc;
            overflow: hidden;
          }

          .screenshot-placeholder {
            aspect-ratio: 16/9;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            text-align: center;
            color: #94a3b8;
          }

          .screenshot-placeholder-text {
            font-size: 14px;
            margin: 8px 0 0 0;
          }

          .screenshot-image {
            width: 100%;
            height: auto;
            display: block;
          }

          .cara-explanation {
            background: linear-gradient(135deg, #f0f7ff 0%, #f8fafc 100%);
            border-left: 4px solid ${COLORS.slainteBlue};
            padding: 16px 20px;
            border-radius: 0 8px 8px 0;
            margin-top: 16px;
          }

          .cara-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 600;
            color: ${COLORS.slainteBlue};
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
          }

          .cara-text {
            color: #374151;
            font-size: 15px;
            margin: 0;
            font-style: italic;
          }

          .guide-footer {
            text-align: center;
            padding: 32px;
            border-top: 1px solid #e5e7eb;
            margin-top: 32px;
            color: #6b7280;
            font-size: 14px;
          }

          @media print {
            body {
              padding: 0;
            }
            @page {
              margin: 1.5cm;
              size: A4;
            }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Render icon as SVG string for print window
  const renderIcon = (IconComponent, size = 24) => {
    return <IconComponent size={size} />;
  };

  return (
    <div style={{
      background: 'white',
      minHeight: '100vh',
      padding: '0',
    }}>
      {/* Toolbar - fixed at top */}
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        display: 'flex',
        gap: '8px',
        zIndex: 1000,
      }}>
        <button
          onClick={handlePrint}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            background: COLORS.slainteBlue,
            color: 'white',
          }}
        >
          <Printer size={18} />
          Print / Save PDF
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              background: 'white',
              color: COLORS.darkGray,
              border: '1px solid #e5e7eb',
            }}
          >
            <X size={18} />
            Close
          </button>
        )}
      </div>

      {/* Printable Content */}
      <div
        ref={contentRef}
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '40px',
        }}
      >
        {/* Header / Title Page */}
        <div className="guide-header" style={{
          textAlign: 'center',
          padding: '60px 40px',
          borderBottom: `3px solid ${COLORS.slainteBlue}`,
          marginBottom: '40px',
        }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 700,
            color: COLORS.slainteBlue,
            margin: '0 0 8px 0',
          }}>Sláinte Finance</h1>
          <p style={{
            fontSize: '20px',
            color: '#6b7280',
            margin: 0,
          }}>User Guide</p>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            marginTop: '16px',
          }}>Version 2.0 • {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Table of Contents */}
        <div className="toc" style={{
          background: '#f8f9fa',
          padding: '24px 32px',
          borderRadius: '8px',
          marginBottom: '40px',
        }}>
          <h2 style={{
            fontSize: '20px',
            margin: '0 0 16px 0',
            color: '#374151',
          }}>Contents</h2>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            columns: 2,
            columnGap: '32px',
          }}>
            {sections.map((section, idx) => (
              <li key={idx} style={{
                padding: '4px 0',
                fontSize: '15px',
                color: '#374151',
              }}>
                <span style={{
                  color: COLORS.slainteBlue,
                  fontWeight: 600,
                  marginRight: '8px',
                }}>{idx + 1}.</span>
                {section.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Guide Content */}
        {sections.map((section, sectionIdx) => {
          const IconComponent = pageIcons[section.steps[0]?.page] || HelpCircle;

          return (
            <div key={sectionIdx} className="section" style={{
              marginBottom: '48px',
            }}>
              <div className="section-header" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 24px',
                background: COLORS.slainteBlue,
                color: 'white',
                borderRadius: '8px 8px 0 0',
              }}>
                {renderIcon(IconComponent, 24)}
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  margin: 0,
                }}>{section.name}</h2>
              </div>
              <div className="section-content" style={{
                border: '1px solid #e5e7eb',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                padding: '24px',
              }}>
                {section.steps.map((step, stepIdx) => {
                  const stepNumber = getStepNumber(step.id);
                  const screenshotPath = `/guide-screenshots/step-${stepNumber}.png`;
                  const hasError = imageErrors[stepNumber];

                  return (
                    <div key={step.id} className="step" style={{
                      marginBottom: stepIdx < section.steps.length - 1 ? '32px' : 0,
                      paddingBottom: stepIdx < section.steps.length - 1 ? '32px' : 0,
                      borderBottom: stepIdx < section.steps.length - 1 ? '1px solid #e5e7eb' : 'none',
                    }}>
                      <div className="step-header" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '16px',
                      }}>
                        <div className="step-number" style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: COLORS.slainteBlue,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '14px',
                          flexShrink: 0,
                        }}>{stepNumber}</div>
                        <h3 className="step-title" style={{
                          fontSize: '20px',
                          fontWeight: 600,
                          color: '#374151',
                          margin: 0,
                        }}>{step.title}</h3>
                      </div>

                      {/* Screenshot or Placeholder */}
                      <div className="screenshot-container" style={{
                        margin: '16px 0',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        overflow: 'hidden',
                      }}>
                        {hasError ? (
                          <div className="screenshot-placeholder" style={{
                            aspectRatio: '16/9',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '32px',
                            textAlign: 'center',
                            color: '#94a3b8',
                          }}>
                            <Camera size={48} />
                            <p className="screenshot-placeholder-text" style={{
                              fontSize: '14px',
                              margin: '8px 0 0 0',
                            }}>step-{stepNumber}.png</p>
                          </div>
                        ) : (
                          <img
                            src={screenshotPath}
                            alt={`Step ${stepNumber}: ${step.title}`}
                            className="screenshot-image"
                            style={{
                              width: '100%',
                              height: 'auto',
                              display: 'block',
                            }}
                            onError={() => handleImageError(stepNumber)}
                          />
                        )}
                      </div>

                      {/* Cara's Explanation */}
                      <div className="cara-explanation" style={{
                        background: 'linear-gradient(135deg, #f0f7ff 0%, #f8fafc 100%)',
                        borderLeft: `4px solid ${COLORS.slainteBlue}`,
                        padding: '16px 20px',
                        borderRadius: '0 8px 8px 0',
                        marginTop: '16px',
                      }}>
                        <div className="cara-label" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: COLORS.slainteBlue,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '8px',
                        }}>
                          <MessageSquare size={14} />
                          Cara explains
                        </div>
                        <p className="cara-text" style={{
                          color: '#374151',
                          fontSize: '15px',
                          margin: 0,
                          fontStyle: 'italic',
                        }}>"{step.caraText}"</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="guide-footer" style={{
          textAlign: 'center',
          padding: '32px',
          borderTop: '1px solid #e5e7eb',
          marginTop: '32px',
          color: '#6b7280',
          fontSize: '14px',
        }}>
          <p style={{ margin: '0 0 8px 0' }}>Sláinte Finance • Empowering Irish GPs with Financial Clarity</p>
          <p style={{ margin: 0 }}>For support, contact your administrator or visit the Help section in the app.</p>
        </div>
      </div>
    </div>
  );
};

export default PrintableGuide;
