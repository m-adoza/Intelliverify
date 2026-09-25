// ============================================================
// INTELLIVERIFY DATABASE FUNCTIONS
// Supabase Database Methods
// ============================================================


// ============================================================
// PLAGIARISM REPORTS
// ============================================================

window.addPlagiarismReport = async function(reportData) {

    const { data, error } = await window.supabaseClient
        .from('plagiarism_reports')
        .insert([{
            user_id: reportData.user_id,
            filename: reportData.filename,
            file_format: reportData.file_format,

            // JS receives "similarity"
            // Database stores "similarity_score"
            similarity_score: reportData.similarity,

            risk_level: reportData.risk_level,
            matches: reportData.matches || [],
            recommendation: reportData.recommendation || null,
            file_url: reportData.file_url || null
        }])
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


window.getPlagiarismReportsForUser = async function(userId) {

    const { data, error } = await window.supabaseClient
        .from('plagiarism_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', {
            ascending: false
        });

    if (error) {
        console.error(
            'Error fetching plagiarism reports:',
            error
        );
        throw error;
    }

    return data || [];
};


// ============================================================
// TOPICS
// ============================================================

window.addTopic = async function(topicData) {

    const { data, error } = await window.supabaseClient
        .from('topics')
        .insert([{
            student_id: topicData.student_id,
            title: topicData.title,
            problem_statement: topicData.problem_statement,
            objectives: topicData.objectives,
            keywords: topicData.keywords || null,
            research_area: topicData.research_area,
            plagiarism_report_id:
                topicData.plagiarism_report_id || null,

            // IMPORTANT:
            // Database allows pending, approved,
            // revision and rejected.
            status: topicData.status || 'pending'
        }])
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
// ADMIN / SUPERVISOR TOPIC REVIEW
// ============================================================

window.getAdminTopicsWithReports = async function() {

    const { data, error } = await window.supabaseClient
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

window.updateTopicStatus = async function(
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
            `Invalid topic status: ${newStatus}`
        );
    }

    const { data, error } = await window.supabaseClient
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
