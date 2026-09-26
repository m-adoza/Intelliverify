// ============================================================
// INTELLIVERIFY - SUPABASE CONFIGURATION
// ============================================================
// Shared frontend configuration
//
// Location:
// intelliverify/js/supabase-config.js
//
// Used by:
// fronted/login.html
// fronted/register.html
// fronted/student/*.html
// fronted/admin/*.html
//
// IMPORTANT:
// This file contains ONLY the Supabase ANON/PUBLISHABLE key.
// NEVER put the Supabase service_role/secret key here.
// ============================================================


// ============================================================
// 1. SUPABASE CONNECTION
// ============================================================

const SUPABASE_URL =
    'https://yxgxzflcgrzfndzxqibg.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzIiwicmVmIjoieXhnemZsY2dyemZuZHp4cWliZyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkwMjQzOTA1LCJleHAiOjIxMDU4MTk5MDV9.DK159oguwZwpw31QoaEB0x0Rz4wTICJo6M5yrmVMwkM';


// ============================================================
// 2. STORAGE CONFIGURATION
// ============================================================

const DOCUMENT_BUCKET =
    'project-documents';


// Allowed document formats for IntelliVerify
const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',

    'application/msword',

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    'text/plain'
];


// Maximum upload size
// Your Supabase bucket is currently configured for 10 MB.
const MAX_DOCUMENT_SIZE =
    10 * 1024 * 1024;


// ============================================================
// 3. CREATE SUPABASE CLIENT
// ============================================================

if (!window.supabase) {

    console.error(
        'Supabase JavaScript library was not loaded.'
    );

} else {

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
        data,
        error
    } =
        await window.supabaseClient.auth.getUser();

    if (error) {

        console.error(
            'Get current user error:',
            error
        );

        return null;
    }

    return data?.user || null;
};


// ============================================================
// 5. GET CURRENT SESSION
// ============================================================

window.getCurrentSession = async function () {

    if (!window.supabaseClient) {
        throw new Error(
            'Supabase client is not initialized.'
        );
    }

    const {
        data,
        error
    } =
        await window.supabaseClient.auth.getSession();

    if (error) {

        console.error(
            'Get session error:',
            error
        );

        return null;
    }

    return data?.session || null;
};


// ============================================================
// 6. LOGIN USER
// ============================================================
// This fixes the previous:
// "Login service is unavailable"
// problem.
//
// We authenticate directly through Supabase Auth using
// the safe frontend ANON key.
//
// The user's profile is then loaded from public.profiles.
// ============================================================

window.loginUser = async function (
    email,
    password
) {

    if (!email || !password) {

        throw new Error(
            'Email and password are required.'
        );

    }


    if (!window.supabaseClient) {

        throw new Error(
            'Supabase client is not initialized.'
        );

    }


    // Authenticate with Supabase Auth
    const {
        data: authData,
        error: authError
    } =
        await window.supabaseClient.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });


    if (authError) {

        console.error(
            'Supabase login error:',
            authError
        );

        throw new Error(
            authError.message ||
            'Invalid email or password.'
        );

    }


    const user =
        authData?.user;


    if (!user) {

        throw new Error(
            'Login succeeded but no user was returned.'
        );

    }


    // Retrieve application profile
    const {
        data: profile,
        error: profileError
    } =
        await window.supabaseClient
            .from('profiles')
            .select(
                'id, email, full_name, role, department, created_at'
            )
            .eq(
                'id',
                user.id
            )
            .single();


    if (profileError) {

        console.error(
            'Profile lookup error:',
            profileError
        );

        // Authentication succeeded, but profile was not found.
        // We sign out so the application doesn't leave the user
        // in a partially authenticated state.
        await window.supabaseClient.auth.signOut();

        throw new Error(
            'Login succeeded, but your IntelliVerify profile could not be loaded.'
        );

    }


    return profile;

};


