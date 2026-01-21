/**
 * usePracticeProfile Hook
 *
 * React hook for managing practice profile state and operations.
 * Provides a clean interface for components to interact with the practice profile.
 */

import { useState, useEffect, useCallback } from 'react';
import * as storage from '../storage/practiceProfileStorage';
import {
    getProfileCompleteness,
    getProfileSummary,
    isSetupComplete,
    getMissingRequiredFields,
    calculateTotalExpenses
} from '../data/practiceProfileSchema';
import { buildCiaranContext, buildContextSummary, hasMinimumContext } from '../utils/ciaranContextBuilder';

export function usePracticeProfile() {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Load profile from storage on mount
     */
    useEffect(() => {
        loadProfile();
    }, []);

    /**
     * Load profile from localStorage
     */
    const loadProfile = useCallback(() => {
        try {
            setIsLoading(true);
            setError(null);

            const loadedProfile = storage.get();

            if (!loadedProfile) {
                // No profile exists, create empty one and save it
                const emptyProfile = storage.createEmpty();
                storage.save(emptyProfile);
                setProfile(emptyProfile);
            } else {
                setProfile(loadedProfile);
            }
        } catch (err) {
            console.error('Error loading practice profile:', err);
            setError('Failed to load practice profile');
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Save profile to storage
     */
    const saveProfile = useCallback((updatedProfile) => {
        try {
            setError(null);

            // Auto-calculate total expenses if individual expenses are provided
            if (updatedProfile.expenses) {
                updatedProfile.expenses.totalAnnualExpenses = calculateTotalExpenses(updatedProfile.expenses);
            }

            const success = storage.save(updatedProfile);

            if (success) {
                setProfile(updatedProfile);
                return true;
            } else {
                setError('Failed to save practice profile');
                return false;
            }
        } catch (err) {
            console.error('Error saving practice profile:', err);
            setError('Failed to save practice profile');
            return false;
        }
    }, []);

    /**
     * Update specific fields in profile
     */
    const updateProfile = useCallback((updates) => {
        try {
            setError(null);

            const success = storage.update(updates);

            if (success) {
                const updatedProfile = storage.get();
                setProfile(updatedProfile);
                return true;
            } else {
                setError('Failed to update practice profile');
                return false;
            }
        } catch (err) {
            console.error('Error updating practice profile:', err);
            setError('Failed to update practice profile');
            return false;
        }
    }, []);

    /**
     * Mark setup as complete
     */
    const completeSetup = useCallback(() => {
        try {
            setError(null);

            const success = storage.completeSetup();

            if (success) {
                const updatedProfile = storage.get();
                setProfile(updatedProfile);
                return true;
            } else {
                setError('Failed to complete setup');
                return false;
            }
        } catch (err) {
            console.error('Error completing setup:', err);
            setError('Failed to complete setup');
            return false;
        }
    }, []);

    /**
     * Clear all profile data
     */
    const clearProfile = useCallback(() => {
        try {
            setError(null);

            const success = storage.clear();

            if (success) {
                const emptyProfile = storage.createEmpty();
                setProfile(emptyProfile);
                return true;
            } else {
                setError('Failed to clear practice profile');
                return false;
            }
        } catch (err) {
            console.error('Error clearing practice profile:', err);
            setError('Failed to clear practice profile');
            return false;
        }
    }, []);

    /**
     * Export profile as JSON
     */
    const exportProfile = useCallback(() => {
        try {
            setError(null);
            return storage.exportProfile();
        } catch (err) {
            console.error('Error exporting practice profile:', err);
            setError('Failed to export practice profile');
            return null;
        }
    }, []);

    /**
     * Import profile from JSON
     */
    const importProfile = useCallback((jsonString) => {
        try {
            setError(null);

            const success = storage.importProfile(jsonString);

            if (success) {
                loadProfile();
                return true;
            } else {
                setError('Failed to import practice profile');
                return false;
            }
        } catch (err) {
            console.error('Error importing practice profile:', err);
            setError('Failed to import practice profile');
            return false;
        }
    }, [loadProfile]);

    /**
     * Get Finn's system context
     */
    const getCiaranContext = useCallback(() => {
        return buildCiaranContext(profile);
    }, [profile]);

    /**
     * Get context summary for UI
     */
    const getContextSummary = useCallback(() => {
        return buildContextSummary(profile);
    }, [profile]);

    /**
     * Check if setup is complete
     */
    const setupComplete = profile ? isSetupComplete(profile) : false;

    /**
     * Get profile completeness percentage
     */
    const completeness = profile ? getProfileCompleteness(profile) : 0;

    /**
     * Get profile summary
     */
    const summary = profile ? getProfileSummary(profile) : 'No profile';

    /**
     * Get missing required fields
     */
    const missingFields = profile ? getMissingRequiredFields(profile) : [];

    /**
     * Check if profile has minimum context
     */
    const hasContext = profile ? hasMinimumContext(profile) : false;

    return {
        // State
        profile,
        isLoading,
        error,

        // Actions
        loadProfile,
        saveProfile,
        updateProfile,
        completeSetup,
        clearProfile,
        exportProfile,
        importProfile,

        // Computed values
        setupComplete,
        completeness,
        summary,
        missingFields,
        hasContext,

        // Context builders
        getCiaranContext,
        getContextSummary,
    };
}
