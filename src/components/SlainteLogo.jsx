import React from 'react';
import COLORS from '../utils/colors';

const SlainteLogo = ({ size = 'normal', showFinance = true }) => {
  const dimensions = {
    small: {
      width: 120,
      height: showFinance ? 50 : 35,
      fontSize: 36,
      subFontSize: 14,
      subY: 46
    },
    normal: {
      width: 180,
      height: showFinance ? 75 : 48,
      fontSize: 48,
      subFontSize: 20,
      subY: 68
    },
    large: {
      width: 240,
      height: showFinance ? 100 : 64,
      fontSize: 64,
      subFontSize: 28,
      subY: 92
    }
  };

  const { width, height, fontSize, subFontSize, subY } = dimensions[size];
  const viewBoxHeight = showFinance ? 100 : 60;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 240 ${viewBoxHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      {/* Main logo text: sl[Ai]nte */}
      <text
        x="0"
        y="45"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="700"
        letterSpacing="-1"
      >
        <tspan fill={COLORS.darkGray}>sl</tspan>
        <tspan fill={COLORS.slainteBlue}>[Ai]</tspan>
        <tspan fill={COLORS.darkGray}>nte</tspan>
      </text>

      {/* Finance subtitle - conditional */}
      {showFinance && (
        <text
          x="52"
          y={subY}
          fill={COLORS.slainteBlue}
          fontSize={subFontSize}
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontWeight="500"
        >
          Finance
        </text>
      )}
    </svg>
  );
};

export default SlainteLogo;
