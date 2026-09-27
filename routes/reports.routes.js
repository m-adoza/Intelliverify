// ============================================================
// PLAGIARISM REPORT ROUTES
// ============================================================
// POST   /api/reports/scan        student scans a document
// GET    /api/reports              list (role-aware)
// GET    /api/reports/:id          single report
// GET    /api/reports/:id/download signed URL for the original file
// DELETE /api/reports/:id          student deletes own (before approval)
// ============================================================

const express = require('express');
const { randomUUID } = require('crypto');
const { admin } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');
const { extractText } = require('../services/extractor');
const { scanDocument } = require('../services/plagiarism');

const router = express.Router();

const MAX_RAW_BYTES = 7 * 1024 * 1024;   // 7 MB raw file
const SUBMISSIONS_BUCKET = 'submissions';

// ------------------------------------------------------------
// POST /api/reports/scan   (student)
// Body: { filename, mime, base64 }
// ------------------------------------------------------------

router.post(
    '/scan',
    requireAuth,
    requireRole('student'),
    asyncHandler(async (req, res) => {
        const { filename, mime, base64 } = req.body || {};

        if (!filename || !base64) {
            throw new ApiError(400, 'filename and base64 are required.');
        }

        // Decode the base64 payload
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length === 0) {
            throw new ApiError(400, 'Empty file payload.');
        }
        if (buffer.length > MAX_RAW_BYTES) {
            throw new ApiError(413, 'File exceeds the 7 MB limit.');
        }

        // Extract text (throws if the format is unsupported or empty)
        const { text, wordCount, format } = await extractText(buffer, filename);

        // Load corpus (all reference docs)
        const { data: corpusDocs, error: corpusError } = await admin
            .from('documents')
            .select('id, filename, extracted_text')
            .eq('purpose', 'corpus')
            .not('extracted_text', 'is', null);

        if (corpusError) throw new ApiError(500, corpusError.message);

        const corpus = (corpusDocs || []).map(d => ({
            id: d.id,
            title: d.filename,
            text: d.extracted_text
        }));

        // Run the scan
        const result = scanDocument(text, corpus);

        // Upload the original file to Storage
        const ext = format;
        const storagePath = `${req.user.id}/${randomUUID()}.${ext}`;

        const { error: uploadError } = await admin
            .storage
            .from(SUBMISSIONS_BUCKET)
            .upload(storagePath, buffer, {
                contentType: mime || 'application/octet-stream',
                upsert: false
            });

        if (uploadError) throw new ApiError(500, `Storage upload failed: ${uploadError.message}`);

        // Insert the documents row
        const { data: docRow, error: docError } = await admin
            .from('documents')
            .insert({
                uploaded_by: req.user.id,
                purpose: 'submission',
                filename,
                file_format: ext,
                mime_type: mime || null,
                file_size: buffer.length,
                storage_path: storagePath,
                extracted_text: text,
                word_count: wordCount
            })
            .select('id')
            .single();

        if (docError) throw new ApiError(500, docError.message);

        // Insert the plagiarism report
        const { data: report, error: reportError } = await admin
            .from('plagiarism_reports')
            .insert({
                user_id: req.user.id,
                document_id: docRow.id,
                filename,
                file_format: ext,
                mime_type: mime || null,
                file_size: buffer.length,
                storage_path: storagePath,
                extracted_text: text,
                word_count: wordCount,
                similarity_score: result.similarity_score,
                risk_level: result.risk_level,
                matches: result.matches,
                recommendation: result.recommendation,
                scan_status: 'completed',
                processed_at: new Date().toISOString()
            })
            .select('*')
            .single();

        if (reportError) throw new ApiError(500, reportError.message);

        // Notify linked supervisors (info only)
        const { data: links } = await admin
            .from('assignments')
            .select('supervisor_id')
            .eq('student_id', req.user.id);

        if (links && links.length) {
            await admin.from('notifications').insert(
                links.map(l => ({
                    user_id: l.supervisor_id,
                    type: 'scan_completed',
                    title: 'New scan submitted',
                    body: `${req.user.profile.full_name || req.user.email} completed a plagiarism scan (${result.similarity_score}%).`,
                    link: '/supervisor/dashboard.html'
                }))
            );
        }

        res.status(201).json({
            message: 'Scan completed.',
            report: {
                report_id: report.report_id,
                filename: report.filename,
                file_format: report.file_format,
                similarity_score: report.similarity_score,
                risk_level: report.risk_level,
                recommendation: report.recommendation,
                matches: result.matches,
                keywords: result.keywords,
                statistics: result.statistics,
                created_at: report.created_at
            }
        });
    })
);

