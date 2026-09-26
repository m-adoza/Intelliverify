// ============================================================
// PLAGIARISM ENGINE
// ============================================================
// Method:
//   1. Clean + tokenize both documents
//   2. Build TF-IDF vectors across the corpus
//   3. Cosine similarity (semantic overlap)
//   4. 3-gram Jaccard (verbatim phrase overlap)
//   5. Hybrid score = 0.7 * cosine + 0.3 * jaccard
//   6. Return risk band, matches, and extracted keywords
//
// This engine compares against a known corpus only. It does
// not search the web.
// ============================================================

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

const CONFIG = {
    minWords: 30,           // uploaded doc must have at least this many words
    ngramSize: 3,           // phrase length for Jaccard
    lowMax: 30,             // 0  – 30  → low (attachable)
    mediumMax: 60,          // 31 – 60  → medium
    //                       61 – 100 → high
    cosineWeight: 0.7,
    jaccardWeight: 0.3,
    maxMatches: 10,
    maxKeywords: 8
};

// ------------------------------------------------------------
// STOP WORDS
// ------------------------------------------------------------
// Deliberately a curated short list. Keeps technical terms.

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

// Light stemmer — just handles common plurals. Keeps technical
// terms intact.
function stem(word) {
    if (!word || word.length < 4) return word;

    if (word.endsWith('ies') && word.length > 4) {
        return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('ss')) return word;
    if (word.endsWith('s') && word.length > 4) {
        return word.slice(0, -1);
    }
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
        // Smoothed IDF
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
// Returns the top N terms in the uploaded document by TF-IDF
// weight. Useful for the supervisor and for the student's own
// understanding of their proposal.

function extractKeywords(vector, limit = CONFIG.maxKeywords) {
    return Array.from(vector.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([term]) => term);
}

// ------------------------------------------------------------
// MAIN SCAN
// ------------------------------------------------------------
// documentText : string of the uploaded document
// corpus       : [{ id, title, text }, ...]
//
// Returns:
//   {
//     similarity_score: 0-100,
//     risk_level: 'low'|'medium'|'high',
//     recommendation: string,
//     matches: [{ id, title, similarity, word_overlap, phrase_count }],
//     keywords: [ 'term1', ... ],
//     statistics: { words, matches_checked, phrases_matched }
//   }

function scanDocument(documentText, corpus = []) {
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

    // Build the corpus token lists
    const preparedCorpus = (Array.isArray(corpus) ? corpus : [])
        .filter(doc => doc && typeof doc.text === 'string' && doc.text.trim())
        .map(doc => ({
            id: doc.id || null,
            title: doc.title || doc.filename || 'Reference document',
            tokens: tokenize(doc.text)
        }))
        .filter(doc => doc.tokens.length >= 10);

    // If the corpus is empty, we can't compare. Return a safe result.
    if (preparedCorpus.length === 0) {
        return {
            similarity_score: 0,
            risk_level: 'low',
            recommendation:
                'No reference documents have been uploaded by your ' +
                'supervisor yet. The scan found no matches to compare against.',
            matches: [],
            keywords: extractKeywords(tfidfVector(tokens, new Map([['__x__', 1]]))),
            statistics: {
                words: tokens.length,
                matches_checked: 0,
                phrases_matched: 0
            }
        };
    }

    // Compute IDF across corpus + uploaded doc
    const allTokenLists = [tokens, ...preparedCorpus.map(d => d.tokens)];
    const df = documentFrequency(allTokenLists);
    const idf = inverseDocumentFrequency(df, allTokenLists.length);

    // Vector for the uploaded doc
    const uploadedVector = tfidfVector(tokens, idf);

    // Uploaded doc's n-grams
    const uploadedNGrams = new Set(createNGrams(tokens));

    // Compare against each corpus document
    const matches = preparedCorpus.map(doc => {
        const docVector = tfidfVector(doc.tokens, idf);
        const cos = cosine(uploadedVector, docVector);

        const docNGrams = new Set(createNGrams(doc.tokens));
        const jac = jaccard(uploadedNGrams, docNGrams);

        // Hybrid score (0-1)
        const hybrid =
            CONFIG.cosineWeight * cos +
            CONFIG.jaccardWeight * jac;

        const percent = Math.round(hybrid * 100 * 100) / 100;

        // Shared phrases (capped)
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

    // Sort by highest similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    const topScore = matches.length ? matches[0].similarity : 0;
    const risk = riskLevel(topScore);
    const rec = recommendation(topScore, risk);

    // Distinct phrase count across all matches (for the statistics block)
    const totalPhrasesMatched = matches.reduce(
        (sum, m) => sum + m.phrase_count,
        0
    );

    return {
        similarity_score: topScore,
        risk_level: risk,
        recommendation: rec,
        matches: matches.slice(0, CONFIG.maxMatches),
        keywords: extractKeywords(uploadedVector),
        statistics: {
            words: tokens.length,
            matches_checked: preparedCorpus.length,
            phrases_matched: totalPhrasesMatched
        }
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
