import React, { useState, useMemo, useEffect } from 'react';
import COLORS from '../../utils/colors';
import { AREAS } from './useAreaReadiness';
import { getActionItems } from '../../storage/practiceProfileStorage';

const STATUS_COLORS = {
  ready: COLORS.incomeColor,      // #4ECDC4 turquoise
  partial: COLORS.highlightYellow, // #FFD23C yellow
  'no-data': COLORS.lightGray     // #E0E0E0 grey
};

// SVG gradient fills for richer arc appearance (flat STATUS_COLORS kept for HTML legend)
const STATUS_FILLS = {
  ready: 'url(#grad-ready)',
  partial: 'url(#grad-partial)',
  'no-data': 'url(#grad-nodata)'
};

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, outerR, innerR, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z'
  ].join(' ');
}

// ── THREE EQUAL ARCS (110° each, 10° gaps) ──
//
//       355°╲ 10° gap ╱5°
//   Tasks    ╲       ╱  Data Collection
//  245°-355°  ╲     ╱   5°-115°
//              ╲   ╱
//               ╲ ╱
//    10° gap ── ╳ ── 10° gap
//               ╱ ╲
//              ╱   ╲
//             ╱     ╲
//            ╱ Analysis╲
//          125°  -  235°
//

const DATA_START = 5;
const DATA_END = 115;
const DATA_SPAN = DATA_END - DATA_START;          // 110°

const ANALYSIS_START = 125;
const ANALYSIS_END = 235;
const ANALYSIS_SPAN = ANALYSIS_END - ANALYSIS_START; // 110°

const TASKS_START = 245;
const TASKS_END = 355;
const TASKS_SPAN = TASKS_END - TASKS_START;       // 110°

// 6 area segments per arc
const AREA_GAP = 2;
const AREA_ARC = (DATA_SPAN - (AREAS.length - 1) * AREA_GAP) / AREAS.length;

/**
 * CircularWorkflow – Three-arc horseshoe donut
 *   Right:  Data Collection (6 area segments, readiness colours)
 *   Bottom: Analysis        (6 area segments, analysis-status colours)
 *   Left:   Tasks           (per-task segments, priority colours)
 */