// ============================================================
// 7. LOGOUT / SIGN OUT
// ============================================================

window.signOutUser = async function () {

    if (!window.supabaseClient) {
        window.location.href = '/';
        return;
    }


    const {
        error
    } =
        await window.supabaseClient.auth.signOut();


    if (error) {

        console.error(
            'Sign out error:',
            error
        );

        throw error;
    }


    window.location.href = '/';

};


// Backward-compatible logout alias
window.logoutUser = window.signOutUser;


// ============================================================
// 8. GET CURRENT USER PROFILE
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
            .select(
                'id, email, full_name, role, department, created_at'
            )
            .eq(
                'id',
                user.id
            )
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
// 9. DOCUMENT VALIDATION
// ============================================================

window.validateDocumentFile = function (file) {

    if (!file) {

        throw new Error(
            'Please select a document.'
        );

    }


    if (
        !ALLOWED_DOCUMENT_TYPES.includes(
            file.type
        )
    ) {

        // Some browsers may not correctly identify .doc/.docx.
        // Check extension as a fallback.
        const extension =
            file.name
                .split('.')
                .pop()
                .toLowerCase();


        const allowedExtensions = [
            'pdf',
            'doc',
            'docx',
            'txt'
        ];


        if (
            !allowedExtensions.includes(
                extension
            )
        ) {

            throw new Error(
                'Unsupported document format. Please upload PDF, DOC, DOCX, or TXT.'
            );

        }

    }


    if (
        file.size >
        MAX_DOCUMENT_SIZE
    ) {

        throw new Error(
            'File is too large. Maximum allowed size is 10 MB.'
        );

    }


    return true;

};


// ============================================================
// 10. UPLOAD DOCUMENT TO SUPABASE STORAGE
// ============================================================
//
// Storage bucket:
//
// project-documents
//
// Files are organized as:
//
// project-documents/
//     user-id/
//         timestamp-filename
//
// The function returns the storage path.
//
// We store the PATH in plagiarism_reports.file_url.
// This is safer than storing a temporary signed URL.
// ============================================================

window.uploadDocument = async function (
    file
) {

    const user =
        await window.getCurrentUser();


    if (!user) {

        throw new Error(
            'You must be logged in before uploading a document.'
        );

    }


    window.validateDocumentFile(
        file
    );


    // Clean filename
    const cleanFilename =
        file.name
            .replace(
                /[^a-zA-Z0-9._-]/g,
                '_'
            );


    const timestamp =
        Date.now();


    const storagePath =
        `${user.id}/${timestamp}-${cleanFilename}`;


    console.log(
        'Uploading document:',
        storagePath
    );


    const {
        data,
        error
    } =
        await window.supabaseClient
            .storage
            .from(
                DOCUMENT_BUCKET
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
            'Document upload error:',
            error
        );

        throw new Error(
            'Document upload failed: ' +
            error.message
        );

    }


    return {

        path:
            data.path,

        fullPath:
            data.fullPath,

        filename:
            file.name,

        fileFormat:
            file.name
                .split('.')
                .pop()
                .toLowerCase(),

        size:
            file.size,

        mimeType:
            file.type

    };

};


// ============================================================
// 11. CREATE SIGNED DOCUMENT URL
// ============================================================
//
// Useful if project-documents is a PRIVATE bucket.
//
// URL expires after the requested number of seconds.
// ============================================================

window.getDocumentSignedUrl = async function (
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
                DOCUMENT_BUCKET
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


    return data?.signedUrl || null;

};


// ============================================================
// 12. DELETE DOCUMENT FROM STORAGE
// ============================================================

