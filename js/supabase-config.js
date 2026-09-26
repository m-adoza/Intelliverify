/* ============================================================
   INTELLIVERIFY - SUPABASE CONFIGURATION
   Location:
   /js/supabase-config.js

   Used by:
   - Login
   - Registration
   - Student dashboard
   - Topic submission
   - Approval status
   - Plagiarism reports
   - Messages
   - Supabase Storage uploads

   IMPORTANT:
   The anon key is safe to expose in frontend code.
   NEVER put the Supabase SERVICE ROLE KEY here.
   ============================================================ */

(function () {
    'use strict';

    /* ============================================================
       SUPABASE CONNECTION
       ============================================================ */

    const SUPABASE_URL =
        'https://yxgxzflcgrzfndzxqibg.supabase.co';

    const SUPABASE_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Z3h6ZmxjZ3J6Zm5kenhxaWJnIiwicm9sZSI6Inl4Z3h6ZmxjZ3J6Zm5kenhxaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDM5MDUsImV4cCI6MjEwNTgxOTkwNX0.DK159oguwZwpw31QoaEB0x0Rz4wTICJo6M5yrmVMwkM';

    const STORAGE_BUCKET = 'project-documents';

    /* ============================================================
       CHECK SUPABASE LIBRARY
       ============================================================ */

    if (!window.supabase) {
        console.error(
            'IntelliVerify: Supabase JavaScript library was not loaded.'
        );
        return;
    }

    /* ============================================================
       CREATE SUPABASE CLIENT
       ============================================================ */

    const supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

    /* ============================================================
       EXPOSE CLIENT GLOBALLY
       ============================================================ */

    window.supabaseClient = supabaseClient;

    window.INTELLIVERIFY_SUPABASE_URL = SUPABASE_URL;
    window.INTELLIVERIFY_STORAGE_BUCKET = STORAGE_BUCKET;


    /* ============================================================
       GET CURRENT AUTHENTICATED USER
       ============================================================ */

    window.getCurrentUser = async function () {

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();

        if (error) {
            console.error(
                'getCurrentUser error:',
                error
            );

            return null;
        }

        return data?.user || null;
    };


    /* ============================================================
       GET CURRENT SESSION
       ============================================================ */

    window.getCurrentSession = async function () {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error(
                'getCurrentSession error:',
                error
            );

            return null;
        }

        return data?.session || null;
    };


    /* ============================================================
       GET USER PROFILE
       ============================================================ */

    window.getUserProfile = async function (userId = null) {

        try {

            let id = userId;

            if (!id) {

                const user =
                    await window.getCurrentUser();

                if (!user) {
                    return null;
                }

                id = user.id;
            }


            const {
                data,
                error
            } = await supabaseClient
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    role,
                    department,
                    created_at
                `)
                .eq('id', id)
                .single();


            if (error) {

                console.error(
                    'Profile lookup error:',
                    error
                );

                return null;
            }


            return data;

        } catch (error) {

            console.error(
                'getUserProfile error:',
                error
            );

            return null;
        }
    };


    /* ============================================================
       LOGIN USER
       ============================================================ */

    window.loginUser = async function (
        email,
        password
    ) {

        if (!email || !password) {
            throw new Error(
                'Email and password are required.'
            );
        }


        /* --------------------------------------------------------
           AUTHENTICATE WITH SUPABASE
           -------------------------------------------------------- */

        const {
            data: authData,
            error: authError
        } = await supabaseClient.auth.signInWithPassword({
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


        const user = authData?.user;


        if (!user) {

            throw new Error(
                'Login succeeded but no user account was returned.'
            );
        }


        /* --------------------------------------------------------
           GET PROFILE
           -------------------------------------------------------- */

        let profile =
            await window.getUserProfile(user.id);


        /* --------------------------------------------------------
           FALLBACK TO AUTH METADATA
           -------------------------------------------------------- */

        if (!profile) {

            profile = {

                id: user.id,

                email:
                    user.email || email,

                full_name:
                    user.user_metadata?.full_name ||
                    'Academic User',

                role:
                    user.user_metadata?.role ||
                    'student',

                department:
                    user.user_metadata?.department ||
                    'Computer Science',

                created_at:
                    user.created_at
            };
        }


        /* --------------------------------------------------------
           NORMALIZE ROLE
           -------------------------------------------------------- */

        profile.role =
            String(
                profile.role || 'student'
            ).toLowerCase().trim();


        /* --------------------------------------------------------
           SAVE PROFILE LOCALLY
           -------------------------------------------------------- */

        try {

            localStorage.setItem(
                'intelliverify_profile',
                JSON.stringify(profile)
            );

        } catch (storageError) {

            console.warn(
                'Could not save profile locally:',
                storageError
            );
        }


        return profile;
    };


    /* ============================================================
       LOGOUT
       ============================================================ */

    window.logoutUser = async function () {

        const {
            error
        } = await supabaseClient.auth.signOut();

        if (error) {

            console.error(
                'Logout error:',
                error
            );

            throw error;
        }


        try {

            localStorage.removeItem(
                'intelliverify_profile'
            );

        } catch (error) {

            console.warn(
                'Could not clear local profile:',
                error
            );
        }
    };


    /* ============================================================
       STORAGE - UPLOAD DOCUMENT
       ============================================================ */

    window.uploadDocument = async function (
        file,
        folder = 'documents'
    ) {

        if (!file) {
            throw new Error(
                'No document was selected.'
            );
        }


        const user =
            await window.getCurrentUser();


        if (!user) {
            throw new Error(
                'You must be logged in before uploading a document.'
            );
        }


        /* --------------------------------------------------------
           ALLOWED FILE TYPES
           -------------------------------------------------------- */

        const allowedTypes = [

            'application/pdf',

            'application/msword',

            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

            'text/plain',

            'application/vnd.oasis.opendocument.text'
        ];


        const allowedExtensions = [
            'pdf',
            'doc',
            'docx',
            'txt',
            'odt'
        ];


        const extension =
            file.name
                .split('.')
                .pop()
                .toLowerCase();


        if (
            !allowedExtensions.includes(
                extension
            )
        ) {

            throw new Error(
                'Unsupported file type. Please upload PDF, DOC, DOCX, TXT or ODT.'
            );
        }


        /* --------------------------------------------------------
           SIZE CHECK
           -------------------------------------------------------- */

        const maxSize =
            10 * 1024 * 1024;


        if (file.size > maxSize) {

            throw new Error(
                'File is too large. Maximum allowed size is 10 MB.'
            );
        }


        /* --------------------------------------------------------
           SAFE FILE NAME
           -------------------------------------------------------- */

        const cleanName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    '_'
                );


        const timestamp =
            Date.now();


        const randomPart =
            Math.random()
                .toString(36)
                .substring(2, 10);


        /*
         * Every user gets their own folder.
         *
         * Example:
         *
         * documents/
         *   USER_UUID/
         *      1758890000-ab12-topic.docx
         */

        const filePath =
            `${folder}/${user.id}/${timestamp}-${randomPart}-${cleanName}`;


        /* --------------------------------------------------------
           UPLOAD TO SUPABASE STORAGE
           -------------------------------------------------------- */

        const {
            data,
            error
        } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .upload(
                filePath,
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

            size:
                file.size,

            type:
                file.type,

            extension:
                extension,

            bucket:
                STORAGE_BUCKET
        };
    };


    /* ============================================================
       STORAGE - GET SIGNED URL
       ============================================================ */

    window.getDocumentUrl = async function (
        filePath,
        expiresIn = 3600
    ) {

        if (!filePath) {
            throw new Error(
                'Document path is required.'
            );
        }


        const {
            data,
            error
        } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(
                filePath,
                expiresIn
            );


        if (error) {

            console.error(
                'Signed URL error:',
                error
            );

            throw new Error(
                'Could not generate document URL: ' +
                error.message
            );
        }


        return data.signedUrl;
    };


    /* ============================================================
       STORAGE - DELETE DOCUMENT
       ============================================================ */

    window.deleteDocument = async function (
        filePath
    ) {

        if (!filePath) {
            throw new Error(
                'Document path is required.'
            );
        }


        const {
            error
        } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .remove([
                filePath
            ]);


        if (error) {

            console.error(
                'Delete document error:',
                error
            );

            throw new Error(
                'Could not delete document: ' +
                error.message
            );
        }


        return true;
    };


    /* ============================================================
       CREATE PLAGIARISM REPORT RECORD
       ============================================================ */

    window.createPlagiarismReport = async function ({
        filename,
        fileFormat,
        similarityScore = 0,
        riskLevel = 'low',
        matches = [],
        recommendation = '',
        fileUrl = null
    }) {

        const user =
            await window.getCurrentUser();


        if (!user) {

            throw new Error(
                'You must be logged in.'
            );
        }


        const {
            data,
            error
        } = await supabaseClient
            .from('plagiarism_reports')
            .insert([
                {

                    user_id:
                        user.id,

                    filename:
                        filename,

                    file_format:
                        fileFormat,

                    similarity_score:
                        similarityScore,

                    risk_level:
                        riskLevel,

                    matches:
                        matches,

                    recommendation:
                        recommendation,

                    file_url:
                        fileUrl
                }
            ])
            .select()
            .single();


        if (error) {

            console.error(
                'Create plagiarism report error:',
                error
            );

            throw error;
        }


        return data;
    };


    /* ============================================================
       GET USER'S PLAGIARISM REPORTS
       ============================================================ */

    window.getMyPlagiarismReports = async function () {

        const user =
            await window.getCurrentUser();


        if (!user) {
            return [];
        }


        const {
            data,
            error
        } = await supabaseClient
            .from('plagiarism_reports')
            .select('*')
            .eq('user_id', user.id)
            .order(
                'created_at',
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                'Load plagiarism reports error:',
                error
            );

            throw error;
        }


        return data || [];
    };


    /* ============================================================
       GET USER'S TOPICS
       ============================================================ */

    window.getMyTopics = async function () {

        const user =
            await window.getCurrentUser();


        if (!user) {
            return [];
        }


        const {
            data,
            error
        } = await supabaseClient
            .from('topics')
            .select('*')
            .eq('student_id', user.id)
            .order(
                'submitted_at',
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                'Load topics error:',
                error
            );

            throw error;
        }


        return data || [];
    };


    /* ============================================================
       GET SINGLE TOPIC
       ============================================================ */

    window.getTopic = async function (
        topicId
    ) {

        const {
            data,
            error
        } = await supabaseClient
            .from('topics')
            .select('*')
            .eq(
                'topic_id',
                topicId
            )
            .single();


        if (error) {

            console.error(
                'Get topic error:',
                error
            );

            throw error;
        }


        return data;
    };


    /* ============================================================
       SUBMIT TOPIC
       ============================================================ */

    window.submitTopic = async function ({
        title,
        problemStatement,
        objectives,
        keywords,
        researchArea,
        plagiarismReportId = null
    }) {

        const user =
            await window.getCurrentUser();


        if (!user) {

            throw new Error(
                'You must be logged in to submit a topic.'
            );
        }


        if (!title ||
            !problemStatement ||
            !objectives ||
            !researchArea
        ) {

            throw new Error(
                'Please complete all required topic fields.'
            );
        }


        const {
            data,
            error
        } = await supabaseClient
            .from('topics')
            .insert([
                {

                    student_id:
                        user.id,

                    title:
                        title.trim(),

                    problem_statement:
                        problemStatement.trim(),

                    objectives:
                        objectives.trim(),

                    keywords:
                        keywords
                            ? keywords.trim()
                            : null,

                    research_area:
                        researchArea.trim(),

                    status:
                        'pending',

                    plagiarism_report_id:
                        plagiarismReportId
                }
            ])
            .select()
            .single();


        if (error) {

            console.error(
                'Topic submission error:',
                error
            );

            throw error;
        }


        return data;
    };


    /* ============================================================
       GET PROFILE FROM LOCAL STORAGE
       ============================================================ */

    window.getCachedProfile = function () {

        try {

            const saved =
                localStorage.getItem(
                    'intelliverify_profile'
                );


            return saved
                ? JSON.parse(saved)
                : null;

        } catch (error) {

            return null;
        }
    };


    /* ============================================================
       AUTH STATE LISTENER
       ============================================================ */

    supabaseClient.auth.onAuthStateChange(
        (event, session) => {

            console.log(
                'IntelliVerify auth event:',
                event
            );


            if (session?.user) {

                console.log(
                    'Authenticated user:',
                    session.user.email
                );

            } else {

                console.log(
                    'No authenticated user.'
                );
            }
        }
    );


    /* ============================================================
       CONFIGURATION TEST
       ============================================================ */

    console.log(
        'IntelliVerify Supabase configuration loaded.'
    );

    console.log(
        'Supabase URL:',
        SUPABASE_URL
    );

    console.log(
        'Storage bucket:',
        STORAGE_BUCKET
    );

})();
