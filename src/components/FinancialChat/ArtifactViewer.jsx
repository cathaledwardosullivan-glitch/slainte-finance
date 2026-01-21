import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Copy, Printer, X, ExternalLink, Save, GitBranch, BarChart3 } from 'lucide-react';
import {
  formatArtifactHTML,
  exportArtifactPDF,
  exportArtifactMarkdown,
  copyArtifactToClipboard,
} from '../../utils/artifactBuilder';
import COLORS from '../../utils/colors';

// Lazy mermaid initialization - only load when needed
let mermaidInstance = null;
let mermaidInitialized = false;

async function getMermaid() {
  if (!mermaidInstance) {
    try {
      const mermaidModule = await import('mermaid');
      mermaidInstance = mermaidModule.default;

      if (!mermaidInitialized) {
        mermaidInstance.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          },
          themeVariables: {
            primaryColor: '#2563eb',
            primaryTextColor: '#1f2937',
            primaryBorderColor: '#3b82f6',
            lineColor: '#6b7280',
            secondaryColor: '#eff6ff',
            tertiaryColor: '#f3f4f6'
          }
        });
        mermaidInitialized = true;
      }
    } catch (error) {
      console.error('[Mermaid] Failed to load mermaid library:', error);
      return null;
    }
  }
  return mermaidInstance;
}

// Lazy Vega-Lite initialization - only load when needed
let vegaEmbedInstance = null;

async function getVegaEmbed() {
  if (!vegaEmbedInstance) {
    try {
      const vegaEmbedModule = await import('vega-embed');
      vegaEmbedInstance = vegaEmbedModule.default;
    } catch (error) {
      console.error('[Vega] Failed to load vega-embed library:', error);
      return null;
    }
  }
  return vegaEmbedInstance;
}

