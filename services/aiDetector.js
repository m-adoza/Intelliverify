// ============================================================
// AI-LIKELIHOOD DETECTOR
// ============================================================
// Heuristic, statistical signal-based detector.
//
// Signals used:
//   1. Sentence-length burstiness (coefficient of variation)
//      — Human writing varies widely between sentences.
//      — AI writing tends to produce sentences of similar length.
//
//   2. Sentence-length uniformity
//      — Fraction of sentences within ±30% of the mean length.
//      — Higher fraction = more AI-like.
//
//   3. Repeated sentence openers
//      — How often the same first word starts multiple sentences.
//      — AI models favor common sentence start patterns.
//
// This is a screening tool, not a verdict. Every signal has
// false positives on formal academic prose. The output is a
// 0-100 score where:
//     0-40  → likely human-written
//    40-70  → inconclusive / mixed signals
//    70-100 → strong AI-likelihood
//
// No external dependencies. No API keys. Deterministic.
// ============================================================


// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Split into sentences. Handles . ! ? followed by whitespace.
function splitSentences(text) {
    return text
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 15);   // ignore fragments
}

function wordCount(sentence) {
    return (sentence.match(/\b[a-z0-9']+\b/gi) || []).length;
}

function firstWord(sentence) {
    const match = sentence.match(/^\s*["'(]*([a-zA-Z]+)/);
    return match ? match[1].toLowerCase() : '';
}


// ------------------------------------------------------------
// SIGNAL 1 — BURSTINESS
// ------------------------------------------------------------
// Coefficient of variation = std dev / mean.
//   Human writing:  typically 0.45 – 0.85
//   AI writing:     typically 0.15 – 0.40
// ------------------------------------------------------------

function computeBurstiness(sentences) {
    const lengths = sentences.map(wordCount).filter(n => n > 0);
    if (lengths.length < 3) return { burstiness: 0, mean: 0, stdDev: 0 };

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce(
        (sum, n) => sum + Math.pow(n - mean, 2),
        0
    ) / lengths.length;

    const stdDev = Math.sqrt(variance);
    const burstiness = mean > 0 ? stdDev / mean : 0;

    return { burstiness, mean, stdDev };
}


// ------------------------------------------------------------
// SIGNAL 2 — SENTENCE UNIFORMITY
// ------------------------------------------------------------
// Fraction of sentences whose length is within ±30% of mean.
//   Human writing:  typically 0.30 – 0.55
//   AI writing:     typically 0.60 – 0.90
// ------------------------------------------------------------

function computeUniformity(sentences, mean) {
    if (mean === 0) return 0;

    const lengths = sentences.map(wordCount).filter(n => n > 0);
    const uniform = lengths.filter(
        n => Math.abs(n - mean) / mean <= 0.3
    ).length;

    return uniform / lengths.length;
}


// ------------------------------------------------------------
// SIGNAL 3 — OPENER REPETITION
// ------------------------------------------------------------
// Fraction of sentences that share the single most-common opener.
//   Human writing:  typically 0.10 – 0.25
//   AI writing:     typically 0.30 – 0.55
// ------------------------------------------------------------

function computeOpenerRepetition(sentences) {
    const openers = sentences.map(firstWord).filter(Boolean);
    if (!openers.length) return 0;

    const counts = {};
    for (const o of openers) counts[o] = (counts[o] || 0) + 1;

    const maxCount = Math.max(...Object.values(counts));
    return maxCount / openers.length;
}


// ------------------------------------------------------------
// MAIN DETECTOR
// ------------------------------------------------------------

function detectAI(text) {
    if (typeof text !== 'string' || text.trim().length < 100) {
        return {
            score: 0,
            indicators: {
                note: 'Text too short for meaningful AI analysis.',
                sentence_count: 0
            }
        };
    }

    const sentences = splitSentences(text);

    if (sentences.length < 4) {
        return {
            score: 0,
            indicators: {
                note: 'Too few sentences for reliable analysis (need at least 4).',
                sentence_count: sentences.length
            }
        };
    }

    // --- Compute the three signals ---
    const { burstiness, mean, stdDev } = computeBurstiness(sentences);
    const uniformity = computeUniformity(sentences, mean);
    const openerRepetition = computeOpenerRepetition(sentences);

    // --- Map each signal to a 0-100 AI-likelihood score ---

    // Burstiness: 0.5+ → 0 (human); 0.15 or less → 100 (AI-like)
    const burstScore = clamp((0.5 - burstiness) * 285, 0, 100);

    // Uniformity: 0.35 → 0; 0.75+ → 100
    const uniformScore = clamp((uniformity - 0.35) * 250, 0, 100);

    // Opener repetition: 0.2 → 0; 0.55+ → 100
    const openerScore = clamp((openerRepetition - 0.2) * 285, 0, 100);

    // --- Weighted combination ---
    // Burstiness gets the most weight (strongest single signal).
    const score = Math.round(
        burstScore * 0.55 +
        uniformScore * 0.25 +
        openerScore * 0.20
    );

    return {
        score: clamp(score, 0, 100),
        indicators: {
            burstiness: Number(burstiness.toFixed(3)),
            sentence_uniformity: Number(uniformity.toFixed(3)),
            opener_repetition: Number(openerRepetition.toFixed(3)),
            sentence_count: sentences.length,
            average_sentence_length: Math.round(mean),
            sentence_length_std_dev: Number(stdDev.toFixed(2))
        }
    };
}


// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------

module.exports = {
    detectAI,
    splitSentences,
    computeBurstiness,
    computeUniformity,
    computeOpenerRepetition
};
