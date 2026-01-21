import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * TaskSection - Collapsible section for grouping tasks
 */
const TaskSection = ({
  title,
  icon: Icon,
  count,
  expanded,
  onToggle,
  color,
  onManage,
  manageLabel,
  children
}) => {
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: COLORS.backgroundGray
        }}
      >
        {/* Left side - Toggle and title */}
        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          {expanded ? (
            <ChevronDown style={{ width: '1rem', height: '1rem', color: COLORS.mediumGray }} />
          ) : (
            <ChevronRight style={{ width: '1rem', height: '1rem', color: COLORS.mediumGray }} />
          )}

          {Icon && (
            <div
              style={{
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: '0.375rem',
                backgroundColor: color?.bg || COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon style={{ width: '0.875rem', height: '0.875rem', color: color?.text || COLORS.mediumGray }} />
            </div>
          )}

          <span style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: COLORS.darkGray
          }}>
            {title}
          </span>

          {/* Count badge */}
          <div
            style={{
              backgroundColor: count > 0 ? (color?.bg || COLORS.backgroundGray) : COLORS.backgroundGray,
              color: count > 0 ? (color?.text || COLORS.mediumGray) : COLORS.mediumGray,
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {count}
          </div>
        </button>

        {/* Right side - Manage button */}
        {onManage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: COLORS.slainteBlue,
              borderRadius: '0.25rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {manageLabel || 'Manage'}
            <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>
        )}
      </div>

      {/* Section Content */}
      {expanded && (
        <div style={{ padding: '0.5rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default TaskSection;
