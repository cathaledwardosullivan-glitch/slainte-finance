/**
 * Website Analyzer for Practice Onboarding
 *
 * Uses Claude AI to analyze a practice website and extract:
 * - Practice name
 * - Locations/addresses
 * - GP names
 * - Services offered
 * - Practice manager (if mentioned)
 */

import { callClaude } from './claudeAPI.js';

/**
 * Analyze a practice website and extract information
 *
 * @param {string} url - The website URL to analyze
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object>} Extracted practice information
 */
export async function analyzeWebsite(url, apiKey) {
    try {
        // Ensure URL has protocol
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

        // Use the server-side website analysis endpoint
        const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
        let token = null;

        if (isElectron) {
            // Get dynamic internal token from Electron
            token = await window.electronAPI.getInternalToken();
        } else {
            token = typeof localStorage !== 'undefined' ? localStorage.getItem('partner_token') : null;
        }

        const response = await fetch("http://localhost:3001/api/analyze-website", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token || 'anonymous'}`
            },
            body: JSON.stringify({
                url: normalizedUrl
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Check if we have content
        if (!data.content || data.content.length === 0) {
            throw new Error('No response content from Claude');
        }

        const content = data.content[0].text;

        // Log the raw response for debugging
        console.log('Claude raw response:', content);

        // Parse JSON response
        let result;
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON found, return a helpful error
                console.error('No JSON in response. Full response:', content);
                return {
                    success: false,
                    error: 'Unable to analyze website. The website may not be accessible or may not contain the expected information. Please enter details manually.',
                    url: normalizedUrl
                };
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', content, parseError);
            return {
                success: false,
                error: 'Unable to analyze website. Please enter details manually.',
                url: normalizedUrl
            };
        }

        // Validate and normalize the result
        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Website analysis failed',
                url: normalizedUrl
            };
        }

        return {
            success: true,
            url: normalizedUrl,
            data: {
                practiceName: result.data.practiceName || '',
                locations: result.data.locations || [],
                gpNames: result.data.gpNames || [],
                services: {
                    dspPayments: result.data.services?.dsp || false,
                    methadoneServices: result.data.services?.methadone || false,
                    medservFees: result.data.services?.medserv || false,
                    icgpMembership: result.data.services?.icgp || false,
                    medicalCouncil: result.data.services?.medicalCouncil || false,
                    gms: result.data.services?.gms || false,
                    privateConsultations: result.data.services?.private || false,
                    vaccinations: result.data.services?.vaccinations || false
                },
                practiceManagerName: result.data.practiceManagerName || null,
                notes: result.data.notes || ''
            },
            confidence: result.confidence || 'unknown',
            warnings: result.warnings || []
        };

    } catch (error) {
        console.error('Website analysis error:', error);
        return {
            success: false,
            error: error.message || 'Failed to analyze website',
            url: url
        };
    }
}

/**
 * Validate a URL format
 */
export function isValidUrl(string) {
    try {
        // Try to construct URL
        const url = string.startsWith('http') ? new URL(string) : new URL(`https://${string}`);
        // Check if it has a valid domain
        return url.hostname.includes('.');
    } catch (_) {
        return false;
    }
}

/**
 * Format extracted data for display
 */
export function formatAnalysisResults(results) {
    if (!results.success) {
        return {
            title: '❌ Analysis Failed',
            message: results.error || 'Unable to analyze website',
            items: []
        };
    }

    const items = [];

    if (results.data.practiceName) {
        items.push({
            label: 'Practice Name',
            value: results.data.practiceName,
            editable: true
        });
    }

    if (results.data.locations?.length > 0) {
        items.push({
            label: 'Location(s)',
            value: results.data.locations.join('; '),
            editable: true,
            isList: true
        });
    }

    if (results.data.gpNames?.length > 0) {
        items.push({
            label: 'GPs Found',
            value: `${results.data.gpNames.length} GPs: ${results.data.gpNames.join(', ')}`,
            editable: false,
            note: 'We\'ll ask you to identify which are partners vs. salaried next.'
        });
    }

    // Services found
    const servicesFound = Object.entries(results.data.services)
        .filter(([_, value]) => value === true)
        .map(([key, _]) => key);

    if (servicesFound.length > 0) {
        items.push({
            label: 'Services Detected',
            value: servicesFound.join(', '),
            editable: true
        });
    }

    if (results.data.practiceManagerName) {
        items.push({
            label: 'Practice Manager',
            value: results.data.practiceManagerName,
            editable: true
        });
    }

    if (results.warnings?.length > 0) {
        items.push({
            label: 'Notes',
            value: results.warnings.join('; '),
            isWarning: true
        });
    }

    return {
        title: `✓ Found Information (${results.confidence} confidence)`,
        message: 'Please review and correct anything that\'s wrong:',
        items: items,
        confidence: results.confidence
    };
}
