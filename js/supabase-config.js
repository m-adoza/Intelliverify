// ============================================================
// INTELLIVERIFY - SUPABASE CONFIGURATION
// ============================================================
// Version: Phase 1 - Document Storage Foundation
//
// Includes:
// 1. Supabase connection
// 2. Authentication helpers
// 3. Profile helpers
// 4. Supabase Storage document upload
// 5. Secure signed document URLs
// 6. Document deletion
// 7. Plagiarism report creation/retrieval
// 8. Topic submission/retrieval
// 9. Topic approval status updates
// 10. Messaging
// 11. Toast notification helper
//
// IMPORTANT:
// - Frontend must ONLY use the anon/publishable key.
// - NEVER put a service_role/secret key here.
// - Storage bucket used by IntelliVerify:
//       project-documents
// ============================================================


// ============================================================
// 1. SUPABASE CONNECTION
// ============================================================

const SUPABASE_URL =
    'https://yxgxzflcgrzfndzxqibg.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Z3h6ZmxjZ3J6Zm5kenhxaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDM5MDUsImV4cCI6MjEwNTgxOTkwNX0.DK159oguwZwpw31QoaEB0x0Rz4wTICJo6M5yrmVMwkM';


// ============================================================
// 2. STORAGE CONFIGURATION
// ============================================================

window.INTELLIVERIFY_STORAGE_BUCKET =
    'project-documents';


// Maximum document size: 10 MB
window.INTELLIVERIFY_MAX_FILE_SIZE =
    10 * 1024 * 1024;


// Supported document types
window.INTELLIVERIFY_ALLOWED_FILE_TYPES = [

    'application/pdf',

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    'text/plain'

];


// Supported extensions
window.INTELLIVERIFY_ALLOWED_EXTENSIONS = [

    'pdf',
    'docx',
    'txt'

];


// ============================================================
// 3. CREATE SUPABASE CLIENT
// ============================================================

if (!window.supabase) {

    console.error(
        'Supabase JavaScript library was not loaded.'
    );

}
else {

    window.supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

}


// ============================================================
// 4. GET CURRENT AUTHENTICATED USER
// ============================================================

window.getCurrentUser = async function () {

    if (!window.supabaseClient) {
        throw new Error(
            'Supabase client is not initialized.'
        );
    }


    const {
        data: { session },
        error
    } =
        await window.supabaseClient.auth.getSession();


    if (error) {

        console.error(
            'Session error:',
            error
        );

        return null;
    }


    if (!session) {
        return null;
    }


    return session.user;

};


// ============================================================
// 5. GET CURRENT USER PROFILE
// ============================================================

