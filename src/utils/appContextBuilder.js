/**
 * App Context Builder for Finn
 *
 * Retrieves relevant app knowledge sections based on user query.
 * Mirrors the pattern in daraContextBuilder.js — keyword tokenisation
 * and topic scoring to find the most relevant help sections.
 */

import { APP_KNOWLEDGE } from '../data/appKnowledge';

/**
 * Common stop words to exclude from keyword matching
 * (same list as daraContextBuilder.js)
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
    'please', 'thanks', 'thank', 'hi', 'hello', 'hey'
]);

/**
 * Tokenise a query string into meaningful keywords
 */
function tokenise(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-&]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2 && !STOP_WORDS.has(word));
}

/**
 * Score a topic against a set of query tokens
 */
function scoreTopic(topic, queryTokens) {
    let score = 0;

    const topicKeywords = topic.keywords.map(k => k.toLowerCase());

    for (const token of queryTokens) {
        for (const keyword of topicKeywords) {
            if (token === keyword) {
                score += 3;
            } else if (token.includes(keyword) || keyword.includes(token)) {
                score += 2;
            }
        }

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
 * Detect if a query is asking about app features/usage rather than financial data.
 * Returns true when the message looks like a "how do I..." question about the app.
 */
export function isAppHelpQuestion(message) {
    const lowerMsg = message.toLowerCase();

    // Direct help/navigation patterns
    const helpPatterns = [
        'how do i', 'how to', 'where do i', 'where can i', 'where is',
        'how can i', 'show me how', 'help me find', 'i can\'t find',
        'how does', 'what does', 'what is the', 'where\'s the',
        'navigate to', 'go to', 'find the', 'open the', 'access the',
        'use the', 'start the', 'run the', 'set up', 'configure',
        'what can you do', 'what features', 'how does this app',
        'how does slainte', 'what can finn'
    ];

    // App feature keywords that suggest app-help intent
    const featureKeywords = [
        'tour', 'settings', 'onboarding', 'backup', 'restore',
        'import', 'upload', 'export', 'categories',
        'widget', 'pcrs download', 'health check',
        'p&l', 'profit and loss', 'report modal', 'transaction list',
        'local only', 'privacy mode', 'api key'
    ];

    const hasHelpPattern = helpPatterns.some(p => lowerMsg.includes(p));
    const hasFeatureKeyword = featureKeywords.some(k => lowerMsg.includes(k));

    return hasHelpPattern && hasFeatureKeyword;
}

/**
 * Build app knowledge context for a user query.
 * Returns a markdown block with the most relevant help topics.
 *
 * @param {string} query - User's question
 * @param {number} maxTopics - Max topics to include (default 3)
 * @returns {string} Markdown context block, or empty string if no matches
 */
export function buildAppKnowledgeContext(query, maxTopics = 3) {
    const queryTokens = tokenise(query);
    if (queryTokens.length === 0) return '';

    const scoredTopics = APP_KNOWLEDGE.topics
        .map(topic => ({ ...topic, score: scoreTopic(topic, queryTokens) }))
        .filter(t => t.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxTopics);

    if (scoredTopics.length === 0) return '';

    const sections = scoredTopics.map(t => `### ${t.title}\n${t.content}`);
    return `\n**APP FEATURE GUIDE (relevant sections):**\n${sections.join('\n\n---\n\n')}\n`;
}