const CircularWorkflow = ({ readiness, summary, onAreaClick, financialSummary, perAreaFinancials }) => {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  const cx = 200;
  const cy = 195;
  const outerR = 150;
  const innerR = 100;

  // Re-read tasks when they change externally
  useEffect(() => {
    const handleRefresh = () => setTaskRefreshKey(k => k + 1);
    window.addEventListener('tasks:refresh', handleRefresh);
    return () => window.removeEventListener('tasks:refresh', handleRefresh);
  }, []);

  // All GMS Health Check tasks (have a recommendationId), including completed
  const allTasks = useMemo(() => {
    const actionItems = getActionItems() || [];
    return actionItems
      .filter(t => t.recommendationId)
      .map(t => ({
        id: t.id,
        title: t.title || 'Untitled task',
        isHigh: t.type === 'priority' || t.priority === 'high',
        isCompleted: t.status === 'completed'
      }))
      // Sort: active high-priority first, then active standard, then completed
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return a.isHigh === b.isHigh ? 0 : a.isHigh ? -1 : 1;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskRefreshKey]);

  // Build individual task segments within the left arc
  const taskSegments = useMemo(() => {
    if (allTasks.length === 0) {
      return [{ start: TASKS_START, end: TASKS_END, fillStatus: 'no-data', opacity: 0.35, task: null }];
    }
    const gap = allTasks.length <= 10 ? 2 : (allTasks.length <= 20 ? 1 : 0.5);
    const totalGaps = (allTasks.length - 1) * gap;
    const segArc = (TASKS_SPAN - totalGaps) / allTasks.length;
    return allTasks.map((task, i) => ({
      start: TASKS_START + i * (segArc + gap),
      end: TASKS_START + i * (segArc + gap) + segArc,
      fillStatus: task.isCompleted ? 'ready' : 'partial',
      opacity: 0.85,
      task
    }));
  }, [allTasks]);

  const completedCount = allTasks.filter(t => t.isCompleted).length;

  const hasAnalysis = summary.analyzableCount > 0;
  const unclaimed = financialSummary?.unclaimed || 0;
  const growth = financialSummary?.growth || 0;

  // Clicking a task segment opens the Tasks widget, expands GMS section, and highlights the task
  const handleTaskClick = (taskId) => {
    window.dispatchEvent(new CustomEvent('tasks:openAndHighlight', { detail: { taskId } }));
  };

  // ── Tooltip box style (shared across all three positions) ──
  const tooltipBoxStyle = {
    padding: '0.5rem 0.75rem',
    backgroundColor: COLORS.white,
    borderRadius: '0.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontSize: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    width: '240px',
    wordWrap: 'break-word'
  };

  // ── Tooltip content renderers per arc type ──
  const renderTaskTooltip = () => {
    if (!hoverInfo || hoverInfo.type !== 'task' || !hoverInfo.task) return null;
    const task = hoverInfo.task;
    const statusColor = task.isCompleted ? COLORS.incomeColor : '#B8960A';
    const statusLabel = task.isCompleted ? 'Completed' : (task.isHigh ? 'High priority' : 'Standard');
    return (
      <div style={{ ...tooltipBoxStyle, textAlign: 'right' }}>
        <span style={{ fontWeight: 600, color: COLORS.darkGray }}>{task.title}</span>
        <span style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 500 }}>
          {statusLabel}
        </span>
      </div>
    );
  };

  const renderDataTooltip = () => {
    if (!hoverInfo || hoverInfo.type !== 'data') return null;
    const area = AREAS.find(a => a.id === hoverInfo.areaId);
    const status = readiness[hoverInfo.areaId]?.status || 'no-data';
    const dataAge = readiness[hoverInfo.areaId]?.dataAge;
    return (
      <div style={{ ...tooltipBoxStyle, textAlign: 'left' }}>
        <span style={{ fontWeight: 600, color: COLORS.darkGray }}>{area?.description}</span>
        <span style={{ fontSize: '0.75rem', color: STATUS_COLORS[status], fontWeight: 500 }}>
          {status === 'ready' ? 'Data complete' : status === 'partial' ? 'Partial data' : 'No data yet'}
        </span>
        {dataAge?.isStale && (
          <span style={{ fontSize: '0.7rem', color: '#D97706', fontWeight: 500 }}>
            Data may be stale ({Math.floor(dataAge.daysOld / 30)}+ months old)
          </span>
        )}
      </div>
    );
  };

  const analysisTooltipStyle = {
    ...tooltipBoxStyle,
    maxWidth: 'none',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem'
  };

  const renderAnalysisTooltip = () => {
    if (!hoverInfo || hoverInfo.type !== 'analysis') return null;
    const area = AREAS.find(a => a.id === hoverInfo.areaId);
    const canAnalyze = readiness[hoverInfo.areaId]?.canAnalyze;
    const areaFin = perAreaFinancials?.[hoverInfo.areaId];
    const areaUnclaimed = areaFin?.unclaimed || 0;
    const areaGrowth = areaFin?.growth || 0;
    const hasFinancials = areaUnclaimed > 0 || areaGrowth > 0;

    return (
      <div style={{ ...analysisTooltipStyle, textAlign: 'center' }}>
        <span style={{ fontWeight: 600, color: COLORS.darkGray }}>{area?.description}</span>
        {canAnalyze && hasFinancials ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {areaUnclaimed > 0 && (
              <span style={{ fontSize: '0.75rem', color: COLORS.expenseColor, fontWeight: 600 }}>
                Unclaimed: {'\u20AC'}{Math.round(areaUnclaimed).toLocaleString()}
              </span>
            )}
            {areaGrowth > 0 && (
              <span style={{ fontSize: '0.75rem', color: COLORS.incomeColor, fontWeight: 600 }}>
                Growth: {'\u20AC'}{Math.round(areaGrowth).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: canAnalyze ? COLORS.slainteBlue : COLORS.mediumGray, fontWeight: 500 }}>
            {canAnalyze ? 'Click to view analysis' : 'Needs more data'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      {/* ── Three-column layout: Tasks label │ SVG │ Data label ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: '0.5rem',
        width: '100%',
        maxWidth: '720px'
      }}>
        {/* Left annotation: Action Plan */}
        <div style={{ paddingTop: '1.5rem', textAlign: 'right', width: '90px', flexShrink: 0, flexGrow: 0, position: 'relative' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: COLORS.darkGray, lineHeight: 1.3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Action<br />Plan
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.375rem',
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: allTasks.length === 0
              ? 'rgba(113, 121, 133, 0.08)'
              : completedCount === allTasks.length
                ? 'rgba(78, 205, 196, 0.1)'
                : 'rgba(255, 210, 60, 0.12)',
            border: `1px solid ${allTasks.length === 0
              ? 'rgba(113, 121, 133, 0.25)'
              : completedCount === allTasks.length
                ? 'rgba(78, 205, 196, 0.4)'
                : 'rgba(255, 210, 60, 0.45)'
            }`
          }}>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: allTasks.length === 0 ? COLORS.mediumGray
                : completedCount === allTasks.length ? COLORS.incomeColor
                : '#B8960A'
            }}>
              {completedCount}/{allTasks.length}
            </span>
            <span style={{ fontSize: '0.7rem', color: COLORS.mediumGray }}>done</span>
          </div>
          {/* Task hover tooltip - absolutely positioned so it overflows left without shifting layout */}
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', zIndex: 10 }}>
            {renderTaskTooltip()}
          </div>
        </div>

        {/* Centre: SVG Donut */}
        <svg viewBox="0 0 400 400" width="500" height="500" style={{ flexShrink: 0, display: 'block' }}>
          <defs>
            <radialGradient id="grad-ready" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#4ECDC4" />
              <stop offset="100%" stopColor="#3BB8B0" />
            </radialGradient>
            <radialGradient id="grad-partial" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#FFD23C" />
              <stop offset="100%" stopColor="#F0C030" />
            </radialGradient>
            <radialGradient id="grad-nodata" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#E0E0E0" />
              <stop offset="100%" stopColor="#D0D0D0" />
            </radialGradient>
          </defs>

          {/* ═══ DATA COLLECTION ═══ right arc, 5°–115° */}
          {AREAS.map((area, i) => {
            const segStart = DATA_START + i * (AREA_ARC + AREA_GAP);
            const segEnd = segStart + AREA_ARC;
            const status = readiness[area.id]?.status || 'no-data';
            const isHovered = hoverInfo?.type === 'data' && hoverInfo.areaId === area.id;
            const labelPos = polarToCartesian(cx, cy, outerR + 16, (segStart + segEnd) / 2);

            return (
              <g
                key={`data-${area.id}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onAreaClick(area.id, 'data')}
                onMouseEnter={() => setHoverInfo({ type: 'data', areaId: area.id })}
                onMouseLeave={() => setHoverInfo(null)}
              >
                <path
                  d={describeArc(cx, cy, outerR, innerR, segStart, segEnd)}
                  fill={STATUS_FILLS[status]}
                  stroke={isHovered ? COLORS.darkGray : COLORS.white}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: 'all 0.2s ease', transform: isHovered ? 'scale(1.03)' : 'scale(1)', transformOrigin: `${cx}px ${cy}px` }}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fontWeight={isHovered ? 700 : 500}
                  fill={COLORS.darkGray}
                >
                  {area.shortLabel}
                </text>
                {/* Staleness indicator: small orange dot on outer edge */}
                {readiness[area.id]?.dataAge?.isStale && (() => {
                  const dotPos = polarToCartesian(cx, cy, outerR - 6, segStart + 4);
                  return (
                    <circle
                      cx={dotPos.x}
                      cy={dotPos.y}
                      r="3.5"
                      fill="#F59E0B"
                      stroke={COLORS.white}
                      strokeWidth="1"
                    />
                  );
                })()}
              </g>
            );
          })}

          {/* ═══ ANALYSIS ═══ bottom arc, 125°–235° */}
          {AREAS.map((area, i) => {
            const segStart = ANALYSIS_START + i * (AREA_ARC + AREA_GAP);
            const segEnd = segStart + AREA_ARC;
            const canAnalyze = readiness[area.id]?.canAnalyze;
            const status = readiness[area.id]?.status || 'no-data';
            const isHovered = hoverInfo?.type === 'analysis' && hoverInfo.areaId === area.id;

            // Unified colors: turquoise if analysed, yellow if partial data, grey if none
            const fillStatus = canAnalyze
              ? (status === 'ready' ? 'ready' : 'partial')
              : 'no-data';

            const labelPos = polarToCartesian(cx, cy, outerR + 14, (segStart + segEnd) / 2);

            return (
              <g
                key={`analysis-${area.id}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onAreaClick(area.id, 'analysis')}
                onMouseEnter={() => setHoverInfo({ type: 'analysis', areaId: area.id })}
                onMouseLeave={() => setHoverInfo(null)}
              >
                <path
                  d={describeArc(cx, cy, outerR, innerR, segStart, segEnd)}
                  fill={STATUS_FILLS[fillStatus]}
                  stroke={isHovered ? COLORS.darkGray : COLORS.white}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isHovered ? 1 : (canAnalyze ? 0.85 : 0.35)}
                  style={{ transition: 'all 0.2s ease', transform: isHovered ? 'scale(1.03)' : 'scale(1)', transformOrigin: `${cx}px ${cy}px` }}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fontWeight={isHovered ? 600 : 400}
                  fill={COLORS.mediumGray}
                >
                  {area.shortLabel}
                </text>
              </g>
            );
          })}

          {/* ═══ TASKS ═══ left arc, 245°–355° */}
          {taskSegments.map((seg, i) => {
            const isHovered = hoverInfo?.type === 'task' && hoverInfo.index === i;
            const isClickable = seg.task && !seg.task.isCompleted;
            return (
              <g
                key={`task-${i}`}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
                onClick={isClickable ? () => handleTaskClick(seg.task.id) : undefined}
                onMouseEnter={() => seg.task && setHoverInfo({ type: 'task', index: i, task: seg.task })}
                onMouseLeave={() => setHoverInfo(null)}
              >
                <path
                  d={describeArc(cx, cy, outerR, innerR, seg.start, seg.end)}
                  fill={STATUS_FILLS[seg.fillStatus]}
                  stroke={isHovered ? COLORS.darkGray : COLORS.white}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isHovered ? 1 : seg.opacity}
                  style={{ transition: 'all 0.2s ease', transform: isHovered ? 'scale(1.03)' : 'scale(1)', transformOrigin: `${cx}px ${cy}px` }}
                />
              </g>
            );
          })}

          {/* ═══ CYCLE ARROWS ═══ subtle chevrons in the 10° gaps */}
          {[
            { angle: 120, label: 'Data → Analysis' },
            { angle: 240, label: 'Analysis → Tasks' },
            { angle: 0, label: 'Tasks → Data' }
          ].map(({ angle, label }) => {
            const midR = (outerR + innerR) / 2;
            const pos = polarToCartesian(cx, cy, midR, angle);
            // Arrow points clockwise along the tangent (perpendicular to radius = angle + 90)
            const rotation = angle;
            return (
              <g key={label} transform={`translate(${pos.x}, ${pos.y}) rotate(${rotation})`} opacity={0.3}>
                <path
                  d="M -4 -5 L 4 0 L -4 5"
                  fill="none"
                  stroke={COLORS.mediumGray}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* ═══ CENTRE CONTENT ═══ inside the donut */}
          {hasAnalysis && (unclaimed > 0 || growth > 0) ? (
            <foreignObject x={cx - 70} y={cy - 45} width="140" height="90">
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '0.25rem',
                textAlign: 'center'
              }}>
                {unclaimed > 0 && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: COLORS.mediumGray, lineHeight: 1.2 }}>Unclaimed</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: COLORS.expenseColor, lineHeight: 1.2 }}>
                      {'\u20AC'}{Math.round(unclaimed).toLocaleString()}
                    </div>
                  </div>
                )}
                {unclaimed > 0 && growth > 0 && (
                  <div style={{ width: '40px', borderBottom: `1px solid ${COLORS.lightGray}` }} />
                )}
                {growth > 0 && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: COLORS.mediumGray, lineHeight: 1.2 }}>Growth</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: COLORS.incomeColor, lineHeight: 1.2 }}>
                      {'\u20AC'}{Math.round(growth).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </foreignObject>
          ) : (
            <foreignObject x={cx - 55} y={cy - 35} width="110" height="70">
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: COLORS.slainteBlue,
                  lineHeight: 1
                }}>
                  {summary.readyCount}/{summary.totalAreas}
                </div>
                <div style={{
                  fontSize: '0.65rem',
                  color: COLORS.mediumGray,
                  marginTop: '0.2rem',
                  lineHeight: 1.2
                }}>
                  areas ready
                </div>
              </div>
            </foreignObject>
          )}
        </svg>

        {/* Right annotation: Data Collection */}
        <div style={{ paddingTop: '1.5rem', textAlign: 'left', width: '90px', flexShrink: 0, flexGrow: 0, position: 'relative' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: COLORS.darkGray, lineHeight: 1.3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Data<br />Collection
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.375rem',
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: summary.readyCount === summary.totalAreas
              ? 'rgba(78, 205, 196, 0.1)'
              : 'rgba(74, 144, 226, 0.08)',
            border: `1px solid ${summary.readyCount === summary.totalAreas
              ? 'rgba(78, 205, 196, 0.4)'
              : 'rgba(74, 144, 226, 0.25)'
            }`
          }}>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: summary.readyCount === summary.totalAreas ? COLORS.incomeColor : COLORS.slainteBlue
            }}>
              {summary.readyCount}/{summary.totalAreas}
            </span>
            <span style={{ fontSize: '0.7rem', color: COLORS.mediumGray }}>complete</span>
          </div>
          {/* Data hover tooltip - absolutely positioned so it overflows right without shifting layout */}
          <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '0.5rem', zIndex: 10 }}>
            {renderDataTooltip()}
          </div>
        </div>
      </div>

      {/* Analysis annotation + Legend — same row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '1.5rem', marginTop: '-0.25rem', width: '100%', maxWidth: '720px' }}>
        {/* Analysis label (centred via flex) */}
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: COLORS.darkGray, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Analysis</div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.375rem',
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: summary.analyzableCount === summary.totalAreas
              ? 'rgba(78, 205, 196, 0.1)'
              : summary.analyzableCount > 0
                ? 'rgba(74, 144, 226, 0.08)'
                : 'rgba(113, 121, 133, 0.08)',
            border: `1px solid ${summary.analyzableCount === summary.totalAreas
              ? 'rgba(78, 205, 196, 0.4)'
              : summary.analyzableCount > 0
                ? 'rgba(74, 144, 226, 0.25)'
                : 'rgba(113, 121, 133, 0.25)'
            }`
          }}>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: summary.analyzableCount === summary.totalAreas
                ? COLORS.incomeColor
                : summary.analyzableCount > 0
                  ? COLORS.slainteBlue
                  : COLORS.mediumGray
            }}>
              {summary.analyzableCount}/{summary.totalAreas}
            </span>
            <span style={{ fontSize: '0.7rem', color: COLORS.mediumGray }}>analysed</span>
          </div>
          {/* Analysis hover tooltip — absolutely positioned to avoid layout shift */}
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: '0.5rem', zIndex: 10 }}>
            {renderAnalysisTooltip()}
          </div>
        </div>

        {/* Legend — right-aligned, same height as Analysis */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingTop: '0.15rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: COLORS.mediumGray }}>
            {[
              { color: STATUS_COLORS.ready, label: 'Ready' },
              { color: STATUS_COLORS.partial, label: 'Partial' },
              { color: STATUS_COLORS['no-data'], label: 'No data' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '2px',
                  backgroundColor: item.color
                }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularWorkflow;
