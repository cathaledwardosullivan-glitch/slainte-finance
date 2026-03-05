/**
 * Dara Context Builder
 *
 * Builds system prompts and retrieves relevant EHR knowledge sections
 * for the Dara Virtual IT Support agent.
 *
 * Uses simple keyword matching to find relevant topics from the
 * curated EHR knowledge base, then constructs a context block
 * for the Claude API call.
 */

import { EHR_KNOWLEDGE } from '../data/ehrKnowledge';

/**
 * Common stop words to exclude from keyword matching
 */
const STOP_WORDS = new Set([
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'from', 'is', 'am', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
    'shall', 'not', 'no', 'if', 'then', 'than', 'that', 'this',
    'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some',
    'any', 'other', 'into', 'through', 'during', 'about', 'between',
    'after', 'before', 'above', 'below', 'up', 'down', 'out', 'off',
    'over', 'under', 'again', 'further', 'once', 'here', 'there',
    'just', 'also', 'very', 'too', 'so', 'only', 'own', 'same',
    'get', 'got', 'go', 'going', 'want', 'need', 'know', 'like',
    'please', 'help', 'thanks', 'thank', 'hi', 'hello', 'hey'
]);

/**
 * Tokenise a query string into meaningful keywords
 * @param {string} text - Input text
 * @returns {string[]} Array of lowercase keyword tokens
 */
function tokenise(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2 && !STOP_WORDS.has(word));
}

/**
 * Score a topic against a set of query tokens
 * @param {Object} topic - Topic object with keywords array
 * @param {string[]} queryTokens - Tokenised query
 * @returns {number} Relevance score
 */
function scoreTopic(topic, queryTokens) {
    let score = 0;

    const topicKeywords = topic.keywords.map(k => k.toLowerCase());

    for (const token of queryTokens) {
        for (const keyword of topicKeywords) {
            // Exact match scores highest
            if (token === keyword) {
                score += 3;
            }
            // Token contains keyword or keyword contains token
            else if (token.includes(keyword) || keyword.includes(token)) {
                score += 2;
            }
        }

        // Also check title words
        const titleWords = topic.title.toLowerCase().split(/\s+/);
        for (const titleWord of titleWords) {
            if (token === titleWord) {
                score += 2;
            } else if (token.includes(titleWord) || titleWord.includes(token)) {
                score += 1;
            }
        }
    }

    return score;
}

/**
 * Find relevant knowledge sections for a user query
 *
 * @param {string} query - User's question
 * @param {string} ehrSystem - 'socrates' | 'healthone' | 'practicemanager' | 'completegp'
 * @param {number} maxTopics - Maximum number of topics to return (default 5)
 * @returns {string} Markdown context block with relevant sections
 */
