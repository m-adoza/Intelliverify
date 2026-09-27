// ============================================================
// CORPUS ROUTES  (supervisor reference documents)
// ============================================================
// POST   /api/corpus              upload a reference document
// GET    /api/corpus              list corpus
// GET    /api/corpus/:id/download signed URL
// DELETE /api/corpus/:id          remove a corpus document
// ============================================================

const express = require('express');
const { randomUUID } = require('crypto');
const { admin } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');
const { extractText } = require('../services/extractor');

const router = express.Router();

const MAX_RAW_BYTES = 7 * 1024 * 1024;
const CORPUS_BUCKET = 'corpus';

// ------------------------------------------------------------
// POST /api/corpus
// Body: { filename, mime, base64, title? }
// ------------------------------------------------------------

router.post(
    '/',
    requireAuth,
    requireRole('supervisor', 'admin'),
    asyncHandler(async (req, res) => {
        const { filename, mime, base64, title } = req.body || {};

        if (!filename || !base64) {
            throw new ApiError(400, 'filename and base64 are required.');
        }

        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length === 0) throw new ApiError(400, 'Empty payload.');
        if (buffer.length > MAX_RAW_BYTES) {
            throw new ApiError(413, 'File exceeds the 7 MB limit.');
        }

        const { text, wordCount, format } = await extractText(buffer, filename);

        const storagePath = `${req.user.id}/${randomUUID()}.${format}`;

        const { error: uploadError } = await admin
            .storage
            .from(CORPUS_BUCKET)
            .upload(storagePath, buffer, {
                contentType: mime || 'application/octet-stream',
                upsert: false
            });

        if (uploadError) {
            throw new ApiError(500, `Storage upload failed: ${uploadError.message}`);
        }

        const { data: doc, error } = await admin
            .from('documents')
            .insert({
                uploaded_by: req.user.id,
                purpose: 'corpus',
                filename: title || filename,
                file_format: format,
                mime_type: mime || null,
                file_size: buffer.length,
                storage_path: storagePath,
                extracted_text: text,
                word_count: wordCount
            })
            .select(`
                id, filename, file_format, file_size, word_count, created_at
            `)
            .single();

        if (error) throw new ApiError(500, error.message);

        res.status(201).json({
            message: 'Reference document added to corpus.',
            document: doc
        });
    })
);

// ------------------------------------------------------------
// GET /api/corpus   (supervisors + admins only)
// ------------------------------------------------------------

router.get(
    '/',
    requireAuth,
    requireRole('supervisor', 'admin'),
    asyncHandler(async (req, res) => {
        const { data, error } = await admin
            .from('documents')
            .select(`
                id, filename, file_format, file_size, word_count,
                storage_path, created_at,
                uploader:profiles!documents_uploaded_by_fkey (
                    id, full_name, email
                )
            `)
            .eq('purpose', 'corpus')
            .order('created_at', { ascending: false });

        if (error) throw new ApiError(500, error.message);

        res.json({ documents: data || [] });
    })
);

// ------------------------------------------------------------
// GET /api/corpus/:id/download
// ------------------------------------------------------------

router.get(
    '/:id/download',
    requireAuth,
    requireRole('supervisor', 'admin'),
    asyncHandler(async (req, res) => {
        const { data: doc } = await admin
            .from('documents')
            .select('id, storage_path, filename')
            .eq('id', req.params.id)
            .eq('purpose', 'corpus')
            .maybeSingle();

        if (!doc) throw new ApiError(404, 'Document not found.');

        const { data: signed, error } = await admin
            .storage
            .from(CORPUS_BUCKET)
            .createSignedUrl(doc.storage_path, 60 * 5);

        if (error) throw new ApiError(500, error.message);

        res.json({
            url: signed.signedUrl,
            filename: doc.filename,
            expires_in: 300
        });
    })
);

// ------------------------------------------------------------
// DELETE /api/corpus/:id
// ------------------------------------------------------------

router.delete(
    '/:id',
    requireAuth,
    requireRole('supervisor', 'admin'),
    asyncHandler(async (req, res) => {
        const { data: doc } = await admin
            .from('documents')
            .select('id, uploaded_by, storage_path')
            .eq('id', req.params.id)
            .eq('purpose', 'corpus')
            .maybeSingle();

        if (!doc) throw new ApiError(404, 'Document not found.');

        // Supervisor can only delete own uploads; admin can delete any
        if (req.user.profile.role !== 'admin' && doc.uploaded_by !== req.user.id) {
            throw new ApiError(403, 'You can only delete your own uploads.');
        }

        if (doc.storage_path) {
            await admin.storage.from(CORPUS_BUCKET).remove([doc.storage_path]);
        }

        const { error } = await admin
            .from('documents')
            .delete()
            .eq('id', doc.id);

        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'Corpus document deleted.' });
    })
);

module.exports = router;
