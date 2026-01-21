/**
 * Artifact Builder for Finn
 * Generates structured, exportable reports and analyses
 */

/**
 * Parse response for artifact tags and separate intro/conclusion from content
 * Handles attributes in any order (identifier, type, title can appear in any sequence)
 * @param {string} response - AI response text
 * @returns {Object|null} { intro: string, conclusion: string, artifact: { content, title, type, identifier } } or null
 */
export function parseArtifactResponse(response) {
  // More flexible regex that captures the opening tag with any attributes, then content
  const artifactRegex = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/;
  const match = response.match(artifactRegex);

  if (match) {
    const [fullMatch, attributesStr, content] = match;

    // Parse individual attributes from the attributes string
    const titleMatch = attributesStr.match(/title="([^"]+)"/);
    const typeMatch = attributesStr.match(/type="([^"]+)"/);
    const identifierMatch = attributesStr.match(/identifier="([^"]+)"/);

    // Extract values (with defaults)
    const title = titleMatch ? titleMatch[1] : 'Report';
    let type = typeMatch ? typeMatch[1] : 'report';
    const identifier = identifierMatch ? identifierMatch[1] : null;

    // Normalize complex types to simpler ones for our artifact system
    // e.g., "application/vnd.ant.mermaid" -> "mermaid"
    if (type.includes('mermaid')) {
      type = 'mermaid';
    } else if (type.includes('vega') || type.includes('vnd.vega')) {
      type = 'vega';
    } else if (type.includes('html')) {
      type = 'html';
    } else if (type.includes('code') || type.includes('javascript') || type.includes('python')) {
      type = 'code';
    } else if (type.includes('react')) {
      type = 'react';
    } else if (!['report', 'analysis', 'summary', 'chart', 'table'].includes(type)) {
      // Default unknown types to 'report' for markdown rendering
      type = 'report';
    }

    // Also check content for Vega-Lite schema
    if (type === 'report' && content.includes('"$schema"') && content.includes('vega')) {
      type = 'vega';
    }

    const intro = response.substring(0, match.index).trim();
    const conclusion = response.substring(match.index + fullMatch.length).trim();

    return {
      intro: intro || null,
      conclusion: conclusion || null,
      artifact: {
        title: title,
        type: type,
        content: content.trim(),
        identifier: identifier
      }
    };
  }

  return null;
}

/**
 * Detect if response should be an artifact (legacy method for backward compatibility)
 * @param {string} response - AI response text
 * @returns {Object|null} Artifact metadata or null
 */
export function shouldCreateArtifact(response) {
  // First, check if response uses new artifact tag format
  const parsed = parseArtifactResponse(response);
  if (parsed) {
    return {
      type: parsed.artifact.type,
      title: parsed.artifact.title,
      format: 'markdown',
    };
  }

  // Legacy detection: ONLY trigger for truly comprehensive reports
  // We've moved to explicit <artifact> tags, so make this very restrictive

  // Must be very long (>1200 chars)
  const isVeryLong = response.length > 1200;

  // Must have multiple major sections (at least 3 ## headers)
  const headerMatches = response.match(/^##\s+/gm);
  const hasMultipleSections = headerMatches && headerMatches.length >= 3;

  // Must have explicit report-style titles
  const hasReportTitle = /^#\s+(quarterly|annual|financial|comprehensive|detailed)\s+(report|analysis|review|summary)/im.test(response);

  // Only create artifact if it's clearly a comprehensive report
  if (isVeryLong && hasMultipleSections && hasReportTitle) {
    return {
      type: 'report',
      title: extractTitle(response) || 'Financial Report',
      format: 'markdown',
    };
  }

  return null;
}

/**
 * Extract title from response
 */
function extractTitle(response) {
  // Look for markdown header
  const headerMatch = response.match(/^#\s+(.+)$/m);
  if (headerMatch) return headerMatch[1];

  // Look for bold title
  const boldMatch = response.match(/^\*\*(.+)\*\*$/m);
  if (boldMatch) return boldMatch[1];

  // First line if short
  const firstLine = response.split('\n')[0];
  if (firstLine.length < 100) return firstLine;

  return 'Financial Report';
}

/**
 * Create artifact object
 */
export function createArtifact(content, metadata = {}) {
  return {
    type: metadata.type || 'report',
    title: metadata.title || 'Report',
    format: metadata.format || 'markdown',
    content: content,
    created_at: metadata.created_at || new Date().toISOString(),
  };
}

/**
 * Format artifact for display (convert markdown to HTML)
 */
export function formatArtifactHTML(artifact) {
  let html = artifact.content;

  // Convert markdown headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Convert line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Convert tables (basic)
  html = convertMarkdownTables(html);

  return html;
}

/**
 * Convert markdown tables to HTML
 */
function convertMarkdownTables(text) {
  const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;

  return text.replace(tableRegex, (table) => {
    const rows = table.trim().split('\n').filter(row => !row.match(/^[\s|:\-]+$/));
    if (rows.length < 2) return table;

    const headers = rows[0].split('|').filter(cell => cell.trim());
    const dataRows = rows.slice(1);

    let html = '<table class="artifact-table">';

    // Header
    html += '<thead><tr>';
    headers.forEach(header => {
      html += `<th>${header.trim()}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    dataRows.forEach(row => {
      const cells = row.split('|').filter(cell => cell.trim());
      html += '<tr>';
      cells.forEach(cell => {
        html += `<td>${cell.trim()}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    return html;
  });
}

/**
 * Export artifact as PDF (uses browser print)
 */
export function exportArtifactPDF(artifact) {
  const html = formatArtifactHTML(artifact);
  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${artifact.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 20px;
          line-height: 1.6;
          color: #333;
        }
        h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
        h2 { color: #2563eb; margin-top: 30px; }
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
        Generated: ${new Date().toLocaleString()}<br>
        Source: Financial Chat - Finn
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

/**
 * Export artifact as Markdown file
 */
export function exportArtifactMarkdown(artifact) {
  const content = `# ${artifact.title}\n\n${artifact.content}\n\n---\nGenerated: ${new Date().toLocaleString()}\nSource: Financial Chat - Finn`;

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${artifact.title.replace(/[^a-z0-9]/gi, '_')}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy artifact to clipboard
 */
export async function copyArtifactToClipboard(artifact) {
  try {
    await navigator.clipboard.writeText(artifact.content);
    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    return false;
  }
}
