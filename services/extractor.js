// ============================================================
// DOCUMENT TEXT EXTRACTOR
// ============================================================
// Input:  Buffer + original filename
// Output: { text, wordCount, format }
//
// Supported: .txt, .docx, .pdf
// Legacy .doc and .ppt are rejected with a friendly message.
// ============================================================

const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const SUPPORTED = ['txt', 'docx', 'pdf'];

function getExtension(filename) {
    return path.extname(filename || '').replace('.', '').toLowerCase();
}

function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

// ------------------------------------------------------------
// TXT
// ------------------------------------------------------------

async function extractTxt(buffer) {
    return buffer.toString('utf8');
}

// ------------------------------------------------------------
// DOCX
// ------------------------------------------------------------

async function extractDocx(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

// ------------------------------------------------------------
// PDF
// ------------------------------------------------------------

async function extractPdf(buffer) {
    const result = await pdfParse(buffer);
    return result.text || '';
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

async function extractText(buffer, filename) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('A file buffer is required.');
    }

    const ext = getExtension(filename);

    if (!SUPPORTED.includes(ext)) {
        if (ext === 'doc' || ext === 'ppt' || ext === 'pptx') {
            throw new Error(
                `Legacy .${ext} files are not supported. ` +
                `Please save the document as .docx, .pdf, or .txt.`
            );
        }
        throw new Error(
            `Unsupported file format: .${ext}. ` +
            `Supported: ${SUPPORTED.join(', ')}.`
        );
    }

    let text = '';

    try {
        if (ext === 'txt')  text = await extractTxt(buffer);
        if (ext === 'docx') text = await extractDocx(buffer);
        if (ext === 'pdf')  text = await extractPdf(buffer);
    } catch (err) {
        throw new Error(
            `Could not read the ${ext.toUpperCase()} file: ${err.message}`
        );
    }

    // Normalize whitespace so downstream tokenization is stable
    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\u00A0/g, ' ')     // non-breaking space
        .replace(/[ ]{3,}/g, '  ')   // collapse long spaces
        .trim();

    if (!text || text.length < 20) {
        throw new Error(
            'The document contains little or no readable text. ' +
            'If it is a scanned PDF, please upload a text-based version.'
        );
    }

    return {
        text,
        wordCount: countWords(text),
        format: ext
    };
}

module.exports = {
    extractText,
    getExtension,
    countWords,
    SUPPORTED
};
