// ============================================================
// PLAGIARISM ENGINE  (v3 — corpus + AI + external sources)
// ============================================================
// Method:
//   1. Clean + tokenize both documents
//   2. Build TF-IDF vectors across the corpus
//   3. Cosine similarity (semantic overlap)
//   4. 3-gram Jaccard (verbatim phrase overlap)
//   5. Hybrid score = 0.7 * cosine + 0.3 * jaccard
//   6. NEW: AI-likelihood score via services/aiDetector.js
//   7. NEW: External academic + reference matches via
//           services/externalSources.js (OpenAlex, Wikipedia)
//
// External matching runs in parallel with corpus scanning.
// If a source times out or errors, the scan still completes
// with the other source's results and a status of 'partial'.
// ============================================================

// NEW — engines for the two new signals
const { detectAI } = require('./aiDetector');
const { findExternalMatches } = require('./externalSources');

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

const CONFIG = {
    minWords: 30,
    ngramSize: 3,
    lowMax: 30,
    mediumMax: 60,
    cosineWeight: 0.7,
    jaccardWeight: 0.3,
    maxMatches: 10,
    maxKeywords: 8
};

// ------------------------------------------------------------
// STOP WORDS
// ------------------------------------------------------------

const STOP_WORDS = new Set([
    'a','an','and','are','as','at','be','by','for','from','has','have',
    'he','her','his','i','in','is','it','its','of','on','or','that','the',
    'their','them','they','this','to','was','we','were','will','with','you',
    'your','about','above','after','again','against','all','am','any',
    'because','before','being','below','between','both','but','can','could',
    'did','do','does','doing','during','each','few','further','had','having',
    'how','if','into','more','most','other','our','out','over','same',
    'should','so','some','such','than','too','under','until','very','what',
    'when','where','which','while','who','whom','why','would','also','may',
    'might','must','shall'
]);

// ------------------------------------------------------------
// TEXT CLEANING
// ------------------------------------------------------------

function cleanText(text) {
    if (typeof text !== 'string') return '';

    let t = text.toLowerCase();
    t = t.replace(/\r\n?/g, '\n');
    t = t.replace(/https?:\/\/\S+/g, ' ');
    t = t.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ');
    t = t.replace(/[^a-z0-9\s]/g, ' ');
    t = t.replace(/\s+/g, ' ');
    return t.trim();
}

function tokenize(text) {
    const cleaned = cleanText(text);
    if (!cleaned) return [];

    return cleaned
        .split(' ')
        .filter(Boolean)
        .filter(t => t.length > 1 && !STOP_WORDS.has(t))
        .map(stem);
}

function stem(word) {
    if (!word || word.length < 4) return word;
    if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
    if (word.endsWith('ss')) return word;
    if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
    return word;
}

// ------------------------------------------------------------
// N-GRAMS
// ------------------------------------------------------------

function createNGrams(tokens, size = CONFIG.ngramSize) {
    if (!Array.isArray(tokens) || tokens.length < size) return [];
    const grams = [];
    for (let i = 0; i <= tokens.length - size; i++) {
        grams.push(tokens.slice(i, i + size).join(' '));
    }
    return grams;
}