// ------------------------------------------------------------
// GET /api/reports   (role-aware)
// ------------------------------------------------------------

router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
        const role = req.user.profile.role;
        const userId = req.user.id;

        let query = admin
            .from('plagiarism_reports')
            .select(`
                report_id, filename, file_format, similarity_score,
                risk_level, scan_status, recommendation, created_at,
                user:profiles!plagiarism_reports_user_id_fkey (
                    id, full_name, email
                )
            `)
            .order('created_at', { ascending: false })
            .limit(200);

        if (role === 'student') {
            query = query.eq('user_id', userId);
        } else if (role === 'supervisor') {
            // All reports from students linked to this supervisor
            const { data: links } = await admin
                .from('assignments')
                .select('student_id')
                .eq('supervisor_id', userId);

            const studentIds = (links || []).map(l => l.student_id);
            if (!studentIds.length) return res.json({ reports: [] });
            query = query.in('user_id', studentIds);
        }
        // admin: no filter

        const { data, error } = await query;
        if (error) throw new ApiError(500, error.message);

        res.json({ reports: data || [] });
    })
);

// ------------------------------------------------------------
// GET /api/reports/:id
// ------------------------------------------------------------

router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { data: report, error } = await admin
            .from('plagiarism_reports')
            .select('*')
            .eq('report_id', req.params.id)
            .maybeSingle();

        if (error) throw new ApiError(500, error.message);
        if (!report) throw new ApiError(404, 'Report not found.');

        const allowed = await canAccessReport(req.user, report);
        if (!allowed) throw new ApiError(403, 'Access denied.');

        res.json({ report });
    })
);

// ------------------------------------------------------------
// GET /api/reports/:id/download
// Returns a short-lived signed URL for the original file.
// ------------------------------------------------------------

router.get(
    '/:id/download',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { data: report, error } = await admin
            .from('plagiarism_reports')
            .select('report_id, storage_path, filename, user_id')
            .eq('report_id', req.params.id)
            .maybeSingle();

        if (error) throw new ApiError(500, error.message);
        if (!report) throw new ApiError(404, 'Report not found.');

        const allowed = await canAccessReport(req.user, report);
        if (!allowed) throw new ApiError(403, 'Access denied.');

        const { data: signed, error: signError } = await admin
            .storage
            .from(SUBMISSIONS_BUCKET)
            .createSignedUrl(report.storage_path, 60 * 5);   // 5 min

        if (signError) throw new ApiError(500, signError.message);

        res.json({
            url: signed.signedUrl,
            filename: report.filename,
            expires_in: 300
        });
    })
);

// ------------------------------------------------------------
// DELETE /api/reports/:id   (student, before attached to an approved topic)
// ------------------------------------------------------------

router.delete(
    '/:id',
    requireAuth,
    requireRole('student'),
    asyncHandler(async (req, res) => {
        const { data: report } = await admin
            .from('plagiarism_reports')
            .select('report_id, user_id, storage_path')
            .eq('report_id', req.params.id)
            .maybeSingle();

        if (!report) throw new ApiError(404, 'Report not found.');
        if (report.user_id !== req.user.id) {
            throw new ApiError(403, 'You can only delete your own reports.');
        }

        // Block if a topic that's already approved/rejected uses it
        const { data: attached } = await admin
            .from('topics')
            .select('topic_id, status')
            .eq('plagiarism_report_id', report.report_id)
            .maybeSingle();

        if (attached && ['approved', 'rejected'].includes(attached.status)) {
            throw new ApiError(409, 'Cannot delete a report attached to a reviewed topic.');
        }

        // Best-effort delete the storage file
        if (report.storage_path) {
            await admin.storage.from(SUBMISSIONS_BUCKET).remove([report.storage_path]);
        }

        const { error } = await admin
            .from('plagiarism_reports')
            .delete()
            .eq('report_id', report.report_id);

        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'Report deleted.' });
    })
);

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

async function canAccessReport(user, report) {
    if (user.profile.role === 'admin') return true;
    if (user.profile.role === 'student') return report.user_id === user.id;

    if (user.profile.role === 'supervisor') {
        const { data: link } = await admin
            .from('assignments')
            .select('id')
            .eq('supervisor_id', user.id)
            .eq('student_id', report.user_id)
            .maybeSingle();
        return Boolean(link);
    }

    return false;
}

module.exports = router;