window.deleteDocument = async function (
    storagePath
) {

    if (!storagePath) {

        throw new Error(
            'Storage path is required.'
        );

    }


    const {
        data: files,
        error: listError
    } =
        await window.supabaseClient
            .storage
            .from(
                DOCUMENT_BUCKET
            )
            .list(
                storagePath.split('/')[0]
            );


    // We don't require the list operation to succeed for deletion.
    // The actual remove operation below determines the result.

    if (listError) {
        console.warn(
            'Storage list warning:',
            listError
        );
    }


    const {
        error
    } =
        await window.supabaseClient
            .storage
            .from(
                DOCUMENT_BUCKET
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
// 13. ADD PLAGIARISM REPORT
// ============================================================

window.addPlagiarismReport = async function (
    reportData
) {

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

        file_url:
            reportData.file_url ||
            null

    };


    console.log(
        'Saving plagiarism report:',
        payload
    );


    const {
        data,
        error
    } =
        await window.supabaseClient
            .from(
                'plagiarism_reports'
            )
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
// 14. GET PLAGIARISM REPORTS FOR CURRENT USER
// ============================================================

window.getPlagiarismReportsForUser =
    async function (
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
                .from(
                    'plagiarism_reports'
                )
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

window.getPlagiarismReport =
    async function (
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
                .from(
                    'plagiarism_reports'
                )
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
            .from(
                'topics'
            )
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
// 17. GET CURRENT STUDENT TOPICS
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
            .from(
                'topics'
            )
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


// Compatibility function.
// Your older approval-status.html calls getStudentTopics().
window.getStudentTopics = async function (
    studentId
) {

    const topics =
        await window.getMyTopics(
            studentId
        );


    // Attach the corresponding plagiarism report
    // to each topic when one exists.
    const reportIds =
        topics
            .map(
                topic =>
                    topic.plagiarism_report_id
            )
            .filter(Boolean);


    if (reportIds.length === 0) {

        return topics;

    }


    const {
        data: reports,
        error
    } =
        await window.supabaseClient
            .from(
                'plagiarism_reports'
            )
            .select('*')
            .in(
                'report_id',
                reportIds
            );


    if (error) {

        console.warn(
            'Could not load topic plagiarism reports:',
            error
        );

        return topics;

    }


    return topics.map(
        topic => ({

            ...topic,

            plagiarism_reports:
                reports?.find(
                    report =>
                        report.report_id ===
                        topic.plagiarism_report_id
                ) || null

        })
    );

};


// ============================================================
// 18. GET ALL TOPICS WITH REPORTS
// ============================================================

window.getAdminTopicsWithReports =
    async function () {

        const {
            data,
            error
        } =
            await window.supabaseClient
                .from(
                    'topics'
                )
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
                        similarity_score,
                        risk_level,
                        matches,
                        recommendation,
                        file_url,
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
// 19. GET SINGLE TOPIC
// ============================================================

window.getTopicById =
    async function (
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
                .from(
                    'topics'
                )
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
                        similarity_score,
                        risk_level,
                        matches,
                        recommendation,
                        file_url,
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
// 20. UPDATE TOPIC APPROVAL STATUS
// ============================================================

window.updateTopicStatus =
    async function (
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
            !allowedStatuses.includes(
                newStatus
            )
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
                .from(
                    'topics'
                )
                .update({
                    status:
                        newStatus
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
// 21. SEND MESSAGE
// ============================================================

window.sendMessage =
    async function (
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
                .from(
                    'messages'
                )
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
// 22. GET USER MESSAGES
// ============================================================

window.getUserMessages =
    async function (
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
                .from(
                    'messages'
                )
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
// 23. TOAST HELPER
// ============================================================

window.showToast =
    function (
        message,
        type = 'info'
    ) {

        // Use existing application toast if one exists.
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


        const toast =
            document.createElement(
                'div'
            );


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


        if (
            type === 'success'
        ) {

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
            3000
        );

    };


// ============================================================
// 24. CONFIGURATION READY MESSAGE
// ============================================================

console.log(
    'IntelliVerify Supabase configuration loaded successfully.'
);

console.log(
    'Storage bucket:',
    DOCUMENT_BUCKET
);
