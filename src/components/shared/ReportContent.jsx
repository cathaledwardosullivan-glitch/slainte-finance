import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { BarChart3, AlertCircle } from 'lucide-react';
import { formatArtifactHTML } from '../../utils/artifactBuilder';
import REPORT_THEME, { generateReportCSS } from '../../utils/reportTheme';

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

  const errStyles = REPORT_THEME.chart.error;
  const ctrStyles = REPORT_THEME.chart.container;
  const loadStyles = REPORT_THEME.chart.loading;

  if (error) {
    return (
      <div
        style={{
          padding: errStyles.padding,
          backgroundColor: errStyles.backgroundColor,
          border: errStyles.border,
          borderRadius: errStyles.borderRadius,
          margin: errStyles.margin
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <AlertCircle style={{ height: '1rem', width: '1rem', color: errStyles.iconColor }} />
          <span style={{ fontWeight: 500, color: errStyles.textColor }}>Chart could not be rendered</span>
        </div>
        <p style={{ fontSize: errStyles.detailFontSize, color: errStyles.detailColor, margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: ctrStyles.margin,
        padding: ctrStyles.padding,
        backgroundColor: ctrStyles.backgroundColor,
        borderRadius: ctrStyles.borderRadius,
        border: ctrStyles.border
      }}
    >
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: loadStyles.color }}>
          <BarChart3 style={{ height: '1rem', width: '1rem' }} />
          <span style={{ fontSize: loadStyles.fontSize }}>Loading chart...</span>
        </div>
      )}
      <div
        ref={containerRef}
        id={id}
        style={{
          display: loading ? 'none' : 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: loading ? '0' : ctrStyles.minHeight
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

  const co = REPORT_THEME.callout;

  return (
    <>
      {/* Intro text if available */}
      {report.intro && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: co.padding,
            backgroundColor: co.intro.backgroundColor,
            borderRadius: co.borderRadius,
            borderLeft: `${co.borderLeftWidth} solid ${co.intro.borderLeftColor}`,
            fontSize: co.fontSize,
            lineHeight: co.lineHeight,
            color: co.color
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
            padding: co.padding,
            backgroundColor: co.conclusion.backgroundColor,
            borderRadius: co.borderRadius,
            borderLeft: `${co.borderLeftWidth} solid ${co.conclusion.borderLeftColor}`,
            fontSize: co.fontSize,
            lineHeight: co.lineHeight,
            color: co.color
          }}
        >
          {report.conclusion}
        </div>
      )}

      {/* Report content styles generated from shared theme */}
      <style>{generateReportCSS('screen')}</style>
    </>
  );
};

export default ReportContentRenderer;
