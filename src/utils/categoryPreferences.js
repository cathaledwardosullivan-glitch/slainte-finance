/**
 * Category Preferences Utility
 *
 * Manages which categories are visible to the user during transaction categorization.
 * Supports:
 * - Hiding rarely-used categories to reduce cognitive load
 * - Saving/loading preferences from localStorage
 * - Default visibility rules based on category type
 */

const STORAGE_KEY = 'slainte_category_preferences';

/**
 * Default visibility rules for categories
 * Categories marked as "Personalize" or parent categories are hidden by default
 */
const getDefaultVisibility = (category) => {
    // Hide parent categories (they're organizational only)
    if (!category.code.includes('.')) {
        return false;
    }

    // Hide categories marked for personalization (e.g., GP Locum Fees with specific names)
    if (category.personalization === 'Personalize') {
        return false;
    }

    // Show all other categories by default
    return true;
};

/**
 * Load category preferences from localStorage
 * Returns a map of category codes to visibility status
 *
 * @returns {Object} Map of categoryCode -> boolean (visible)
 */
export const loadCategoryPreferences = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return {};
        }

        const parsed = JSON.parse(saved);
        console.log(`✓ Loaded category preferences: ${Object.keys(parsed).length} custom settings`);
        return parsed;
    } catch (error) {
        console.error('Error loading category preferences:', error);
        return {};
    }
};

/**
 * Save category preferences to localStorage
 *
 * @param {Object} preferences - Map of categoryCode -> boolean (visible)
 */
export const saveCategoryPreferences = (preferences) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        console.log(`✓ Saved category preferences: ${Object.keys(preferences).length} categories`);
    } catch (error) {
        console.error('Error saving category preferences:', error);
    }
};

/**
 * Get filtered categories based on user preferences
 *
 * @param {Array} allCategories - All available categories
 * @param {Object} preferences - User's category preferences (optional, will load from storage if not provided)
 * @param {boolean} showAll - If true, ignore preferences and show all categories
 * @returns {Array} Filtered list of categories
 */
export const getVisibleCategories = (allCategories, preferences = null, showAll = false) => {
    // If showAll is true, return all non-parent categories
    if (showAll) {
        return allCategories.filter(cat => cat.code.includes('.'));
    }

    // Load preferences if not provided
    const prefs = preferences || loadCategoryPreferences();

    // Filter categories based on preferences
    return allCategories.filter(category => {
        // Always hide parent categories (no decimal in code)
        if (!category.code.includes('.')) {
            return false;
        }

        // Check if user has a preference for this category
        if (prefs.hasOwnProperty(category.code)) {
            return prefs[category.code];
        }

        // Use default visibility rules
        return getDefaultVisibility(category);
    });
};

/**
 * Toggle visibility of a specific category
 *
 * @param {string} categoryCode - The category code to toggle
 * @param {Object} currentPreferences - Current preferences object
 * @returns {Object} Updated preferences object
 */
export const toggleCategoryVisibility = (categoryCode, currentPreferences) => {
    const newPreferences = { ...currentPreferences };

    // If preference exists, toggle it
    if (newPreferences.hasOwnProperty(categoryCode)) {
        newPreferences[categoryCode] = !newPreferences[categoryCode];
    } else {
        // If no preference exists, set opposite of default
        // We need the category object to determine default, so we'll set to hidden
        // (since most categories are visible by default, toggling means hiding)
        newPreferences[categoryCode] = false;
    }

    return newPreferences;
};

/**
 * Set visibility for a specific category
 *
 * @param {string} categoryCode - The category code
 * @param {boolean} visible - Whether the category should be visible
 * @param {Object} currentPreferences - Current preferences object
 * @returns {Object} Updated preferences object
 */
export const setCategoryVisibility = (categoryCode, visible, currentPreferences) => {
    return {
        ...currentPreferences,
        [categoryCode]: visible
    };
};

/**
 * Reset all preferences to defaults
 *
 * @returns {Object} Empty preferences object (will use defaults)
 */
export const resetCategoryPreferences = () => {
    localStorage.removeItem(STORAGE_KEY);
    console.log('✓ Reset category preferences to defaults');
    return {};
};

/**
 * Get categories grouped by section for preference management UI
 *
 * @param {Array} allCategories - All available categories
 * @param {Object} preferences - User's category preferences
 * @returns {Object} Categories grouped by section with visibility status
 */
export const getCategoriesBySection = (allCategories, preferences = null) => {
    const prefs = preferences || loadCategoryPreferences();
    const sections = {};

    allCategories.forEach(category => {
        // Skip parent categories
        if (!category.code.includes('.')) {
            return;
        }

        const section = category.section;
        if (!sections[section]) {
            sections[section] = [];
        }

        // Determine visibility
        let visible;
        if (prefs.hasOwnProperty(category.code)) {
            visible = prefs[category.code];
        } else {
            visible = getDefaultVisibility(category);
        }

        sections[section].push({
            ...category,
            visible
        });
    });

    return sections;
};

/**
 * Initialize preferences for a new user
 * Sets intelligent defaults based on category usage patterns
 *
 * @param {Array} allCategories - All available categories
 * @returns {Object} Initial preferences object
 */
export const initializeDefaultPreferences = (allCategories) => {
    const preferences = {};

    allCategories.forEach(category => {
        // Skip parent categories
        if (!category.code.includes('.')) {
            return;
        }

        // Set default visibility
        const visible = getDefaultVisibility(category);

        // Only store non-default values to keep storage lean
        // (Default is true for most categories)
        if (!visible) {
            preferences[category.code] = visible;
        }
    });

    saveCategoryPreferences(preferences);
    return preferences;
};

/**
 * Count how many categories are visible vs total
 *
 * @param {Array} allCategories - All available categories
 * @param {Object} preferences - User's category preferences
 * @returns {Object} { visible: number, total: number, hidden: number }
 */
export const getCategoryVisibilityStats = (allCategories, preferences = null) => {
    const prefs = preferences || loadCategoryPreferences();

    const subcategories = allCategories.filter(cat => cat.code.includes('.'));
    const total = subcategories.length;

    let visible = 0;
    subcategories.forEach(category => {
        const isVisible = prefs.hasOwnProperty(category.code)
            ? prefs[category.code]
            : getDefaultVisibility(category);

        if (isVisible) {
            visible++;
        }
    });

    return {
        visible,
        total,
        hidden: total - visible
    };
};
