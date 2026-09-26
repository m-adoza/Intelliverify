// ============================================================
// INTELLIVERIFY - TEXT PROCESSOR
// ============================================================
// Prepares extracted document text for similarity analysis.
//
// Pipeline:
//
// Raw document
//      ↓
// Normalize
//      ↓
// Remove unnecessary characters
//      ↓
// Tokenize
//      ↓
// Remove stop words
//      ↓
// Prepare clean text
//
// Used by plagiarismEngine.js
// ============================================================


// ============================================================
// COMMON ENGLISH STOP WORDS
// ============================================================

const STOP_WORDS = new Set([

    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'has',
    'have',
    'he',
    'her',
    'his',
    'i',
    'in',
    'is',
    'it',
    'its',
    'of',
    'on',
    'or',
    'that',
    'the',
    'their',
    'them',
    'they',
    'this',
    'to',
    'was',
    'we',
    'were',
    'will',
    'with',
    'you',
    'your',

    'about',
    'above',
    'after',
    'again',
    'against',
    'all',
    'am',
    'any',
    'because',
    'before',
    'being',
    'below',
    'between',
    'both',
    'but',
    'can',
    'could',
    'did',
    'do',
    'does',
    'doing',
    'during',
    'each',
    'few',
    'further',
    'had',
    'having',
    'how',
    'if',
    'into',
    'more',
    'most',
    'other',
    'our',
    'out',
    'over',
    'same',
    'should',
    'so',
    'some',
    'such',
    'than',
    'too',
    'under',
    'until',
    'very',
    'what',
    'when',
    'where',
    'which',
    'while',
    'who',
    'whom',
    'why',
    'would'

]);


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(text) {

    if (typeof text !== 'string') {

        return '';

    }


    let normalized = text;


    // Convert to lowercase
    normalized = normalized.toLowerCase();


    // Replace Windows / Mac line breaks
    normalized =
        normalized.replace(/\r\n/g, '\n');

    normalized =
        normalized.replace(/\r/g, '\n');


    // Replace tabs with spaces
    normalized =
        normalized.replace(/\t+/g, ' ');


    // Replace URLs
    normalized =
        normalized.replace(
            /https?:\/\/[^\s]+/gi,
            ' '
        );


    // Remove email addresses
    normalized =
        normalized.replace(
            /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
            ' '
        );


    // Keep letters, numbers and spaces.
    // Punctuation is removed because the
    // similarity engine is interested mainly
    // in textual content.
    normalized =
        normalized.replace(
            /[^a-z0-9\s]/gi,
            ' '
        );


    // Collapse multiple spaces
    normalized =
        normalized.replace(
            /\s+/g,
            ' '
        );


    return normalized.trim();

}


// ============================================================
// TOKENIZE
// ============================================================

function tokenize(text) {

    const normalized =
        normalizeText(text);


    if (!normalized) {

        return [];

    }


    return normalized
        .split(/\s+/)
        .filter(Boolean);

}


// ============================================================
// REMOVE STOP WORDS
// ============================================================

function removeStopWords(tokens) {

    return tokens.filter(
        token =>
            token.length > 1 &&
            !STOP_WORDS.has(token)
    );

}


// ============================================================
// SIMPLE WORD NORMALIZATION
// ============================================================
//
// This is deliberately lightweight.
// We are not using an aggressive stemmer yet.
//
// Example:
//
// projects → project
// students → student
//
// This helps similarity detection without
// damaging technical terms too aggressively.
// ============================================================

function normalizeWord(word) {

    if (!word) {

        return '';

    }


    let result = word;


    // Remove common plural ending
    if (
        result.length > 4 &&
        result.endsWith('ies')
    ) {

        result =
            result.slice(0, -3) + 'y';

    }
    else if (
        result.length > 4 &&
        result.endsWith('s') &&
        !result.endsWith('ss')
    ) {

        result =
            result.slice(0, -1);

    }


    return result;

}


// ============================================================
// PREPARE TOKENS
// ============================================================

function prepareTokens(text) {

    const tokens =
        tokenize(text);


    const filtered =
        removeStopWords(tokens);


    return filtered
        .map(normalizeWord)
        .filter(Boolean);

}


// ============================================================
// PREPARE CLEAN TEXT
// ============================================================

function prepareText(text) {

    return prepareTokens(text)
        .join(' ');

}


// ============================================================
// CREATE SENTENCES
// ============================================================
//
// This is kept separate from normalizeText()
// because later we will use sentence/chunk
// matching to identify specific matching passages.
// ============================================================

function splitSentences(text) {

    if (typeof text !== 'string') {

        return [];

    }


    return text
        .replace(/\r\n/g, '\n')
        .split(/[.!?]+(?:\s+|\n|$)/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 20);

}


// ============================================================
// CREATE N-GRAMS
// ============================================================
//
// N-grams will later help us identify repeated
// sequences of words.
//
// Example:
//
// "intelligent project approval system"
//
// becomes:
//
// intelligent project approval
// project approval system
//
// ============================================================

function createNGrams(tokens, size = 3) {

    if (
        !Array.isArray(tokens) ||
        tokens.length < size
    ) {

        return [];

    }


    const ngrams = [];


    for (
        let i = 0;
        i <= tokens.length - size;
        i++
    ) {

        ngrams.push(
            tokens
                .slice(i, i + size)
                .join(' ')
        );

    }


    return ngrams;

}


// ============================================================
// DOCUMENT PROCESSOR
// ============================================================

function processDocument(text) {

    const cleanText =
        normalizeText(text);


    const tokens =
        prepareTokens(text);


    const sentences =
        splitSentences(text);


    const ngrams =
        createNGrams(tokens, 3);


    return {

        originalText: text || '',

        cleanText,

        tokens,

        tokenCount:
            tokens.length,

        sentences,

        sentenceCount:
            sentences.length,

        ngrams,

        ngramCount:
            ngrams.length

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    normalizeText,

    tokenize,

    removeStopWords,

    normalizeWord,

    prepareTokens,

    prepareText,

    splitSentences,

    createNGrams,

    processDocument

};