function jaccard(setA, setB) {
    if (!setA.size || !setB.size) return 0;
    let intersection = 0;
    for (const item of setA) {
        if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

// ------------------------------------------------------------
// TF-IDF
// ------------------------------------------------------------

function termFrequency(tokens) {
    const tf = new Map();
    if (!tokens.length) return tf;
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    for (const [term, count] of tf) {
        tf.set(term, count / tokens.length);
    }
    return tf;
}

function documentFrequency(tokenizedDocs) {
    const df = new Map();
    for (const tokens of tokenizedDocs) {
        const seen = new Set(tokens);
        for (const term of seen) {
            df.set(term, (df.get(term) || 0) + 1);
        }
    }
    return df;
}

function inverseDocumentFrequency(df, totalDocs) {
    const idf = new Map();
    for (const [term, freq] of df) {
        idf.set(term, Math.log((totalDocs + 1) / (freq + 1)) + 1);
    }
    return idf;
}

function tfidfVector(tokens, idf) {
    const tf = termFrequency(tokens);
    const vec = new Map();
    for (const [term, freq] of tf) {
        const idfVal = idf.get(term);
        if (idfVal !== undefined) {
            vec.set(term, freq * idfVal);
        }
    }
    return vec;
}

function cosine(vecA, vecB) {
    if (!vecA.size || !vecB.size) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (const [term, valA] of vecA) {
        const valB = vecB.get(term) || 0;
        dot += valA * valB;
    }
    for (const val of vecA.values()) magA += val * val;
    for (const val of vecB.values()) magB += val * val;

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (!magA || !magB) return 0;
    return Math.max(0, Math.min(1, dot / (magA * magB)));
}

// ------------------------------------------------------------
// RISK + RECOMMENDATION
// ------------------------------------------------------------

function riskLevel(score) {
    if (score <= CONFIG.lowMax) return 'low';
    if (score <= CONFIG.mediumMax) return 'medium';
    return 'high';
}

function recommendation(score, risk) {
    if (risk === 'high') {
        return (
            'High similarity detected. The document contains substantial ' +
            'overlap with existing project material. Substantial rewriting ' +
            'and proper citation are required before submission.'
        );
    }
    if (risk === 'medium') {
        return (
            'Moderate similarity detected. Review the highlighted matching ' +
            'passages and rewrite them in your own words before submitting ' +
            'this proposal.'
        );
    }
    if (score > 10) {
        return (
            'Minor overlaps found. This is normal for academic writing. ' +
            'The document is suitable for submission.'
        );
    }
    return (
        'Low similarity detected against the institutional corpus. ' +
        'The document is unique and suitable for submission.'
    );
}

// ------------------------------------------------------------
// KEYWORD EXTRACTION
// ------------------------------------------------------------

function extractKeywords(vector, limit = CONFIG.maxKeywords) {
    return Array.from(vector.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([term]) => term);
}

// ------------------------------------------------------------
// MAIN SCAN  —  now async, merges 3 signals
// ------------------------------------------------------------

async function scanDocument(documentText, corpus = []) {
    if (typeof documentText !== 'string' || !documentText.trim()) {
        throw new Error('Document text is empty.');
    }

    const tokens = tokenize(documentText);

    if (tokens.length < CONFIG.minWords) {
        throw new Error(
            `The document contains too little readable text. ` +
            `At least ${CONFIG.minWords} meaningful words are required.`
        );
    }

    // --------------------------------------------------------
    // A. Corpus comparison (existing logic, unchanged)
    // --------------------------------------------------------

    const preparedCorpus = (Array.isArray(corpus) ? corpus : [])
        .filter(doc => doc && typeof doc.text === 'string' && doc.text.trim())
        .map(doc => ({
            id: doc.id || null,
            title: doc.title || doc.filename || 'Reference document',
            tokens: tokenize(doc.text)
        }))
        .filter(doc => doc.tokens.length >= 10);

    let similarity_score = 0;
    let risk = 'low';
    let rec = '';
    let matches = [];
    let keywords = [];
    let stats = {
        words: tokens.length,
        matches_checked: preparedCorpus.length,
        phrases_matched: 0
    };

    if (preparedCorpus.length === 0) {
        similarity_score = 0;
        risk = 'low';
        rec =
            'No reference documents have been uploaded by your ' +
            'supervisor yet. The scan found no matches to compare against.';
        matches = [];
        keywords = extractKeywords(tfidfVector(tokens, new Map([['__x__', 1]])));
    } else {
        const allTokenLists = [tokens, ...preparedCorpus.map(d => d.tokens)];
        const df = documentFrequency(allTokenLists);
        const idf = inverseDocumentFrequency(df, allTokenLists.length);

        const uploadedVector = tfidfVector(tokens, idf);
        const uploadedNGrams = new Set(createNGrams(tokens));

        matches = preparedCorpus.map(doc => {
            const docVector = tfidfVector(doc.tokens, idf);
            const cos = cosine(uploadedVector, docVector);

            const docNGrams = new Set(createNGrams(doc.tokens));
            const jac = jaccard(uploadedNGrams, docNGrams);

            const hybrid =
                CONFIG.cosineWeight * cos +
                CONFIG.jaccardWeight * jac;

            const percent = Math.round(hybrid * 100 * 100) / 100;

            const sharedPhrases = [];
            for (const gram of uploadedNGrams) {
                if (docNGrams.has(gram)) {
                    sharedPhrases.push(gram);
                    if (sharedPhrases.length >= 5) break;
                }
            }

            return {
                id: doc.id,
                title: doc.title,
                similarity: percent,
                word_overlap: Math.round(jac * 100 * 100) / 100,
                phrase_count: sharedPhrases.length,
                phrases: sharedPhrases
            };
        });

        matches.sort((a, b) => b.similarity - a.similarity);

        similarity_score = matches.length ? matches[0].similarity : 0;
        risk = riskLevel(similarity_score);
        rec = recommendation(similarity_score, risk);
        keywords = extractKeywords(uploadedVector);

        stats.phrases_matched = matches.reduce(
            (sum, m) => sum + m.phrase_count, 0
        );

        matches = matches.slice(0, CONFIG.maxMatches);
    }

    // --------------------------------------------------------
    // B. NEW — AI-likelihood score (synchronous, local)
    // --------------------------------------------------------

    let aiResult;
    try {
        aiResult = detectAI(documentText);
    } catch (err) {
        console.warn('[plagiarism] AI detector failed:', err.message);
        aiResult = {
            score: 0,
            indicators: { error: err.message }
        };
    }

    // --------------------------------------------------------
    // C. NEW — external sources (async, network)
    // --------------------------------------------------------

    let externalResult;
    try {
        externalResult = await findExternalMatches(documentText);
    } catch (err) {
        console.warn('[plagiarism] External sources failed:', err.message);
        externalResult = {
            matches: [],
            sources_checked: {},
            status: 'failed',
            note: err.message
        };
    }

    // --------------------------------------------------------
    // D. Merged result
    // --------------------------------------------------------

    return {
        // --- Existing fields (unchanged) ---
        similarity_score,
        risk_level: risk,
        recommendation: rec,
        matches,
        keywords,
        statistics: stats,

        // --- New: AI likelihood ---
        ai_likelihood_score: aiResult.score,
        ai_indicators: aiResult.indicators,

        // --- New: external source matches ---
        external_matches: externalResult.matches,
        external_sources_checked: externalResult.sources_checked,
        external_scan_status: externalResult.status
    };
}

module.exports = {
    scanDocument,
    cleanText,
    tokenize,
    createNGrams,
    cosine,
    jaccard,
    CONFIG
};
