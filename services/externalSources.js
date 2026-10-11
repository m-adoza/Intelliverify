// ============================================================
// EXTERNAL SOURCE MATCHING
// ============================================================
// Sends the uploaded document's key terms to free public APIs
// and returns matching results. No API keys required.
//
// Sources:
//   • OpenAlex     — open catalog of scholarly works (250M+)
//   • Wikipedia    — free online encyclopedia
//
// Both are free, unauthenticated, and rate-limit generously.
// We use a short timeout so a slow API never blocks a scan.
// ============================================================

const DEFAULT_TIMEOUT_MS = 5000;
const USER_AGENT = 'IntelliVerify/3.0 (academic final-year project)';
const CONTACT_EMAIL = 'intelliverify@example.com';   // ← change if you want
const MAX_RESULTS_PER_SOURCE = 5;
const MAX_QUERY_TERMS = 8;


// ------------------------------------------------------------
// LOW-LEVEL FETCH WITH TIMEOUT
// ------------------------------------------------------------

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}


// ------------------------------------------------------------
// STOP WORDS FOR QUERY EXTRACTION
// ------------------------------------------------------------
// Deliberately minimal — we want academic terms to survive.

const STOP_WORDS = new Set([
    'the','a','an','and','or','but','of','in','on','at','to','from','by',
    'for','with','is','are','was','were','be','been','being','this','that',
    'these','those','it','its','as','we','our','you','your','they','their',
    'has','have','had','can','could','will','would','should','may','might',
    'must','shall','also','into','about','which','where','when','while',
    'than','then','them','such','there','here','so','if','not','no','yes',
    'do','does','did','doing','done','use','using','used','one','two','three',
    'new','old','good','bad','very','more','most','some','any','all','each',
    'other','another','same','different'
]);


// ------------------------------------------------------------
// BUILD A SEARCH QUERY FROM THE DOCUMENT
// ------------------------------------------------------------
// Extract the most-frequent non-stop-word terms and join them.
// ------------------------------------------------------------

function buildSearchQuery(text, maxTerms = MAX_QUERY_TERMS) {
    if (!text) return '';

    const tokens = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));

    if (!tokens.length) return '';

    const counts = {};
    for (const t of tokens) counts[t] = (counts[t] || 0) + 1;

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxTerms)
        .map(([w]) => w)
        .join(' ');
}


// ------------------------------------------------------------
// OPENALEX
// ------------------------------------------------------------
// Free scholarly search. Query is a plain text search string.
// Docs: https://docs.openalex.org/
// ------------------------------------------------------------

async function searchOpenAlex(query) {
    if (!query) return [];

    const url =
        'https://api.openalex.org/works' +
        `?search=${encodeURIComponent(query)}` +
        `&per-page=${MAX_RESULTS_PER_SOURCE}` +
        `&mailto=${encodeURIComponent(CONTACT_EMAIL)}`;

    const data = await fetchJson(url);

    return (data.results || []).map(w => ({
        source: 'OpenAlex',
        title: w.title || w.display_name || 'Untitled',
        url: w.doi || w.id || null,
        year: w.publication_year || null,
        authors: (w.authorships || [])
            .slice(0, 3)
            .map(a => a.author && a.author.display_name)
            .filter(Boolean),
        type: w.type || 'article'
    }));
}


// ------------------------------------------------------------
// WIKIPEDIA
// ------------------------------------------------------------
// Uses the standard MediaWiki search API.
// ------------------------------------------------------------

function stripHtml(html) {
    if (!html) return '';
    return String(html)
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

async function searchWikipedia(query) {
    if (!query) return [];

    const url =
        'https://en.wikipedia.org/w/api.php' +
        '?action=query' +
        '&list=search' +
        `&srsearch=${encodeURIComponent(query)}` +
        '&format=json' +
        '&origin=*' +
        '&srlimit=' + MAX_RESULTS_PER_SOURCE;

    const data = await fetchJson(url);

    return (data.query && data.query.search || []).map(r => ({
        source: 'Wikipedia',
        title: r.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
        snippet: stripHtml(r.snippet),
        word_count: r.wordcount || null
    }));
}


// ------------------------------------------------------------
// MAIN ENTRY POINT
// ------------------------------------------------------------
// Runs both lookups in parallel. Uses Promise.allSettled so
// one failing source does not abort the other.
// ------------------------------------------------------------

async function findExternalMatches(text) {
    const query = buildSearchQuery(text);

    if (!query) {
        return {
            matches: [],
            sources_checked: {},
            status: 'failed',
            note: 'Could not extract a search query from the document.'
        };
    }

    const [openAlexResult, wikiResult] = await Promise.allSettled([
        searchOpenAlex(query),
        searchWikipedia(query)
    ]);

    const matches = [];
    const sources_checked = {};

    if (openAlexResult.status === 'fulfilled') {
        matches.push(...openAlexResult.value);
        sources_checked.OpenAlex = openAlexResult.value.length;
    } else {
        sources_checked.OpenAlex = 0;
        console.warn('[externalSources] OpenAlex failed:', openAlexResult.reason?.message);
    }

    if (wikiResult.status === 'fulfilled') {
        matches.push(...wikiResult.value);
        sources_checked.Wikipedia = wikiResult.value.length;
    } else {
        sources_checked.Wikipedia = 0;
        console.warn('[externalSources] Wikipedia failed:', wikiResult.reason?.message);
    }

    const succeeded = Object.values(sources_checked).filter(n => n > 0).length;
    const status =
        succeeded === 0 ? 'failed' :
        succeeded === 2 ? 'completed' :
                          'partial';

    return {
        matches,
        sources_checked,
        status,
        query_used: query
    };
}


// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------

module.exports = {
    findExternalMatches,
    buildSearchQuery,
    searchOpenAlex,
    searchWikipedia
};
