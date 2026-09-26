// ============================================================
// INTELLIVERIFY - DOCUMENT TEXT EXTRACTOR
// ============================================================
// Supports:
//   .txt
//   .docx
//   .pdf
//
// The extractor receives a local file path and returns
// the extracted plain text.
// ============================================================

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');


// ============================================================
// SUPPORTED FILE TYPES
// ============================================================

const SUPPORTED_EXTENSIONS = [
    '.txt',
    '.docx',
    '.pdf'
];


// ============================================================
// NORMALIZE FILE EXTENSION
// ============================================================

function getExtension(filePath) {

    return path
        .extname(filePath)
        .toLowerCase();

}


// ============================================================
// CHECK SUPPORTED FILE
// ============================================================

function isSupportedFile(filePath) {

    const extension = getExtension(filePath);

    return SUPPORTED_EXTENSIONS.includes(extension);

}


// ============================================================
// EXTRACT TEXT FROM TXT
// ============================================================

async function extractTXT(filePath) {

    return fs.promises.readFile(
        filePath,
        'utf8'
    );

}


// ============================================================
// EXTRACT TEXT FROM DOCX
// ============================================================

async function extractDOCX(filePath) {

    const result = await mammoth.extractRawText({
        path: filePath
    });

    return result.value || '';

}


// ============================================================
// EXTRACT TEXT FROM PDF
// ============================================================

async function extractPDF(filePath) {

    const buffer = await fs.promises.readFile(
        filePath
    );

    const result = await pdfParse(buffer);

    return result.text || '';

}


// ============================================================
// MAIN EXTRACTOR
// ============================================================

async function extractText(filePath) {

    if (!filePath) {

        throw new Error(
            'A document file path is required.'
        );

    }


    if (!fs.existsSync(filePath)) {

        throw new Error(
            `Document not found: ${filePath}`
        );

    }


    const extension =
        getExtension(filePath);


    if (
        !SUPPORTED_EXTENSIONS.includes(
            extension
        )
    ) {

        throw new Error(
            `Unsupported document format: ${extension}. ` +
            `Supported formats are: ${SUPPORTED_EXTENSIONS.join(', ')}`
        );

    }


    console.log(
        `Extracting text from ${extension} file...`
    );


    let text = '';


    switch (extension) {

        case '.txt':

            text =
                await extractTXT(filePath);

            break;


        case '.docx':

            text =
                await extractDOCX(filePath);

            break;


        case '.pdf':

            text =
                await extractPDF(filePath);

            break;


        default:

            throw new Error(
                `Unsupported document format: ${extension}`
            );

    }


    if (!text || !text.trim()) {

        throw new Error(
            'No readable text could be extracted from the document.'
        );

    }


    console.log(
        `Text extraction completed. Characters extracted: ${text.length}`
    );


    return text;

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    extractText,

    isSupportedFile,

    SUPPORTED_EXTENSIONS

};