export function buildDaraContext(query, ehrSystem, maxTopics = 5) {
    const queryTokens = tokenise(query);
    if (queryTokens.length === 0) return '';

    // Get EHR-specific topics
    const ehrData = EHR_KNOWLEDGE[ehrSystem];
    const generalData = EHR_KNOWLEDGE.general;

    if (!ehrData && !generalData) return '';

    // Score all topics
    const scoredTopics = [];

    if (ehrData?.topics) {
        for (const topic of ehrData.topics) {
            const score = scoreTopic(topic, queryTokens);
            if (score > 0) {
                scoredTopics.push({
                    ...topic,
                    score,
                    source: ehrData.name || ehrSystem
                });
            }
        }
    }

    // Also check Pippo topics (available for Socrates and HPM users)
    const pippoData = EHR_KNOWLEDGE.pippo;
    if (pippoData?.topics && (ehrSystem === 'socrates' || ehrSystem === 'practicemanager')) {
        for (const topic of pippoData.topics) {
            const score = scoreTopic(topic, queryTokens);
            if (score > 0) {
                scoredTopics.push({
                    ...topic,
                    score,
                    source: 'Pippo Patient Portal'
                });
            }
        }
    }

    // Also check general topics
    if (generalData?.topics) {
        for (const topic of generalData.topics) {
            const score = scoreTopic(topic, queryTokens);
            if (score > 0) {
                scoredTopics.push({
                    ...topic,
                    score,
                    source: 'General IT'
                });
            }
        }
    }

    // Sort by score descending and take top N
    scoredTopics.sort((a, b) => b.score - a.score);
    const topTopics = scoredTopics.slice(0, maxTopics);

    if (topTopics.length === 0) return '';

    // Build markdown context
    const sections = topTopics.map(topic =>
        `### ${topic.title} (${topic.source})\n${topic.content}`
    );

    return `## Relevant Knowledge Base Sections\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Build the system prompt for Dara
 *
 * @param {string} ehrSystem - EHR system key
 * @param {Object} practiceProfile - Practice profile object
 * @returns {string} Complete system prompt
 */
export function buildDaraSystemPrompt(ehrSystem, practiceProfile) {
    const ehrData = EHR_KNOWLEDGE[ehrSystem];
    const ehrName = ehrData?.name || formatEhrName(ehrSystem);

    // Practice context
    const practiceName = practiceProfile?.practiceDetails?.practiceName || 'the practice';
    const location = practiceProfile?.practiceDetails?.locations?.[0] ||
        practiceProfile?.practiceDetails?.location || '';

    const partners = practiceProfile?.gps?.partners?.length || 0;
    const salaried = practiceProfile?.gps?.salaried?.length || 0;
    const staff = practiceProfile?.staff?.length || 0;

    return `You are Dara, a virtual IT support specialist for Irish GP practices. You help practice staff with their EHR system, practice IT, and related technology tasks.

## Your Practice
- Practice: ${practiceName}${location ? ` (${location})` : ''}
- EHR System: ${ehrName}
- Team: ${partners} GP partner${partners !== 1 ? 's' : ''}, ${salaried} salaried GP${salaried !== 1 ? 's' : ''}, ${staff} staff member${staff !== 1 ? 's' : ''}

## Your Behaviour Rules
1. Give clear, step-by-step instructions when explaining how to do something in ${ehrName}
2. Reference specific menu paths, buttons, and screen names from ${ehrName}
3. If the user's question includes a screenshot, examine it carefully and relate your answer to what you see
4. If you are not confident about a specific menu path or feature location, say so clearly — do NOT fabricate navigation steps
5. Note that EHR software gets updated regularly — if a user says they can't find something where you've described, suggest the interface may have changed in their version
6. For questions outside your knowledge, suggest the user contact their EHR vendor's support line or check for updated documentation
7. Keep answers practical and concise — practice staff are busy
8. Use simple, non-technical language unless the user demonstrates technical knowledge
9. When relevant, mention related features that might also be useful

## CRITICAL: Patient Data Protection
If the user's message or uploaded image appears to contain patient-identifiable information (names, dates of birth, PPS numbers, addresses, phone numbers, medical record numbers, or any health information linked to an identifiable person):
- Immediately flag this to the user
- Ask them to remove or redact the patient information before continuing
- Remind them that patient data should not be shared with AI systems
- You can still help with their IT question using a general example instead

## About You
- Your name is Dara
- You are part of Sláinte Finance, a tool built specifically for Irish GP practices
- You are knowledgeable about ${ehrName} and general GP practice IT systems in Ireland
- You also know about PCRS, Healthlink, GMS claims, and other HSE systems that interact with ${ehrName}${(ehrSystem === 'socrates' || ehrSystem === 'practicemanager') ? '\n- You are knowledgeable about Pippo, the patient portal integrated with ' + ehrName + ' for online appointment booking, payments, and clinic scheduling' : ''}
- You are friendly, patient, and supportive — many practice staff find IT frustrating`;
}

/**
 * Get the EHR display name from system key
 */
function formatEhrName(ehrSystem) {
    const names = {
        socrates: 'Socrates',
        healthone: 'HealthOne',
        practicemanager: 'Helix Practice Manager',
        completegp: 'CompleteGP'
    };
    return names[ehrSystem] || ehrSystem || 'your EHR system';
}

/**
 * Get welcome message and quick topic suggestions for a specific EHR
 *
 * @param {string} ehrSystem - EHR system key
 * @returns {{ welcomeMessage: string, quickTopics: Array<{label: string, query: string}> }}
 */
export function getDaraWelcome(ehrSystem) {
    const ehrName = formatEhrName(ehrSystem);

    const welcomeMessage = `Hello! I'm Dara, your virtual IT support assistant. I'm here to help you with ${ehrName} and other practice IT.\n\nYou can ask me about navigating ${ehrName}, running reports, managing patients, PCRS submissions, Healthlink, and more. You can also upload a screenshot if you need help with something specific on your screen.\n\nWhat can I help you with?`;

    // EHR-specific quick topics
    const commonTopics = [
        { label: 'Run a diagnosis report', query: 'How do I run a diagnosis report?' },
        { label: 'CDM registration', query: 'How do I register a patient for Chronic Disease Management?' },
        { label: 'PCRS claims', query: 'How do I submit or check GMS claims on the PCRS website?' },
        { label: 'Healthlink setup', query: 'How do I set up or check Healthlink?' }
    ];

    const ehrSpecificTopics = {
        socrates: [
            { label: 'Patient Finder', query: 'How do I use Patient Finder in Socrates?' },
            { label: 'Practice distribution', query: 'How do I run a practice distribution breakdown in Socrates?' },
            ...commonTopics
        ],
        practicemanager: [
            { label: 'Report Builder', query: 'How do I use the Report Builder in Helix Practice Manager?' },
            { label: 'Claim Tracker', query: 'How do I use the Claim Tracker in HPM?' },
            ...commonTopics
        ],
        healthone: [
            { label: 'CDM Dashboard', query: 'How do I use the CDM Dashboard in HealthOne?' },
            { label: 'Database Analysis', query: 'How do I run Database Analysis in HealthOne?' },
            ...commonTopics
        ],
        completegp: [
            { label: 'Search Tool', query: 'How do I use the Search Tool in CompleteGP?' },
            { label: 'Medical coding', query: 'How does coding work in CompleteGP?' },
            ...commonTopics
        ]
    };

    return {
        welcomeMessage,
        quickTopics: (ehrSpecificTopics[ehrSystem] || commonTopics).slice(0, 6)
    };
}
