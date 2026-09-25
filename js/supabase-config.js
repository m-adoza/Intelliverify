// ============================================================
// INTELLIVERIFY - SUPABASE CONFIGURATION
// ============================================================

// ============================================================
// SUPABASE CONNECTION
// ============================================================

const SUPABASE_URL = 'https://ecvvxyavruvkqrinvkax.supabase.co';

// IMPORTANT:
// Replace this with your Supabase ANON/PUBLISHABLE KEY.
// DO NOT use your service_role/secret key in frontend code.
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';


// ============================================================
// CREATE SUPABASE CLIENT
// ============================================================

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// GET CURRENT AUTHENTICATED USER
// ============================================================

window.getCurrentUser = async function () {

    const {
        data: { session },
        error
    } = await window.supabaseClient.auth.getSession();

    if (error) {
        console.error('Session error:', error);
        return null;
    }

    if (!session) {
        return null;
    }

    return session.user;
};


// ============================================================
// GET CURRENT USER PROFILE
// ============================================================

window.getCurrentUserProfile = async function () {

    const user = await window.getCurrentUser();

    if (!user) {
        return null;
    }

    const {
        data,
        error
    } = await window.supabaseClient
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
// ADD PLAGIARISM REPORT
// ============================================================
//
// Matches the actual plagiarism_reports table:
//
// report_id
// user_id
// filename
// file_format
// similarity_score
// risk_level
// matches
// recommendation
// file_url
// created_at
// ============================================================

window.addPlagiarismReport = async function (reportData) {

    const userId = reportData.user_id;

    if (!userId) {
        throw new Error(
            'User ID is required to create a plagiarism report.'
        );
    }

    const similarityScore = Number(
        reportData.similarity_score ??
        reportData.similarity ??
        0
    );

    const payload = {

        user_id: userId,

        filename: reportData.filename,

        file_format: reportData.file_format,

        similarity_score: similarityScore,

        risk_level: reportData.risk_level,

        matches: reportData.matches || [],

        recommendation:
            reportData.recommendation || null,

        file_url:
            reportData.file_url || null
    };


    console.log(
        'Saving plagiarism report:',
        payload
    );


    const {
        data,
        error
    } = await window.supabaseClient
        .from('plagiarism_reports')
        .insert([payload])
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
// GET PLAGIARISM REPORTS FOR CURRENT USER
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
    } = await window.supabaseClient
        .from('plagiarism_reports')
        .select('*')
        .eq('user_id', userId)
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
// GET SINGLE PLAGIARISM REPORT
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
    } = await window.supabaseClient
        .from('plagiarism_reports')
        .select('*')
        .eq('report_id', reportId)
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
// ADD / SUBMIT TOPIC
// ============================================================
//
// Matches the actual topics table:
//
// topic_id
// student_id
// title
// problem_statement
// objectives
// keywords
// research_area
// status
// plagiarism_report_id
// submitted_at
// ============================================================

window.addTopic = async function (topicData) {

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
            topicData.keywords || null,

        research_area:
            topicData.research_area,

        plagiarism_report_id:
            topicData.plagiarism_report_id || null,

        status:
            topicData.status || 'pending'
    };


    console.log(
        'Submitting topic:',
        payload
    );


    const {
        data,
        error
    } = await window.supabaseClient
        .from('topics')
        .insert([payload])
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
// GET CURRENT STUDENT'S TOPICS
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
    } = await window.supabaseClient
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
        .eq('student_id', studentId)
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
// GET ALL TOPICS WITH ATTACHED PLAGIARISM REPORTS
// FOR SUPERVISOR / ADMIN REVIEW
// ============================================================

window.getAdminTopicsWithReports = async function () {

    const {
        data,
        error
    } = await window.supabaseClient
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
// GET SINGLE TOPIC
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
    } = await window.supabaseClient
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
// UPDATE TOPIC APPROVAL STATUS
// ============================================================
//
// Allowed statuses:
//
// pending
// approved
// revision
// rejected
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


    if (!allowedStatuses.includes(newStatus)) {

        throw new Error(
            'Invalid topic status. Allowed values: pending, approved, revision, rejected.'
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
    } = await window.supabaseClient
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
// SEND MESSAGE
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

    if (!content || !content.trim()) {
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
            topicId || null
    };


    const {
        data,
        error
    } = await window.supabaseClient
        .from('messages')
        .insert([payload])
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
// GET USER MESSAGES
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
    } = await window.supabaseClient
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
// SIGN OUT
// ============================================================

window.signOutUser = async function () {

    const {
        error
    } = await window.supabaseClient.auth.signOut();


    if (error) {

        console.error(
            'Sign out error:',
            error
        );

        throw error;
    }


    window.location.href = '/';
};


// ============================================================
// GLOBAL TOAST HELPER
// ============================================================

window.showToast = function (
    message,
    type = 'info'
) {

    // If the project already has a showToast implementation,
    // don't replace it.
    if (
        window.__intelliVerifyOriginalToast &&
        typeof window.__intelliVerifyOriginalToast === 'function'
    ) {
        window.__intelliVerifyOriginalToast(
            message,
            type
        );

        return;
    }


    // Simple fallback notification
    const toast = document.createElement('div');

    toast.textContent = message;

    toast.style.position = 'fixed';
    toast.style.bottom = '25px';
    toast.style.right = '25px';
    toast.style.zIndex = '99999';
    toast.style.padding = '14px 20px';
    toast.style.borderRadius = '10px';
    toast.style.color = '#fff';
    toast.style.fontFamily = 'Poppins, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.boxShadow =
        '0 5px 20px rgba(0,0,0,0.2)';


    if (type === 'success') {
        toast.style.background = '#198754';
    }
    else if (
        type === 'danger' ||
        type === 'error'
    ) {
        toast.style.background = '#dc3545';
    }
    else if (type === 'warning') {
        toast.style.background = '#ffc107';
        toast.style.color = '#212529';
    }
    else {
        toast.style.background = '#0d6efd';
    }


    document.body.appendChild(toast);


    setTimeout(() => {

        toast.style.opacity = '0';
        toast.style.transition =
            'opacity 0.3s ease';

        setTimeout(() => {
            toast.remove();
        }, 300);

    }, 3000);
};
