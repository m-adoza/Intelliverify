// ============================================================
// INTELLIVERIFY SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL = 'https://ecvvxyavruvkqrinvkax.supabase.co';

// Replace this with your Supabase ANON/PUBLISHABLE key.
// NEVER put the service_role/secret key in frontend JavaScript.
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';


// ============================================================
// CREATE SUPABASE CLIENT
// ============================================================

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// GET CURRENT USER
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

    return session ? session.user : null;
};


// ============================================================
// ADD PLAGIARISM REPORT
// ============================================================

window.addPlagiarismReport = async function (reportData) {

    const userId = reportData.user_id;

    if (!userId) {
        throw new Error('User ID is required.');
    }

    const payload = {
        user_id: userId,

        filename: reportData.filename,

        file_format: reportData.file_format,

        similarity_score: Number(
            reportData.similarity_score ??
            reportData.similarity ??
            0
        ),

        risk_level: reportData.risk_level,

        matches: reportData.matches || [],

        recommendation: reportData.recommendation || null,

        file_url: reportData.file_url || null
    };

    console.log('Saving plagiarism report:', payload);

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
// GET USER PLAGIARISM REPORTS
// ============================================================

window.getPlagiarismReportsForUser = async function (userId) {

    if (!userId) {
        throw new Error('User ID is required.');
    }

    const {
        data,
        error
    } = await window.supabaseClient
        .from('plagiarism_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', {
            ascending: false
        });

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
// ADD TOPIC
// ============================================================

window.addTopic = async function (topicData) {

    const payload = {
        student_id: topicData.student_id,

        title: topicData.title,

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

    console.log('Saving topic:', payload);

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
            'Error creating topic:',
            error
        );

        throw error;
    }

    return data;
};


// ============================================================
// GET ALL TOPICS + PLAGIARISM REPORTS
// FOR SUPERVISOR / ADMIN
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
        .order('submitted_at', {
            ascending: false
        });

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
// UPDATE TOPIC STATUS
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
            'Invalid topic status: ' + newStatus
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
        .eq('topic_id', topicId)
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
