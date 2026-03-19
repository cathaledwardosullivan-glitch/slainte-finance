import React, { useState } from 'react';
import { CheckCircle, Check } from 'lucide-react';
import COLORS from '../utils/colors';
import { PARENT_CATEGORIES, getSubcategoriesForParent } from '../utils/parentCategoryMapping';

/**
 * SimpleCategoryPicker - Step 1 Categorization
 *
 * Shows only 7 high-level parent categories for quick, simple categorization.
 * Users can drill down to subcategories later during P&L refinement.
 * Click once to highlight (green), click again to confirm selection.
 */
export default function SimpleCategoryPicker({
  transaction,
  onCategorySelect,
  categoryMapping,
  showStaffMembers = true // Show individual staff members for staff costs
}) {
  const [selectedParent, setSelectedParent] = useState(null);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null); // For click-to-confirm

  // Get staff categories (personalized ones)
  const staffCategories = categoryMapping.filter(c =>
    c.personalization === 'Personalized' &&
    c.section === 'DIRECT STAFF COSTS'
  );

  const handleParentSelect = (parentId) => {
    const parent = PARENT_CATEGORIES[parentId];

    // Special handling for STAFF - show staff member picker
    if (parentId === 'STAFF' && showStaffMembers && staffCategories.length > 0) {
      setSelectedParent(parentId);
      setShowStaffPicker(true);
      setPendingSelection(null);
    } else {
      // Click-to-confirm: first click highlights, second click confirms
      if (pendingSelection === parentId) {
        // Second click - confirm selection
        onCategorySelect(parent.defaultCategory);
        setPendingSelection(null);
      } else {
        // First click - highlight this category
        setPendingSelection(parentId);
      }
    }
  };

  const [pendingStaffSelection, setPendingStaffSelection] = useState(null);

  const handleStaffSelect = (categoryCode) => {
    // Click-to-confirm for staff too
    if (pendingStaffSelection === categoryCode) {
      onCategorySelect(categoryCode);
      setShowStaffPicker(false);
      setPendingStaffSelection(null);
    } else {
      setPendingStaffSelection(categoryCode);
    }
  };

  const handleStaffUnclassified = () => {
    if (pendingStaffSelection === '2.0') {
      onCategorySelect('2.0'); // Staff Costs Unclassified
      setShowStaffPicker(false);
      setPendingStaffSelection(null);
    } else {
      setPendingStaffSelection('2.0');
    }
  };

  // If showing staff picker
  if (showStaffPicker && selectedParent === 'STAFF') {
    return (
      <div>
        {/* Header - compact */}
        <div style={{
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: COLORS.textPrimary
          }}>
            Which staff member?
          </h3>
          <button
            onClick={() => {
              setShowStaffPicker(false);
              setSelectedParent(null);
              setPendingStaffSelection(null);
            }}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: COLORS.slainteBlue
            }}
          >
            ← Back
          </button>
        </div>

        {/* Staff Member Grid - compact */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          {staffCategories.map(category => {
            const isPending = pendingStaffSelection === category.code;
            return (
              <button
                key={category.code}
                onClick={() => handleStaffSelect(category.code)}
                style={{
                  padding: '0.5rem 0.625rem',
                  backgroundColor: isPending ? COLORS.incomeColor : COLORS.white,
                  border: `2px solid ${isPending ? COLORS.incomeColor : COLORS.borderLight}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isPending) {
                    e.currentTarget.style.borderColor = COLORS.slainteBlue;
                    e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}08`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPending) {
                    e.currentTarget.style.borderColor = COLORS.borderLight;
                    e.currentTarget.style.backgroundColor = COLORS.white;
                  }
                }}
              >
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isPending ? COLORS.white : COLORS.textPrimary
                }}>
                  {category.staffMember || category.name}
                </div>
                {isPending && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    color: COLORS.white,
                    marginTop: '0.125rem'
                  }}>
                    <Check style={{ width: '10px', height: '10px' }} />
                    Click to Confirm
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Unclassified option */}
        {(() => {
          const isPending = pendingStaffSelection === '2.0';
          return (
            <button
              onClick={handleStaffUnclassified}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: isPending ? COLORS.incomeColor : COLORS.bgPage,
                border: `1px solid ${isPending ? COLORS.incomeColor : COLORS.borderLight}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: isPending ? COLORS.white : COLORS.textSecondary,
                textAlign: 'center',
                transition: 'all 0.15s'
              }}
            >
              {isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Check style={{ width: '10px', height: '10px' }} />
                  Click to Confirm Unclassified
                </span>
              ) : (
                "Not sure - Unclassified"
              )}
            </button>
          );
        })()}
      </div>
    );
  }

  // Main parent category picker
  return (
    <div>
      {/* Header - compact */}
      <div style={{
        marginBottom: '0.75rem',
        paddingBottom: '0.5rem',
        borderBottom: `1px solid ${COLORS.borderLight}`
      }}>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: COLORS.textPrimary
        }}>
          Select a category:
        </h3>
      </div>

      {/* Parent Category Grid - compact boxes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.5rem'
      }}>
        {Object.values(PARENT_CATEGORIES).map(parent => {
          const isPending = pendingSelection === parent.id;

          return (
            <button
              key={parent.id}
              onClick={() => handleParentSelect(parent.id)}
              style={{
                padding: isPending ? '0.625rem 0.5rem' : '0.75rem 0.5rem',
                backgroundColor: isPending ? COLORS.incomeColor : COLORS.white,
                border: `2px solid ${isPending ? COLORS.incomeColor : COLORS.borderLight}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isPending) {
                  e.currentTarget.style.borderColor = parent.color;
                  e.currentTarget.style.backgroundColor = `${parent.color}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isPending) {
                  e.currentTarget.style.borderColor = COLORS.borderLight;
                  e.currentTarget.style.backgroundColor = COLORS.white;
                }
              }}
            >
              {/* Icon - smaller */}
              <div style={{
                fontSize: '1.25rem'
              }}>
                {parent.icon}
              </div>

              {/* Name */}
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: isPending ? COLORS.white : COLORS.textPrimary,
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {parent.name}
              </div>

              {/* Click to confirm message when pending */}
              {isPending && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  marginTop: '0.125rem'
                }}>
                  <Check style={{ width: '12px', height: '12px' }} />
                  Click to Confirm
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
