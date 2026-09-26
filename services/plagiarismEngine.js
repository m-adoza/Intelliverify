// ============================================================
// INTELLIVERIFY - PLAGIARISM / DOCUMENT SIMILARITY ENGINE
// ============================================================
// Method:
//   1. Process documents
//   2. Build TF-IDF vectors
//   3. Calculate cosine similarity
//   4. Detect matching n-grams
//   5. Produce a similarity report
//
// IMPORTANT:
// This is an institutional similarity detector.
// It compares against documents/topics supplied to it.
// It does NOT claim to search the entire internet.
// ============================================================

const {
    processDocument,
    prepareTokens,
    createNGrams
} = require('./textProcessor');


// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {

    // Minimum number of words required
    // before attempting comparison.
    minimumWords: 20,

    // Number of words in repeated sequences.
    ngramSize: 3,

    // Ignore extremely common terms.
    maxDocumentFrequency: 0.90,

    // Number of matching phrases returned.
    maximumMatches: 20,

    // Similarity thresholds.
    //
    // These are initial values and can be
    // calibrated later using real university data.
    lowThreshold: 10,
    mediumThreshold: 30,
    highThreshold: 60

};


// ============================================================
// BASIC HELPERS
// ============================================================

function round(number, decimals = 2) {

    const multiplier =
        Math.pow(10, decimals);

    return Math.round(
        number * multiplier
    ) / multiplier;

}


function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );

}


// ============================================================
// TERM FREQUENCY
// ============================================================

function calculateTermFrequency(tokens) {

    const frequencies = new Map();

    for (const token of tokens) {

        frequencies.set(
            token,
            (frequencies.get(token) || 0) + 1
        );

    }


    const totalTokens =
        tokens.length;


    const tf = new Map();


    if (!totalTokens) {

        return tf;

    }


    for (
        const [term, count]
        of frequencies.entries()
    ) {

        tf.set(
            term,
            count / totalTokens
        );

    }


    return tf;

}


// ============================================================
// DOCUMENT FREQUENCY
// ============================================================

function calculateDocumentFrequency(documents) {

    const df = new Map();


    for (const document of documents) {

        const uniqueTerms =
            new Set(document.tokens);


        for (const term of uniqueTerms) {

            df.set(
                term,
                (df.get(term) || 0) + 1
            );

        }

    }


    return df;

}


// ============================================================
// IDF
// ============================================================

function calculateIDF(documentFrequency, totalDocuments) {

    const idf = new Map();


    if (!totalDocuments) {

        return idf;

    }


    for (
        const [term, frequency]
        of documentFrequency.entries()
    ) {

        // Smoothed IDF.
        const value =
            Math.log(
                (totalDocuments + 1) /
                (frequency + 1)
            ) + 1;


        idf.set(
            term,
            value
        );

    }


    return idf;

}


// ============================================================
// TF-IDF VECTOR
// ============================================================

function calculateTFIDF(tokens, idf) {

    const tf =
        calculateTermFrequency(tokens);


    const vector = new Map();


    for (
        const [term, frequency]
        of tf.entries()
    ) {

        const idfValue =
            idf.get(term);


        if (idfValue === undefined) {

            continue;

        }


        vector.set(
            term,
            frequency * idfValue
        );

    }


    return vector;

}


// ============================================================
// COSINE SIMILARITY
// ============================================================

function cosineSimilarity(vectorA, vectorB) {

    if (
        !vectorA.size ||
        !vectorB.size
    ) {

        return 0;

    }


    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;


    for (
        const value
        of vectorA.values()
    ) {

        magnitudeA +=
            value * value;

    }


    for (
        const value
        of vectorB.values()
    ) {

        magnitudeB +=
            value * value;

    }


    for (
        const [term, valueA]
        of vectorA.entries()
    ) {

        const valueB =
            vectorB.get(term) || 0;


        dotProduct +=
            valueA * valueB;

    }


    magnitudeA =
        Math.sqrt(magnitudeA);

    magnitudeB =
        Math.sqrt(magnitudeB);


    if (
        magnitudeA === 0 ||
        magnitudeB === 0
    ) {

        return 0;

    }


    return clamp(
        dotProduct /
        (magnitudeA * magnitudeB),
        0,
        1
    );

}


// ============================================================
// MATCHING N-GRAMS
// ============================================================

function findMatchingNGrams(
    tokensA,
    tokensB,
    ngramSize = 3
) {

    const ngramsA =
        createNGrams(
            tokensA,
            ngramSize
        );


    const ngramsB =
        new Set(
            createNGrams(
                tokensB,
                ngramSize
            )
        );


    const matches =
        new Set();


    for (const ngram of ngramsA) {

        if (ngramsB.has(ngram)) {

            matches.add(ngram);

        }

    }


    return Array.from(matches);

}


// ============================================================
// CALCULATE MATCHING WORD RATIO
// ============================================================

function calculateWordOverlap(
    tokensA,
    tokensB
) {

    if (
        !tokensA.length ||
        !tokensB.length
    ) {

        return 0;

    }


    const termsA =
        new Set(tokensA);

    const termsB =
        new Set(tokensB);


    let sharedTerms = 0;


    for (const term of termsA) {

        if (termsB.has(term)) {

            sharedTerms++;

        }

    }


    const smallerSet =
        Math.min(
            termsA.size,
            termsB.size
        );


    if (!smallerSet) {

        return 0;

    }


    return sharedTerms /
        smallerSet;

}


