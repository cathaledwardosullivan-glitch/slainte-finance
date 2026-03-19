import React from 'react';
import COLORS from '../../utils/colors';
import { AREAS } from '../NewGMSHealthCheck/useAreaReadiness';

const STATUS_COLORS = {
  ready: COLORS.success,
  partial: COLORS.highlightYellow,
  'no-data': COLORS.borderLight
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

/**
 * MiniDonut - Simplified 6-segment progress indicator for GMS areas.
 * Colored by readiness status: green (ready), amber (partial), grey (no-data).
 */
const MiniDonut = ({ readiness, size = 80 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.6;
  const gap = 4; // degrees between segments
  const totalGap = gap * AREAS.length;
  const segmentSpan = (360 - totalGap) / AREAS.length;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {AREAS.map((area, i) => {
        const startAngle = i * (segmentSpan + gap);
        const endAngle = startAngle + segmentSpan;
        const status = readiness?.[area.id]?.status || 'no-data';
        const fill = STATUS_COLORS[status] || STATUS_COLORS['no-data'];

        return (
          <path
            key={area.id}
            d={describeArc(cx, cy, outerR, innerR, startAngle, endAngle)}
            fill={fill}
            stroke="none"
          >
            <title>{area.description}: {status === 'ready' ? 'Complete' : status === 'partial' ? 'Partial data' : 'No data'}</title>
          </path>
        );
      })}
    </svg>
  );
};

export default MiniDonut;
