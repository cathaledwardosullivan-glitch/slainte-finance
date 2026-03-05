import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { ArtifactViewer } from '../FinancialChat/ArtifactViewer';
import { X, FileText, Download, Copy, Printer, Calendar, BarChart3, AlertCircle } from 'lucide-react';
import { exportArtifactPDF, exportArtifactMarkdown, copyArtifactToClipboard, formatArtifactHTML } from '../../utils/artifactBuilder';
import COLORS from '../../utils/colors';

/**
 * InlineVegaChart - Renders a Vega-Lite chart embedded in report content
 */
const InlineVegaChart = ({ spec, id }) => {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !spec) return;

      setLoading(true);
      setError(null);

      try {
        // Dynamically import vega-embed
        const vegaEmbed = (await import('vega-embed')).default;

        // Parse the spec
        let parsedSpec;
        try {
          parsedSpec = typeof spec === 'string' ? JSON.parse(spec) : spec;
        } catch (parseErr) {
          setError('Invalid chart specification');
          setLoading(false);
          return;
        }

        // Clear previous content
        containerRef.current.innerHTML = '';

        // Render the chart
        await vegaEmbed(containerRef.current, parsedSpec, {
          actions: { export: true, source: false, compiled: false, editor: false },
          theme: 'latimes',
          renderer: 'svg'
        });

        setLoading(false);
      } catch (err) {
        console.error('[VegaChart] Render error:', err);
        setError(err.message || 'Failed to render chart');
        setLoading(false);
      }
    };

    renderChart();
  }, [spec]);

  if (error) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: `${COLORS.expenseColor}10`,
          border: `1px solid ${COLORS.expenseColor}30`,
          borderRadius: '0.5rem',
          margin: '1rem 0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <AlertCircle style={{ height: '1rem', width: '1rem', color: COLORS.expenseColor }} />
          <span style={{ fontWeight: 500, color: COLORS.expenseColor }}>Chart could not be rendered</span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: COLORS.mediumGray, margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '1.5rem 0',
        padding: '1rem',
        backgroundColor: COLORS.backgroundGray,
        borderRadius: '0.5rem',
        border: `1px solid ${COLORS.lightGray}`
      }}
    >
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.mediumGray }}>
          <BarChart3 style={{ height: '1rem', width: '1rem' }} />
          <span style={{ fontSize: '0.875rem' }}>Loading chart...</span>
        </div>
      )}
      <div
        ref={containerRef}
        id={id}
        style={{
          display: loading ? 'none' : 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: loading ? '0' : '200px'
        }}
      />
    </div>
  );
};

/**
 * Process report content to extract and render Vega-Lite charts
 * Returns an array of content segments (text HTML and chart specs)
 */
