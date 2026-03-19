import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { BarChart3, AlertCircle } from 'lucide-react';
import { formatArtifactHTML } from '../../utils/artifactBuilder';
import COLORS from '../../utils/colors';

/**
 * Recursively sanitise d3-format strings in a Vega-Lite spec.
 * Claude sometimes outputs "€,.0f" or "$,.0f" — strip leading currency symbols
 * so vega-embed doesn't throw "invalid format" errors.
 */
const sanitiseFormatStrings = (obj) => {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitiseFormatStrings);
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'format' && typeof val === 'string') {
      out[key] = val.replace(/^[€$£¥₹]+/, '');
    } else {
      out[key] = sanitiseFormatStrings(val);
    }
  }
  return out;
};

/**
 * InlineVegaChart - Renders a Vega-Lite chart embedded in report content.
 * Shared between ReportModal (Finn widget) and ReportReader (Advanced Insights tab).
 */
export const InlineVegaChart = ({ spec, id }) => {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !spec) return;

      setLoading(true);
      setError(null);

      try {
        const vegaEmbed = (await import('vega-embed')).default;

        let parsedSpec;
        try {
          parsedSpec = typeof spec === 'string' ? JSON.parse(spec) : spec;
          parsedSpec = sanitiseFormatStrings(parsedSpec);
        } catch (parseErr) {
          setError('Invalid chart specification');
          setLoading(false);
          return;
        }

        containerRef.current.innerHTML = '';

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
        <p style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '1.5rem 0',
        padding: '1rem',
        backgroundColor: COLORS.bgPage,
        borderRadius: '0.5rem',
        border: `1px solid ${COLORS.borderLight}`
      }}
    >
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textSecondary }}>
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
 * Process report content to extract and render Vega-Lite charts.
 * Returns an array of content segments (text HTML and chart specs).
 */
export const processReportContent = (content) => {
  if (!content) return [];

  const segments = [];
  const vegaRegex = /```vega-lite\s*([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;
  let chartIndex = 0;

  while ((match = vegaRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textContent = content.substring(lastIndex, match.index);
      segments.push({ type: 'text', content: textContent });
    }

    segments.push({
      type: 'chart',
      spec: match[1].trim(),
      id: `inline-chart-${chartIndex++}`
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.substring(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
};

/**
 * ReportContentRenderer - Renders report content with inline Vega-Lite charts.
 * Shared rendering component used by both ReportModal and ReportReader.
 */
const ReportContentRenderer = ({ report }) => {
  const contentSegments = processReportContent(report.content);

  const artifact = {
    title: report.title,
    type: report.artifactType || 'report',
    content: report.content,
    created_at: report.generatedDate
  };

  return (
    <>
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
            color: COLORS.textPrimary
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
            color: COLORS.textPrimary
          }}
        >
          {report.conclusion}
        </div>
      )}

      {/* Shared report content styles */}
      <style>{`
        .report-content {
          line-height: 1.7;
          color: ${COLORS.textPrimary};
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
          color: ${COLORS.textPrimary};
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
          color: ${COLORS.textPrimary};
        }
        .report-content table.artifact-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.875rem;
        }
        .report-content table.artifact-table th,
        .report-content table.artifact-table td {
          border: 1px solid ${COLORS.borderLight};
          padding: 0.75rem;
          text-align: left;
        }
        .report-content table.artifact-table th {
          background-color: ${COLORS.bgPage};
          font-weight: 600;
        }
        .report-content table.artifact-table tr:hover {
          background-color: ${COLORS.bgPage};
        }
      `}</style>
    </>
  );
};

export default ReportContentRenderer;