// ============================================================
// RISK CLASSIFICATION
// ============================================================

function calculateRisk(similarityScore) {

    if (
        similarityScore >=
        CONFIG.highThreshold
    ) {

        return 'high';

    }


    if (
        similarityScore >=
        CONFIG.mediumThreshold
    ) {

        return 'medium';

    }


    return 'low';

}


// ============================================================
// RECOMMENDATION
// ============================================================

function generateRecommendation(
    similarityScore,
    riskLevel
) {

    if (riskLevel === 'high') {

        return (
            'High textual similarity detected. ' +
            'The document should be reviewed before topic approval.'
        );

    }


    if (riskLevel === 'medium') {

        return (
            'Moderate textual similarity detected. ' +
            'Review the highlighted matching content and sources.'
        );

    }


    if (similarityScore >= CONFIG.lowThreshold) {

        return (
            'Some textual overlap was detected. ' +
            'Review the matching content before submission.'
        );

    }


    return (
        'Low textual similarity detected against the ' +
        'available institutional documents.'
    );

}


// ============================================================
// PREPARE CORPUS
// ============================================================
//
// Expected format:
//
// [
//     {
//         id: 'document-id',
//         title: 'Existing Project',
//         text: '...'
//     }
// ]
//
// ============================================================

function prepareCorpus(corpus) {

    if (!Array.isArray(corpus)) {

        return [];

    }


    return corpus
        .filter(
            document =>
                document &&
                typeof document.text === 'string' &&
                document.text.trim()
        )
        .map(document => {

            const processed =
                processDocument(
                    document.text
                );


            return {

                id:
                    document.id || null,

                title:
                    document.title ||
                    document.filename ||
                    'Institutional Document',

                filename:
                    document.filename ||
                    null,

                tokens:
                    processed.tokens,

                cleanText:
                    processed.cleanText

            };

        })
        .filter(
            document =>
                document.tokens.length >=
                CONFIG.minimumWords
        );

}


// ============================================================
// MAIN SCANNER
// ============================================================

function scanDocument(
    documentText,
    corpus = []
) {

    if (
        typeof documentText !== 'string' ||
        !documentText.trim()
    ) {

        throw new Error(
            'Document text is empty.'
        );

    }


    const uploadedDocument =
        processDocument(
            documentText
        );


    if (
        uploadedDocument.tokenCount <
        CONFIG.minimumWords
    ) {

        throw new Error(
            `The document contains too little readable text. ` +
            `At least ${CONFIG.minimumWords} words are required.`
        );

    }


    const preparedCorpus =
        prepareCorpus(corpus);


    // Include the uploaded document when
    // calculating IDF.
    const allDocuments = [

        {
            id: '__uploaded__',
            title: '__uploaded__',
            tokens:
                uploadedDocument.tokens
        },

        ...preparedCorpus

    ];


    const documentFrequency =
        calculateDocumentFrequency(
            allDocuments
        );


    const idf =
        calculateIDF(
            documentFrequency,
            allDocuments.length
        );


    const uploadedVector =
        calculateTFIDF(
            uploadedDocument.tokens,
            idf
        );


    const comparisonResults = [];


    for (
        const document
        of preparedCorpus
    ) {

        const documentVector =
            calculateTFIDF(
                document.tokens,
                idf
            );


        const cosine =
            cosineSimilarity(
                uploadedVector,
                documentVector
            );


        const similarityScore =
            round(
                cosine * 100,
                2
            );


        const matchingPhrases =
            findMatchingNGrams(
                uploadedDocument.tokens,
                document.tokens,
                CONFIG.ngramSize
            );


        const wordOverlap =
            round(
                calculateWordOverlap(
                    uploadedDocument.tokens,
                    document.tokens
                ) * 100,
                2
            );


        comparisonResults.push({

            id:
                document.id,

            title:
                document.title,

            filename:
                document.filename,

            similarity:
                similarityScore,

            word_overlap:
                wordOverlap,

            matching_phrase_count:
                matchingPhrases.length,

            matching_phrases:
                matchingPhrases.slice(
                    0,
                    CONFIG.maximumMatches
                )

        });

    }


    // Highest similarity first.
    comparisonResults.sort(
        (a, b) =>
            b.similarity -
            a.similarity
    );


    const highestSimilarity =
        comparisonResults.length
            ? comparisonResults[0].similarity
            : 0;


    const riskLevel =
        calculateRisk(
            highestSimilarity
        );


    const recommendation =
        generateRecommendation(
            highestSimilarity,
            riskLevel
        );


    return {

        similarity_score:
            highestSimilarity,

        risk_level:
            riskLevel,

        recommendation,

        documents_checked:
            preparedCorpus.length,

        matches:
            comparisonResults
                .filter(
                    result =>
                        result.similarity > 0
                )
                .slice(
                    0,
                    CONFIG.maximumMatches
                ),

        statistics: {

            words_analyzed:
                uploadedDocument.tokenCount,

            sentences_analyzed:
                uploadedDocument.sentenceCount,

            documents_checked:
                preparedCorpus.length

        }

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    scanDocument,

    calculateTermFrequency,

    calculateDocumentFrequency,

    calculateIDF,

    calculateTFIDF,

    cosineSimilarity,

    findMatchingNGrams,

    calculateWordOverlap,

    calculateRisk,

    generateRecommendation,

    prepareCorpus,

    CONFIG

};