export function ArtifactViewer({ artifact, onClose }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState(null);
  const [mermaidError, setMermaidError] = useState(null);
  const [vegaError, setVegaError] = useState(null);
  const [vegaLoading, setVegaLoading] = useState(false);
  const mermaidRef = useRef(null);
  const vegaRef = useRef(null);

  // Check artifact type
  const isMermaid = artifact.type === 'mermaid';
  const isVega = artifact.type === 'vega';

  // Render mermaid diagram
  useEffect(() => {
    if (isMermaid && artifact.content) {
      const renderMermaid = async () => {
        try {
          // Lazy load mermaid
          const mermaid = await getMermaid();
          if (!mermaid) {
            setMermaidError('Failed to load diagram library');
            return;
          }

          // Clean up the mermaid content - remove any markdown code fence if present
          let mermaidCode = artifact.content.trim();
          if (mermaidCode.startsWith('```mermaid')) {
            mermaidCode = mermaidCode.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
          } else if (mermaidCode.startsWith('```')) {
            mermaidCode = mermaidCode.replace(/^```\n?/, '').replace(/\n?```$/, '');
          }

          // Generate unique ID for this diagram
          const id = `mermaid-${Date.now()}`;

          // Render the diagram
          const { svg } = await mermaid.render(id, mermaidCode);
          setMermaidSvg(svg);
          setMermaidError(null);
        } catch (error) {
          console.error('[Mermaid] Render error:', error);
          setMermaidError(error.message || 'Failed to render diagram');
          setMermaidSvg(null);
        }
      };

      renderMermaid();
    }
  }, [isMermaid, artifact.content]);

  // Render Vega-Lite chart
  useEffect(() => {
    if (isVega && artifact.content && vegaRef.current) {
      const renderVega = async () => {
        setVegaLoading(true);
        setVegaError(null);

        try {
          // Lazy load vega-embed
          const vegaEmbed = await getVegaEmbed();
          if (!vegaEmbed) {
            setVegaError('Failed to load charting library');
            setVegaLoading(false);
            return;
          }

          // Parse the Vega-Lite spec
          let spec;
          try {
            spec = JSON.parse(artifact.content);
          } catch (parseError) {
            setVegaError('Invalid chart specification: ' + parseError.message);
            setVegaLoading(false);
            return;
          }

          // Clear previous chart
          vegaRef.current.innerHTML = '';

          // Render the chart
          await vegaEmbed(vegaRef.current, spec, {
            actions: {
              export: true,
              source: false,
              compiled: false,
              editor: false
            },
            theme: 'latimes',
            renderer: 'svg'
          });

          setVegaLoading(false);
        } catch (error) {
          console.error('[Vega] Render error:', error);
          setVegaError(error.message || 'Failed to render chart');
          setVegaLoading(false);
        }
      };

      renderVega();
    }
  }, [isVega, artifact.content]);

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

  const handleSaveToReports = () => {
    // Generate full HTML document for the report
    const html = formatArtifactHTML(artifact);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${artifact.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
          h2 { color: #2563eb; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
          h3 { color: #3b82f6; margin-top: 20px; }
          table.artifact-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          table.artifact-table th,
          table.artifact-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          table.artifact-table th {
            background-color: #f3f4f6;
            font-weight: 600;
          }
          ul { margin-left: 20px; }
          li { margin: 8px 0; }
          .meta {
            color: #6b7280;
            font-size: 14px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        ${html}
        <div class="meta">
          <p>Generated by Finn (AI Financial Assistant) | Sláinte Finance</p>
          <p>Created: ${new Date(artifact.created_at).toLocaleString('en-IE')}</p>
        </div>
      </body>
      </html>
    `;

    // Save to localStorage
    const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');

    const newReport = {
      id: `finn-report-${Date.now()}`,
      title: artifact.title,
      type: 'AI Report', // Distinguish from other report types
      generatedDate: artifact.created_at,
      year: new Date().getFullYear(),
      htmlContent: htmlContent,
      metadata: {
        artifactType: artifact.type,
        generatedBy: 'Finn AI'
      }
    };

    savedReports.push(newReport);

    // Keep only last 20 reports
    if (savedReports.length > 20) {
      savedReports.shift();
    }

    localStorage.setItem('gp_finance_saved_reports', JSON.stringify(savedReports));

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const html = formatArtifactHTML(artifact);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '0.5rem',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        maxWidth: '64rem',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${COLORS.lightGray}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isMermaid ? (
              <GitBranch style={{ height: '1.5rem', width: '1.5rem', color: COLORS.slainteBlue }} />
            ) : isVega ? (
              <BarChart3 style={{ height: '1.5rem', width: '1.5rem', color: COLORS.slainteBlue }} />
            ) : (
              <FileText style={{ height: '1.5rem', width: '1.5rem', color: COLORS.slainteBlue }} />
            )}
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: COLORS.darkGray }}>
                {artifact.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                {isMermaid ? 'Diagram' : isVega ? 'Chart' : 'Report'} • Created: {new Date(artifact.created_at).toLocaleString()}
              </p>
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
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ height: '1.25rem', width: '1.25rem' }} />
          </button>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0.75rem 1.5rem',
          borderBottom: `1px solid ${COLORS.lightGray}`,
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleSaveToReports}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: saved ? '#10b98120' : `${COLORS.slainteBlue}20`,
              color: saved ? '#10b981' : COLORS.slainteBlue,
              borderRadius: '0.5rem',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!saved) e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}30`;
            }}
            onMouseLeave={(e) => {
              if (!saved) e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}20`;
            }}
          >
            <Save style={{ height: '1rem', width: '1rem' }} />
            {saved ? 'Saved!' : 'Save to Reports'}
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: `${COLORS.mediumGray}20`,
              color: COLORS.darkGray,
              borderRadius: '0.5rem',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.mediumGray}30`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${COLORS.mediumGray}20`}
          >
            <Printer style={{ height: '1rem', width: '1rem' }} />
            Print / PDF
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: `${COLORS.mediumGray}20`,
              color: COLORS.darkGray,
              borderRadius: '0.5rem',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.mediumGray}30`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${COLORS.mediumGray}20`}
          >
            <Download style={{ height: '1rem', width: '1rem' }} />
            Download
          </button>

          <button
            onClick={handleCopy}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.backgroundGray,
              color: COLORS.darkGray,
              borderRadius: '0.5rem',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
          >
            <Copy style={{ height: '1rem', width: '1rem' }} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {isMermaid ? (
            // Mermaid diagram rendering
            <div className="mermaid-container" style={{ textAlign: 'center' }}>
              {mermaidSvg ? (
                <div
                  ref={mermaidRef}
                  dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '200px',
                    padding: '1rem'
                  }}
                />
              ) : mermaidError ? (
                <div style={{
                  padding: '2rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '0.5rem',
                  border: '1px solid #fecaca'
                }}>
                  <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Failed to render diagram
                  </p>
                  <p style={{ color: '#7f1d1d', fontSize: '0.875rem' }}>
                    {mermaidError}
                  </p>
                  <details style={{ marginTop: '1rem', textAlign: 'left' }}>
                    <summary style={{ cursor: 'pointer', color: COLORS.mediumGray, fontSize: '0.875rem' }}>
                      View raw diagram code
                    </summary>
                    <pre style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      backgroundColor: COLORS.backgroundGray,
                      borderRadius: '0.25rem',
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {artifact.content}
                    </pre>
                  </details>
                </div>
              ) : (
                <div style={{ padding: '2rem', color: COLORS.mediumGray }}>
                  <div className="animate-pulse">Rendering diagram...</div>
                </div>
              )}
            </div>
          ) : isVega ? (
            // Vega-Lite chart rendering
            <div className="vega-container" style={{ textAlign: 'center' }}>
              {vegaLoading ? (
                <div style={{ padding: '2rem', color: COLORS.mediumGray }}>
                  <div className="animate-pulse">Rendering chart...</div>
                </div>
              ) : vegaError ? (
                <div style={{
                  padding: '2rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '0.5rem',
                  border: '1px solid #fecaca'
                }}>
                  <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Failed to render chart
                  </p>
                  <p style={{ color: '#7f1d1d', fontSize: '0.875rem' }}>
                    {vegaError}
                  </p>
                  <details style={{ marginTop: '1rem', textAlign: 'left' }}>
                    <summary style={{ cursor: 'pointer', color: COLORS.mediumGray, fontSize: '0.875rem' }}>
                      View chart specification
                    </summary>
                    <pre style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      backgroundColor: COLORS.backgroundGray,
                      borderRadius: '0.25rem',
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {artifact.content}
                    </pre>
                  </details>
                </div>
              ) : (
                <div
                  ref={vegaRef}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '300px',
                    padding: '1rem'
                  }}
                />
              )}
            </div>
          ) : (
            // Regular HTML content
            <div
              className="artifact-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>

      {/* Styles for artifact content */}
      <style>{`
        .artifact-content {
          line-height: 1.7;
          color: ${COLORS.darkGray};
        }
        .artifact-content h1 {
          color: ${COLORS.slainteBlue};
          border-bottom: 3px solid ${COLORS.slainteBlue};
          padding-bottom: 12px;
          margin-bottom: 24px;
          font-size: 28px;
        }
        .artifact-content h2 {
          color: ${COLORS.slainteBlue};
          margin-top: 32px;
          margin-bottom: 16px;
          font-size: 22px;
        }
        .artifact-content h3 {
          color: ${COLORS.slainteBlue};
          margin-top: 24px;
          margin-bottom: 12px;
          font-size: 18px;
        }
        .artifact-content p {
          margin-bottom: 16px;
          color: ${COLORS.darkGray};
        }
        .artifact-content ul {
          margin-left: 24px;
          margin-bottom: 16px;
        }
        .artifact-content li {
          margin: 8px 0;
          color: ${COLORS.darkGray};
        }
        .artifact-content strong {
          color: ${COLORS.darkGray};
          font-weight: 600;
        }
        .artifact-content table.artifact-table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .artifact-content table.artifact-table th,
        .artifact-content table.artifact-table td {
          border: 1px solid ${COLORS.lightGray};
          padding: 12px;
          text-align: left;
        }
        .artifact-content table.artifact-table th {
          background-color: ${COLORS.backgroundGray};
          font-weight: 600;
          color: ${COLORS.darkGray};
        }
        .artifact-content table.artifact-table tr:hover {
          background-color: ${COLORS.backgroundGray};
        }
      `}</style>
    </div>
  );
}

/**
 * Inline Artifact Display (embedded in chat)
 */
export function InlineArtifact({ artifact, onExpand }) {
  const [previewSvg, setPreviewSvg] = useState(null);
  const isMermaid = artifact.type === 'mermaid';
  const isVega = artifact.type === 'vega';

  // Render mermaid preview
  useEffect(() => {
    if (isMermaid && artifact.content) {
      const renderPreview = async () => {
        try {
          // Lazy load mermaid
          const mermaid = await getMermaid();
          if (!mermaid) {
            setPreviewSvg(null);
            return;
          }

          let mermaidCode = artifact.content.trim();
          if (mermaidCode.startsWith('```mermaid')) {
            mermaidCode = mermaidCode.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
          } else if (mermaidCode.startsWith('```')) {
            mermaidCode = mermaidCode.replace(/^```\n?/, '').replace(/\n?```$/, '');
          }

          const id = `mermaid-preview-${Date.now()}`;
          const { svg } = await mermaid.render(id, mermaidCode);
          setPreviewSvg(svg);
        } catch (error) {
          console.error('[Mermaid Preview] Error:', error);
          setPreviewSvg(null);
        }
      };
      renderPreview();
    }
  }, [isMermaid, artifact.content]);

  return (
    <div style={{
      border: `1px solid ${COLORS.slainteBlue}40`,
      borderRadius: '0.5rem',
      backgroundColor: `${COLORS.slainteBlue}10`,
      padding: '1rem',
      marginTop: '0.5rem'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'start',
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isMermaid ? (
            <GitBranch style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          ) : isVega ? (
            <BarChart3 style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          ) : (
            <FileText style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          )}
          <div>
            <p style={{ fontWeight: 600, color: COLORS.darkGray }}>{artifact.title}</p>
            <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
              Click to view full {isMermaid ? 'diagram' : isVega ? 'chart' : 'report'}
            </p>
          </div>
        </div>
        <button
          onClick={onExpand}
          style={{
            padding: '0.5rem',
            background: 'none',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}20`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ExternalLink style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
        </button>
      </div>

      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '0.25rem',
        padding: '0.75rem',
        fontSize: '0.875rem',
        color: COLORS.darkGray,
        maxHeight: '10rem',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {isMermaid && previewSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: previewSvg }}
            style={{
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
              pointerEvents: 'none'
            }}
          />
        ) : isVega ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            color: COLORS.mediumGray
          }}>
            <BarChart3 style={{ height: '2rem', width: '2rem', marginBottom: '0.5rem', color: COLORS.slainteBlue }} />
            <span style={{ fontSize: '0.75rem' }}>Interactive Chart</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Click to view</span>
          </div>
        ) : (
          <div style={{
            display: '-webkit-box',
            WebkitLineClamp: 6,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {artifact.content.substring(0, 300)}...
          </div>
        )}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3rem',
          background: 'linear-gradient(to top, white, transparent)'
        }} />
      </div>

      <button
        onClick={onExpand}
        style={{
          marginTop: '0.75rem',
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          borderRadius: '0.5rem',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e40af'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
      >
        View Full {isMermaid ? 'Diagram' : isVega ? 'Chart' : 'Report'}
      </button>
    </div>
  );
}
