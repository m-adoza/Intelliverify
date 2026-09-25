// Plagiarism Reports DB Methods
window.addPlagiarismReport = async function(reportData) {
    const { data, error } = await window.supabaseClient
        .from('plagiarism_reports')
        .insert([{
            user_id: reportData.user_id,
            filename: reportData.filename,
            file_format: reportData.file_format,
            similarity_score: reportData.similarity,
            risk_level: reportData.risk_level,
            matches: reportData.matches,
            recommendation: reportData.recommendation,
            file_url: reportData.file_url
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

window.getPlagiarismReportsForUser = async function(userId) {
    const { data, error } = await window.supabaseClient
        .from('plagiarism_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

// Topic Submission DB Method
window.addTopic = async function(topicData) {
    const { data, error } = await window.supabaseClient
        .from('topics')
        .insert([topicData])
        .select()
        .single();
    if (error) throw error;
    return data;
};