window.getCurrentUserProfile = async function () {

    const user =
        await window.getCurrentUser();


    if (!user) {
        return null;
    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('profiles')

            .select('*')

            .eq('id', user.id)

            .single();


    if (error) {

        console.error(
            'Error fetching user profile:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 6. GET PROFILE BY ID
// ============================================================

window.getProfileById = async function (userId) {

    if (!userId) {
        throw new Error(
            'User ID is required.'
        );
    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('profiles')

            .select('*')

            .eq('id', userId)

            .single();


    if (error) {

        console.error(
            'Error fetching profile:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 7. UPLOAD PROJECT DOCUMENT
// ============================================================
//
// Uploads:
// PDF
// DOCX
// TXT
//
// Storage path:
// project-documents/
//      USER_ID/
//          TIMESTAMP_FILENAME
//
// The bucket should be PRIVATE.
// ============================================================

window.uploadProjectDocument = async function (
    file,
    userId
) {

    if (!window.supabaseClient) {

        throw new Error(
            'Supabase client is not initialized.'
        );

    }


    if (!file) {

        throw new Error(
            'No document was selected.'
        );

    }


    if (!userId) {

        throw new Error(
            'User ID is required.'
        );

    }


    // --------------------------------------------------------
    // Validate file size
    // --------------------------------------------------------

    if (
        file.size >
        window.INTELLIVERIFY_MAX_FILE_SIZE
    ) {

        throw new Error(
            'File is too large. Maximum allowed size is 10 MB.'
        );

    }


    // --------------------------------------------------------
    // Get extension
    // --------------------------------------------------------

    const originalName =
        file.name || 'document';


    const extension =
        originalName
            .split('.')
            .pop()
            .toLowerCase();


    // --------------------------------------------------------
    // Validate extension
    // --------------------------------------------------------

    if (
        !window.INTELLIVERIFY_ALLOWED_EXTENSIONS
            .includes(extension)
    ) {

        throw new Error(
            'Unsupported file type. Please upload PDF, DOCX or TXT.'
        );

    }


    // --------------------------------------------------------
    // Validate MIME type
    // --------------------------------------------------------

    if (
        file.type &&
        !window.INTELLIVERIFY_ALLOWED_FILE_TYPES
            .includes(file.type)
    ) {

        throw new Error(
            'Unsupported document format.'
        );

    }


    // --------------------------------------------------------
    // Make filename safe
    // --------------------------------------------------------

    const safeName =
        originalName
            .replace(/[^a-zA-Z0-9._-]/g, '_');


    // --------------------------------------------------------
    // Generate unique storage filename
    // --------------------------------------------------------

    const uniqueName =
        `${Date.now()}_${crypto.randomUUID()}_${safeName}`;


    // --------------------------------------------------------
    // User-specific folder
    // --------------------------------------------------------

    const storagePath =
        `${userId}/${uniqueName}`;


    console.log(
        'Uploading IntelliVerify document:',
        storagePath
    );


    // --------------------------------------------------------
    // Upload
    // --------------------------------------------------------

    const {
        data,
        error
    } =
        await window.supabaseClient

            .storage

            .from(
                window.INTELLIVERIFY_STORAGE_BUCKET
            )

            .upload(
                storagePath,
                file,
                {
                    cacheControl: '3600',
                    upsert: false,
                    contentType:
                        file.type ||
                        'application/octet-stream'
                }
            );


    if (error) {

        console.error(
            'Storage upload error:',
            error
        );

        throw error;

    }


    return {

        path:
            data.path,

        filename:
            originalName,

        file_format:
            extension,

        file_size:
            file.size,

        mime_type:
            file.type,

        storage_path:
            data.path

    };

};


// ============================================================
// 8. CREATE SECURE SIGNED DOCUMENT URL
// ============================================================
//
// The bucket is private.
// Therefore we do NOT use getPublicUrl().
//
// Signed URL expires after the specified time.
// Default = 1 hour.
// ============================================================

window.getProjectDocumentUrl = async function (

    storagePath,

    expiresIn = 3600

) {

    if (!storagePath) {

        throw new Error(
            'Storage path is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .storage

            .from(
                window.INTELLIVERIFY_STORAGE_BUCKET
            )

            .createSignedUrl(
                storagePath,
                expiresIn
            );


    if (error) {

        console.error(
            'Signed URL error:',
            error
        );

        throw error;

    }


    return data.signedUrl;

};


// ============================================================
// 9. DOWNLOAD PROJECT DOCUMENT
// ============================================================
//
// Returns the document Blob.
// Useful when we later implement text extraction.
// ============================================================

window.downloadProjectDocument = async function (
    storagePath
) {

    if (!storagePath) {

        throw new Error(
            'Storage path is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .storage

            .from(
                window.INTELLIVERIFY_STORAGE_BUCKET
            )

            .download(
                storagePath
            );


    if (error) {

        console.error(
            'Document download error:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 10. DELETE PROJECT DOCUMENT
// ============================================================

window.deleteProjectDocument = async function (
    storagePath
) {

    if (!storagePath) {

        throw new Error(
            'Storage path is required.'
        );

    }


    const {
        error
    } =
        await window.supabaseClient

            .storage

            .from(
                window.INTELLIVERIFY_STORAGE_BUCKET
            )

            .remove([
                storagePath
            ]);


    if (error) {

        console.error(
            'Document deletion error:',
            error
        );

        throw error;

    }


    return true;

};


// ============================================================
// 11. CREATE INITIAL PLAGIARISM REPORT
// ============================================================
//
// This happens immediately after a successful upload.
//
// At this stage:
//
// scan_status = uploaded
//
// Later:
//
// uploaded
//     ↓
// extracting
//     ↓
// ready
//     ↓
// scanning
//     ↓
// completed
// ============================================================

window.createUploadedDocumentReport = async function (

    userId,

    uploadData

) {

    if (!userId) {

        throw new Error(
            'User ID is required.'
        );

    }


    if (!uploadData) {

        throw new Error(
            'Upload information is missing.'
        );

    }


    if (!uploadData.path) {

        throw new Error(
            'Storage path is missing.'
        );

    }


    const payload = {

        user_id:
            userId,

        filename:
            uploadData.filename,

        file_format:
            uploadData.file_format,

        storage_path:
            uploadData.path,

        file_url:
            null,

        extracted_text:
            null,

        word_count:
            0,

        similarity_score:
            0,

        risk_level:
            'low',

        matches:
            [],

        recommendation:
            'Document uploaded successfully. Text extraction is pending.',

        scan_status:
            'uploaded',

        scan_error:
            null

    };


    console.log(
        'Creating plagiarism report:',
        payload
    );


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('plagiarism_reports')

            .insert([
                payload
            ])

            .select()

            .single();


    if (error) {

        console.error(
            'Error creating plagiarism report:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 12. ADD PLAGIARISM REPORT
// ============================================================

window.addPlagiarismReport = async function (
    reportData
) {

    if (!reportData) {

        throw new Error(
            'Report data is required.'
        );

    }


    const userId =
        reportData.user_id;


    if (!userId) {

        throw new Error(
            'User ID is required to create a plagiarism report.'
        );

    }


    const similarityScore =
        Number(
            reportData.similarity_score ??
            reportData.similarity ??
            0
        );


    const payload = {

        user_id:
            userId,

        filename:
            reportData.filename,

        file_format:
            reportData.file_format,

        storage_path:
            reportData.storage_path ||
            null,

        file_url:
            reportData.file_url ||
            null,

        extracted_text:
            reportData.extracted_text ||
            null,

        word_count:
            Number(
                reportData.word_count ||
                0
            ),

        similarity_score:
            similarityScore,

        risk_level:
            reportData.risk_level ||
            'low',

        matches:
            reportData.matches ||
            [],

        recommendation:
            reportData.recommendation ||
            null,

        scan_status:
            reportData.scan_status ||
            'uploaded',

        scan_error:
            reportData.scan_error ||
            null

    };


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('plagiarism_reports')

            .insert([
                payload
            ])

            .select()

            .single();


    if (error) {

        console.error(
            'Error creating plagiarism report:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 13. UPDATE PLAGIARISM REPORT
// ============================================================
//
// Used later by the text extraction and plagiarism engine.
// ============================================================

window.updatePlagiarismReport = async function (

    reportId,

    updates

) {

    if (!reportId) {

        throw new Error(
            'Report ID is required.'
        );

    }


    if (!updates) {

        throw new Error(
            'Report updates are required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('plagiarism_reports')

            .update(updates)

            .eq(
                'report_id',
                reportId
            )

            .select()

            .single();


    if (error) {

        console.error(
            'Error updating plagiarism report:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 14. GET PLAGIARISM REPORTS FOR USER
// ============================================================

window.getPlagiarismReportsForUser = async function (
    userId
) {

    if (!userId) {

        throw new Error(
            'User ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('plagiarism_reports')

            .select('*')

            .eq(
                'user_id',
                userId
            )

            .order(
                'created_at',
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            'Error loading plagiarism reports:',
            error
        );

        throw error;

    }


    return data || [];

};


// ============================================================
// 15. GET SINGLE PLAGIARISM REPORT
// ============================================================

window.getPlagiarismReport = async function (
    reportId
) {

    if (!reportId) {

        throw new Error(
            'Report ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('plagiarism_reports')

            .select('*')

            .eq(
                'report_id',
                reportId
            )

            .single();


    if (error) {

        console.error(
            'Error fetching plagiarism report:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 16. ADD / SUBMIT TOPIC
// ============================================================

window.addTopic = async function (
    topicData
) {

    if (!topicData) {

        throw new Error(
            'Topic data is required.'
        );

    }


    if (!topicData.student_id) {

        throw new Error(
            'Student ID is required.'
        );

    }


    if (!topicData.title) {

        throw new Error(
            'Topic title is required.'
        );

    }


    if (!topicData.problem_statement) {

        throw new Error(
            'Problem statement is required.'
        );

    }


    if (!topicData.objectives) {

        throw new Error(
            'Objectives are required.'
        );

    }


    if (!topicData.research_area) {

        throw new Error(
            'Research area is required.'
        );

    }


    const payload = {

        student_id:
            topicData.student_id,

        title:
            topicData.title,

        problem_statement:
            topicData.problem_statement,

        objectives:
            topicData.objectives,

        keywords:
            topicData.keywords ||
            null,

        research_area:
            topicData.research_area,

        plagiarism_report_id:
            topicData.plagiarism_report_id ||
            null,

        status:
            topicData.status ||
            'pending'

    };


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('topics')

            .insert([
                payload
            ])

            .select()

            .single();


    if (error) {

        console.error(
            'Error submitting topic:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 17. GET CURRENT STUDENT'S TOPICS
// ============================================================

window.getMyTopics = async function (
    studentId
) {

    if (!studentId) {

        throw new Error(
            'Student ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('topics')

            .select(`
                topic_id,
                title,
                problem_statement,
                objectives,
                keywords,
                research_area,
                status,
                plagiarism_report_id,
                submitted_at
            `)

            .eq(
                'student_id',
                studentId
            )

            .order(
                'submitted_at',
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            'Error fetching student topics:',
            error
        );

        throw error;

    }


    return data || [];

};


// ============================================================
// 18. GET STUDENT TOPICS WITH PLAGIARISM REPORT
// ============================================================

window.getMyTopicsWithReports = async function (
    studentId
) {

    if (!studentId) {

        throw new Error(
            'Student ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('topics')

            .select(`
                topic_id,
                title,
                problem_statement,
                objectives,
                keywords,
                research_area,
                status,
                plagiarism_report_id,
                submitted_at,

                plagiarism_reports (
                    report_id,
                    user_id,
                    filename,
                    file_format,
                    storage_path,
                    similarity_score,
                    risk_level,
                    matches,
                    recommendation,
                    scan_status,
                    scan_error,
                    word_count,
                    created_at
                )
            `)

            .eq(
                'student_id',
                studentId
            )

            .order(
                'submitted_at',
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            'Error fetching topics with reports:',
            error
        );

        throw error;

    }


    return data || [];

};


// ============================================================
// 19. GET ALL TOPICS WITH REPORTS
// ============================================================

window.getAdminTopicsWithReports = async function () {

    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('topics')

            .select(`
                topic_id,
                title,
                problem_statement,
                objectives,
                keywords,
                research_area,
                status,
                submitted_at,
                student_id,
                plagiarism_report_id,

                plagiarism_reports (
                    report_id,
                    user_id,
                    filename,
                    file_format,
                    storage_path,
                    similarity_score,
                    risk_level,
                    matches,
                    recommendation,
                    scan_status,
                    scan_error,
                    word_count,
                    created_at
                )
            `)

            .order(
                'submitted_at',
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            'Error fetching admin topics:',
            error
        );

        throw error;

    }


    return data || [];

};


// ============================================================
// 20. GET SINGLE TOPIC
// ============================================================

window.getTopicById = async function (
    topicId
) {

    if (!topicId) {

        throw new Error(
            'Topic ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('topics')

            .select(`
                topic_id,
                title,
                problem_statement,
                objectives,
                keywords,
                research_area,
                status,
                submitted_at,
                student_id,
                plagiarism_report_id,

                plagiarism_reports (
                    report_id,
                    user_id,
                    filename,
                    file_format,
                    storage_path,
                    similarity_score,
                    risk_level,
                    matches,
                    recommendation,
                    scan_status,
                    scan_error,
                    word_count,
                    created_at
                )
            `)

            .eq(
                'topic_id',
                topicId
            )

            .single();


    if (error) {

        console.error(
            'Error fetching topic:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 21. UPDATE TOPIC APPROVAL STATUS
// ============================================================

window.updateTopicStatus = async function (

    topicId,

    newStatus

) {

    const allowedStatuses = [

        'pending',
        'approved',
        'revision',
        'rejected'

    ];


    if (
        !allowedStatuses
            .includes(newStatus)
    ) {

        throw new Error(
            'Invalid topic status.'
        );

    }


    if (!topicId) {

        throw new Error(
            'Topic ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('topics')

            .update({
                status: newStatus
            })

            .eq(
                'topic_id',
                topicId
            )

            .select()

            .single();


    if (error) {

        console.error(
            'Error updating topic status:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 22. SEND MESSAGE
// ============================================================

window.sendMessage = async function (

    senderId,

    receiverId,

    content,

    topicId = null

) {

    if (!senderId) {

        throw new Error(
            'Sender ID is required.'
        );

    }


    if (!receiverId) {

        throw new Error(
            'Receiver ID is required.'
        );

    }


    if (
        !content ||
        !content.trim()
    ) {

        throw new Error(
            'Message cannot be empty.'
        );

    }


    const payload = {

        sender_id:
            senderId,

        receiver_id:
            receiverId,

        content:
            content.trim(),

        topic_id:
            topicId ||
            null

    };


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('messages')

            .insert([
                payload
            ])

            .select()

            .single();


    if (error) {

        console.error(
            'Error sending message:',
            error
        );

        throw error;

    }


    return data;

};


// ============================================================
// 23. GET USER MESSAGES
// ============================================================

window.getUserMessages = async function (
    userId
) {

    if (!userId) {

        throw new Error(
            'User ID is required.'
        );

    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('messages')

            .select('*')

            .or(
                `sender_id.eq.${userId},receiver_id.eq.${userId}`
            )

            .order(
                'created_at',
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            'Error fetching messages:',
            error
        );

        throw error;

    }


    return data || [];

};


// ============================================================
// 24. GET PROFILE LIST
// ============================================================
//
// Useful for finding supervisors/admins.
// ============================================================

window.getSupervisorsAndAdmins = async function () {

    const {
        data,
        error
    } =
        await window.supabaseClient

            .from('profiles')

            .select(
                'id, email, full_name, role, department'
            )

            .in(
                'role',
                [
                    'supervisor',
                    'admin'
                ]
            )

            .order(
                'full_name',
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            'Error fetching supervisors:',
            error
        );

        throw error;

    }


    return data || [];

};


// ============================================================
// 25. SIGN OUT
// ============================================================

window.signOutUser = async function () {

    if (!window.supabaseClient) {

        window.location.href =
            '../login.html';

        return;

    }


    const {
        error
    } =
        await window.supabaseClient
            .auth
            .signOut();


    if (error) {

        console.error(
            'Sign out error:',
            error
        );

        throw error;

    }


    window.location.href =
        '../login.html';

};


// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================
//
// Some of your existing pages use:
// window.logoutUser()
//
// Keep it working.
// ============================================================

window.logoutUser = async function () {

    try {

        await window.signOutUser();

    }
    catch (error) {

        console.error(
            'Logout error:',
            error
        );

        alert(
            'Logout failed: ' +
            error.message
        );

    }

};


// ============================================================
// 26. GLOBAL TOAST HELPER
// ============================================================

window.showToast = function (

    message,

    type = 'info'

) {

    if (

        window.__intelliVerifyOriginalToast &&

        typeof window.__intelliVerifyOriginalToast ===
        'function'

    ) {

        window.__intelliVerifyOriginalToast(
            message,
            type
        );

        return;

    }


    const existingToast =
        document.getElementById(
            'intelliVerifyToast'
        );


    if (existingToast) {
        existingToast.remove();
    }


    const toast =
        document.createElement('div');


    toast.id =
        'intelliVerifyToast';


    toast.textContent =
        message;


    toast.style.position =
        'fixed';

    toast.style.bottom =
        '25px';

    toast.style.right =
        '25px';

    toast.style.zIndex =
        '99999';

    toast.style.padding =
        '14px 20px';

    toast.style.borderRadius =
        '10px';

    toast.style.color =
        '#fff';

    toast.style.fontFamily =
        'Poppins, sans-serif';

    toast.style.fontSize =
        '14px';

    toast.style.boxShadow =
        '0 5px 20px rgba(0,0,0,0.2)';

    toast.style.maxWidth =
        '400px';


    if (type === 'success') {

        toast.style.background =
            '#198754';

    }

    else if (

        type === 'danger' ||

        type === 'error'

    ) {

        toast.style.background =
            '#dc3545';

    }

    else if (
        type === 'warning'
    ) {

        toast.style.background =
            '#ffc107';

        toast.style.color =
            '#212529';

    }

    else {

        toast.style.background =
            '#0d6efd';

    }


    document.body.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.style.opacity =
                '0';

            toast.style.transition =
                'opacity 0.3s ease';


            setTimeout(
                () => {

                    toast.remove();

                },
                300
            );

        },
        3500
    );

};


// ============================================================
// 27. FILE FORMAT HELPER
// ============================================================

window.getFileExtension = function (
    filename
) {

    if (!filename) {
        return '';
    }


    return filename
        .split('.')
        .pop()
        .toLowerCase();

};


// ============================================================
// 28. FILE SIZE FORMATTER
// ============================================================

window.formatFileSize = function (
    bytes
) {

    if (
        !bytes ||
        bytes <= 0
    ) {

        return '0 Bytes';

    }


    const units = [

        'Bytes',
        'KB',
        'MB',
        'GB'

    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (

        parseFloat(
            (
                bytes /
                Math.pow(
                    1024,
                    index
                )
            ).toFixed(2)
        )

        +

        ' ' +

        units[index]

    );

};


// ============================================================
// 29. INITIALIZATION CHECK
// ============================================================

console.log(
    'IntelliVerify Supabase configuration loaded.'
);

console.log(
    'Supabase URL:',
    SUPABASE_URL
);

console.log(
    'Storage bucket:',
    window.INTELLIVERIFY_STORAGE_BUCKET
);
