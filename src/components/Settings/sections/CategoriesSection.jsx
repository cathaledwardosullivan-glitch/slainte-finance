import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Wand2,
  DollarSign,
  Receipt,
  Ban
} from 'lucide-react';
import COLORS from '../../../utils/colors';
import CategoryRefinementWizard from '../../CategoryRefinementWizard';

// Map sections to broad expense categories
const EXPENSE_BROAD_CATEGORIES = {
  'Staff Costs': ['DIRECT STAFF COSTS'],
  'Premises': ['PREMISES COSTS'],
  'Professional Fees': ['PROFESSIONAL FEES', 'PROFESSIONAL DEV'],
  'Medical Supplies': ['MEDICAL SUPPLIES'],
  'Office & IT': ['OFFICE & IT'],
  'Petty Cash / Other': ['MOTOR & TRANSPORT', 'CAPITAL & DEPRECIATION', 'PETTY CASH / OTHER EXPENSES']
};

/**
 * CategoriesSection - Transaction Categorisation for Settings Modal
 * Hierarchical collapsible structure: Type → Broad Category → Subcategory → Identifiers
 */
const CategoriesSection = () => {
  const {
    categoryMapping,
    setCategoryMapping
  } = useAppContext();

  // Collapsible section states - all collapsed by default
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [nonBusinessExpanded, setNonBusinessExpanded] = useState(false);

  // Expanded broad categories for expenses
  const [expandedBroadCategories, setExpandedBroadCategories] = useState({});

  // Expanded subcategories (for viewing/editing identifiers)
  const [expandedSubcategory, setExpandedSubcategory] = useState(null);

  // Identifier management state
  const [addingIdentifierTo, setAddingIdentifierTo] = useState(null);
  const [newIdentifier, setNewIdentifier] = useState('');

  // Refinement Wizard modal
  const [showRefinementWizard, setShowRefinementWizard] = useState(false);

  // Group categories by type
  const categoriesByType = useMemo(() => {
    const groups = {
      income: [],
      expense: [],
      'non-business': []
    };

    categoryMapping.forEach(cat => {
      const type = cat.type || 'expense';
      if (groups[type]) {
        groups[type].push(cat);
      } else {
        groups.expense.push(cat);
      }
    });

    return groups;
  }, [categoryMapping]);

  // Group expense categories by broad category
  const expensesByBroadCategory = useMemo(() => {
    const result = {};

    Object.entries(EXPENSE_BROAD_CATEGORIES).forEach(([broadName, sections]) => {
      result[broadName] = categoriesByType.expense.filter(cat =>
        sections.includes(cat.section)
      ).sort((a, b) => a.name.localeCompare(b.name));
    });

    return result;
  }, [categoriesByType.expense]);

  // Handle adding identifier
  const handleAddIdentifier = (categoryCode) => {
    if (!newIdentifier.trim()) return;

    const updatedMapping = categoryMapping.map(cat => {
      if (cat.code === categoryCode) {
        const existingIdentifiers = cat.identifiers || [];
        const newId = newIdentifier.trim().toLowerCase();
        if (!existingIdentifiers.includes(newId)) {
          return {
            ...cat,
            identifiers: [...existingIdentifiers, newId]
          };
        }
      }
      return cat;
    });
    setCategoryMapping(updatedMapping);
    setNewIdentifier('');
    setAddingIdentifierTo(null);
  };

  // Handle removing identifier
  const handleRemoveIdentifier = (categoryCode, identifier) => {
    const updatedMapping = categoryMapping.map(cat => {
      if (cat.code === categoryCode) {
        return {
          ...cat,
          identifiers: (cat.identifiers || []).filter(i => i !== identifier)
        };
      }
      return cat;
    });
    setCategoryMapping(updatedMapping);
  };

  // Toggle broad category expansion
  const toggleBroadCategory = (broadName) => {
    setExpandedBroadCategories(prev => ({
      ...prev,
      [broadName]: !prev[broadName]
    }));
  };

  // Render identifiers section for a category
  const renderIdentifiers = (category) => {
    const isExpanded = expandedSubcategory === category.code;
    const identifierCount = category.identifiers?.length || 0;

    return (
      <div
        key={category.code}
        style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: '0.375rem',
          marginBottom: '0.5rem'
        }}
      >
        {/* Subcategory Header */}
        <button
          onClick={() => setExpandedSubcategory(isExpanded ? null : category.code)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 0.75rem',
            backgroundColor: isExpanded ? COLORS.bgPage : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isExpanded ? (
              <ChevronDown style={{ width: '0.875rem', height: '0.875rem', color: COLORS.textSecondary }} />
            ) : (
              <ChevronRight style={{ width: '0.875rem', height: '0.875rem', color: COLORS.textSecondary }} />
            )}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.textPrimary }}>{category.name}</span>
          </div>
          <span
            style={{
              fontSize: '0.6875rem',
              color: COLORS.textSecondary,
              backgroundColor: COLORS.bgPage,
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px'
            }}
          >
            {identifierCount}
          </span>
        </button>

        {/* Identifiers Content */}
        {isExpanded && (
          <div style={{ padding: '0.75rem', borderTop: `1px solid ${COLORS.borderLight}` }}>
            {/* Identifiers List */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
              {(category.identifiers || []).map((identifier, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: COLORS.bgPage,
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: COLORS.textPrimary
                  }}
                >
                  {identifier}
                  <button
                    onClick={() => handleRemoveIdentifier(category.code, identifier)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                    title="Remove identifier"
                  >
                    <X style={{ width: '0.75rem', height: '0.75rem', color: COLORS.textSecondary }} />
                  </button>
                </span>
              ))}
              {identifierCount === 0 && (
                <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary, fontStyle: 'italic' }}>
                  No identifiers set
                </span>
              )}
            </div>

            {/* Add Identifier */}
            {addingIdentifierTo === category.code ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newIdentifier}
                  onChange={(e) => setNewIdentifier(e.target.value)}
                  placeholder="Enter identifier..."
                  style={{
                    flex: 1,
                    padding: '0.375rem 0.5rem',
                    border: `1px solid ${COLORS.borderLight}`,
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddIdentifier(category.code);
                    if (e.key === 'Escape') {
                      setAddingIdentifierTo(null);
                      setNewIdentifier('');
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleAddIdentifier(category.code)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: COLORS.slainteBlue,
                    color: COLORS.white,
                    border: 'none',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setAddingIdentifierTo(null);
                    setNewIdentifier('');
                  }}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: COLORS.bgPage,
                    color: COLORS.textPrimary,
                    border: `1px solid ${COLORS.borderLight}`,
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingIdentifierTo(category.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'transparent',
                  color: COLORS.slainteBlue,
                  border: `1px dashed ${COLORS.slainteBlue}`,
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                <Plus style={{ width: '0.75rem', height: '0.75rem' }} />
                Add Identifier
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render broad expense category (collapsible)
  const renderBroadExpenseCategory = (broadName, categories) => {
    const isExpanded = expandedBroadCategories[broadName];
    const totalIdentifiers = categories.reduce((sum, cat) => sum + (cat.identifiers?.length || 0), 0);

    return (
      <div
        key={broadName}
        style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: '0.5rem',
          marginBottom: '0.75rem'
        }}
      >
        {/* Broad Category Header */}
        <button
          onClick={() => toggleBroadCategory(broadName)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            backgroundColor: isExpanded ? `${COLORS.expenseColor}10` : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            borderRadius: isExpanded ? '0.5rem 0.5rem 0 0' : '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isExpanded ? (
              <ChevronDown style={{ width: '1rem', height: '1rem', color: COLORS.expenseColor }} />
            ) : (
              <ChevronRight style={{ width: '1rem', height: '1rem', color: COLORS.expenseColor }} />
            )}
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: COLORS.textPrimary }}>{broadName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
              {categories.length} categories
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                color: COLORS.textSecondary,
                backgroundColor: COLORS.bgPage,
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px'
              }}
            >
              {totalIdentifiers} identifiers
            </span>
          </div>
        </button>

        {/* Subcategories */}
        {isExpanded && (
          <div style={{ padding: '0.75rem', borderTop: `1px solid ${COLORS.borderLight}` }}>
            {categories.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, fontStyle: 'italic', margin: 0 }}>
                No categories
              </p>
            ) : (
              categories.map(renderIdentifiers)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Category Refinement Wizard CTA */}
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: `linear-gradient(135deg, ${COLORS.slainteBlue}15, ${COLORS.incomeColor}15)`,
          border: `2px solid ${COLORS.slainteBlue}40`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: COLORS.textPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wand2 style={{ width: '1.25rem', height: '1.25rem', color: COLORS.slainteBlue }} />
              Category Refinement Wizard
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.textSecondary }}>
              Quickly categorise partially classified transactions with AI-powered suggestions
            </p>
          </div>
          <button
            onClick={() => setShowRefinementWizard(true)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            <Wand2 style={{ width: '1rem', height: '1rem' }} />
            Run Wizard
          </button>
        </div>
      </div>

      {/* Income Section */}
      <div
        style={{
          marginBottom: '1rem',
          borderRadius: '0.75rem',
          border: `2px solid ${COLORS.incomeColor}`,
          overflow: 'hidden'
        }}
      >
        <button
          onClick={() => setIncomeExpanded(!incomeExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            backgroundColor: `${COLORS.incomeColor}15`,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {incomeExpanded ? (
              <ChevronDown style={{ width: '1.25rem', height: '1.25rem', color: COLORS.incomeColor }} />
            ) : (
              <ChevronRight style={{ width: '1.25rem', height: '1.25rem', color: COLORS.incomeColor }} />
            )}
            <DollarSign style={{ width: '1.25rem', height: '1.25rem', color: COLORS.incomeColor }} />
            <span style={{ fontSize: '1.0625rem', fontWeight: 600, color: COLORS.textPrimary }}>Income</span>
          </div>
          <span style={{ fontSize: '0.875rem', color: COLORS.incomeColor, fontWeight: 500 }}>
            {categoriesByType.income.length} categories
          </span>
        </button>

        {incomeExpanded && (
          <div style={{ padding: '1rem', backgroundColor: COLORS.white }}>
            {categoriesByType.income.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, fontStyle: 'italic', margin: 0 }}>
                No income categories
              </p>
            ) : (
              categoriesByType.income
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(renderIdentifiers)
            )}
          </div>
        )}
      </div>

      {/* Expenses Section */}
      <div
        style={{
          marginBottom: '1rem',
          borderRadius: '0.75rem',
          border: `2px solid ${COLORS.expenseColor}`,
          overflow: 'hidden'
        }}
      >
        <button
          onClick={() => setExpensesExpanded(!expensesExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            backgroundColor: `${COLORS.expenseColor}15`,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {expensesExpanded ? (
              <ChevronDown style={{ width: '1.25rem', height: '1.25rem', color: COLORS.expenseColor }} />
            ) : (
              <ChevronRight style={{ width: '1.25rem', height: '1.25rem', color: COLORS.expenseColor }} />
            )}
            <Receipt style={{ width: '1.25rem', height: '1.25rem', color: COLORS.expenseColor }} />
            <span style={{ fontSize: '1.0625rem', fontWeight: 600, color: COLORS.textPrimary }}>Expenses</span>
          </div>
          <span style={{ fontSize: '0.875rem', color: COLORS.expenseColor, fontWeight: 500 }}>
            {categoriesByType.expense.length} categories
          </span>
        </button>

        {expensesExpanded && (
          <div style={{ padding: '1rem', backgroundColor: COLORS.white }}>
            {Object.entries(expensesByBroadCategory).map(([broadName, categories]) =>
              renderBroadExpenseCategory(broadName, categories)
            )}
          </div>
        )}
      </div>

      {/* Non-Business Section */}
      <div
        style={{
          marginBottom: '1rem',
          borderRadius: '0.75rem',
          border: `2px solid ${COLORS.textSecondary}`,
          overflow: 'hidden'
        }}
      >
        <button
          onClick={() => setNonBusinessExpanded(!nonBusinessExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            backgroundColor: `${COLORS.textSecondary}15`,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {nonBusinessExpanded ? (
              <ChevronDown style={{ width: '1.25rem', height: '1.25rem', color: COLORS.textSecondary }} />
            ) : (
              <ChevronRight style={{ width: '1.25rem', height: '1.25rem', color: COLORS.textSecondary }} />
            )}
            <Ban style={{ width: '1.25rem', height: '1.25rem', color: COLORS.textSecondary }} />
            <span style={{ fontSize: '1.0625rem', fontWeight: 600, color: COLORS.textPrimary }}>Non-Business Items</span>
          </div>
          <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary, fontWeight: 500 }}>
            {categoriesByType['non-business'].length} categories
          </span>
        </button>

        {nonBusinessExpanded && (
          <div style={{ padding: '1rem', backgroundColor: COLORS.white }}>
            {categoriesByType['non-business'].length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, fontStyle: 'italic', margin: 0 }}>
                No non-business categories
              </p>
            ) : (
              categoriesByType['non-business']
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(renderIdentifiers)
            )}
          </div>
        )}
      </div>

      {/* Refinement Wizard Modal */}
      {showRefinementWizard && (
        <CategoryRefinementWizard
          isOpen={showRefinementWizard}
          onClose={() => setShowRefinementWizard(false)}
        />
      )}
    </div>
  );
};

export default CategoriesSection;