const processReportContent = (content) => {
  if (!content) return [];

  const segments = [];
  // Match ```vega-lite ... ``` code blocks
  const vegaRegex = /```vega-lite\s*([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;
  let chartIndex = 0;

  while ((match = vegaRegex.exec(content)) !== null) {
    // Add text before this chart
    if (match.index > lastIndex) {
      const textContent = content.substring(lastIndex, match.index);
      segments.push({
        type: 'text',
        content: textContent
      });
    }

    // Add the chart
    segments.push({
      type: 'chart',
      spec: match[1].trim(),
      id: `inline-chart-${chartIndex++}`
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last chart
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastIndex)
    });
  }

  // If no charts found, return the whole content as text
  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
};

/**
 * ReportModal - Full-screen modal for viewing Finn-generated reports
 * Wraps the existing ArtifactViewer with a custom header for consistency
 */
const ReportModal = ({ report, onClose }) => {
  const [copied, setCopied] = useState(false);

  // Convert report to artifact format for ArtifactViewer
  const artifact = {
    title: report.title,
    type: report.artifactType || 'report',
    content: report.content,
    created_at: report.generatedDate
  };

  const handleCopy = async () => {
    const success = await copyArtifactToClipboard(artifact);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    exportArtifactPDF(artifact);
  };

  const handleDownload = () => {
    exportArtifactMarkdown(artifact);
  };

  // Process content to extract charts and text segments
  const contentSegments = processReportContent(report.content);

  // Format the report content as HTML (used for segments without charts)
  const html = formatArtifactHTML(artifact);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: `1px solid ${COLORS.lightGray}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: COLORS.white,
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: `${COLORS.slainteBlue}15`,
                borderRadius: '0.625rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h2 style={{ fontWeight: 600, fontSize: '1.125rem', color: COLORS.darkGray, margin: 0 }}>
                {report.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <Calendar style={{ height: '0.75rem', width: '0.75rem', color: COLORS.mediumGray }} />
                <span style={{ fontSize: '0.8125rem', color: COLORS.mediumGray }}>
                  {new Date(report.generatedDate).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              color: COLORS.mediumGray,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
              e.currentTarget.style.color = COLORS.darkGray;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = COLORS.mediumGray;
            }}
          >
            <X style={{ height: '1.25rem', width: '1.25rem' }} />
          </button>
        </div>

        {/* Action Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: `1px solid ${COLORS.lightGray}`,
            display: 'flex',
            gap: '0.5rem',
            backgroundColor: COLORS.backgroundGray,
            flexShrink: 0
          }}
        >
          <button
            onClick={handlePrint}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.darkGray,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <Printer style={{ height: '0.875rem', width: '0.875rem' }} />
            Print / PDF
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.darkGray,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <Download style={{ height: '0.875rem', width: '0.875rem' }} />
            Download
          </button>

          <button
            onClick={handleCopy}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: copied ? `${COLORS.incomeColor}15` : COLORS.white,
              border: `1px solid ${copied ? COLORS.incomeColor : COLORS.lightGray}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: copied ? COLORS.incomeColor : COLORS.darkGray,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!copied) e.currentTarget.style.borderColor = COLORS.slainteBlue;
            }}
            onMouseLeave={(e) => {
              if (!copied) e.currentTarget.style.borderColor = COLORS.lightGray;
            }}
          >
            <Copy style={{ height: '0.875rem', width: '0.875rem' }} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Original Question */}
        {report.originalQuestion && (
          <div
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: `${COLORS.slainteBlue}08`,
              borderBottom: `1px solid ${COLORS.lightGray}`,
              fontSize: '0.8125rem',
              color: COLORS.mediumGray,
              flexShrink: 0
            }}
          >
            <span style={{ fontWeight: 500, color: COLORS.darkGray }}>Your question: </span>
            {report.originalQuestion}
          </div>
        )}

        {/* Report Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem'
          }}
        >
          {/* Intro text if available */}
          {report.intro && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: `${COLORS.slainteBlue}08`,
                borderRadius: '0.5rem',
                borderLeft: `3px solid ${COLORS.slainteBlue}`,
                fontSize: '0.9375rem',
                lineHeight: '1.6',
                color: COLORS.darkGray
              }}
            >
              {report.intro}
            </div>
          )}

          {/* Main report content with inline charts */}
          {contentSegments.map((segment, index) => {
            if (segment.type === 'chart') {
              return (
                <InlineVegaChart
                  key={segment.id}
                  spec={segment.spec}
                  id={segment.id}
                />
              );
            }
            // Text segment - render as HTML
            const segmentHtml = formatArtifactHTML({ ...artifact, content: segment.content });
            return (
              <div
                key={`text-${index}`}
                className="report-content"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(segmentHtml) }}
              />
            );
          })}

          {/* Conclusion text if available */}
          {report.conclusion && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: `${COLORS.incomeColor}08`,
                borderRadius: '0.5rem',
                borderLeft: `3px solid ${COLORS.incomeColor}`,
                fontSize: '0.9375rem',
                lineHeight: '1.6',
                color: COLORS.darkGray
              }}
            >
              {report.conclusion}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.875rem 1.5rem',
            borderTop: `1px solid ${COLORS.lightGray}`,
            backgroundColor: COLORS.backgroundGray,
            fontSize: '0.75rem',
            color: COLORS.mediumGray,
            textAlign: 'center',
            flexShrink: 0
          }}
        >
          Generated by Finn AI • Sláinte Finance
        </div>
      </div>

      {/* Styles for report content */}
      <style>{`
        .report-content {
          line-height: 1.7;
          color: ${COLORS.darkGray};
        }
        .report-content h1 {
          color: ${COLORS.slainteBlue};
          border-bottom: 2px solid ${COLORS.slainteBlue};
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .report-content h2 {
          color: ${COLORS.slainteBlue};
          margin-top: 2rem;
          margin-bottom: 1rem;
          font-size: 1.25rem;
          font-weight: 600;
        }
        .report-content h3 {
          color: ${COLORS.darkGray};
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          font-size: 1.0625rem;
          font-weight: 600;
        }
        .report-content p {
          margin-bottom: 1rem;
        }
        .report-content ul, .report-content ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .report-content li {
          margin: 0.5rem 0;
        }
        .report-content strong {
          font-weight: 600;
          color: ${COLORS.darkGray};
        }
        .report-content table.artifact-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.875rem;
        }
        .report-content table.artifact-table th,
        .report-content table.artifact-table td {
          border: 1px solid ${COLORS.lightGray};
          padding: 0.75rem;
          text-align: left;
        }
        .report-content table.artifact-table th {
          background-color: ${COLORS.backgroundGray};
          font-weight: 600;
        }
        .report-content table.artifact-table tr:hover {
          background-color: ${COLORS.backgroundGray};
        }
      `}</style>
    </div>
  );
};

export default ReportModal;
