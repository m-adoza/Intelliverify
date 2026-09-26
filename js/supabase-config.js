/*
=========================================================
 INTELLIVERIFY - SUPABASE CONFIGURATION
 Location: /js/supabase-config.js

 Used by:
 - Login
 - Registration
 - Student dashboard
 - Topic submission
 - Approval status
 - Plagiarism reports
 - Messages
 - File uploads

 IMPORTANT:
 The publishable key is safe for frontend use.
 NEVER put the Supabase SERVICE ROLE key here.
=========================================================
*/

(function () {
    'use strict';

    // =====================================================
    // SUPABASE CONNECTION
    // =====================================================

    const SUPABASE_URL =
        'https://yxgxzflcgrzfndzxqibg.supabase.co';

    const SUPABASE_PUBLISHABLE_KEY =
        'sb_publishable_MSQ4teFGuhQt0xLWa2pZvA_FEWY7Qml';

    const STORAGE_BUCKET = 'project-documents';


    // =====================================================
    // CHECK SUPABASE LIBRARY
    // =====================================================

    if (!window.supabase) {
        console.error(
            'IntelliVerify: Supabase JavaScript library was not loaded.'
        );
        return;
    }


    // =====================================================
    // CREATE SUPABASE CLIENT
    // =====================================================

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );


    // =====================================================
    // EXPOSE CLIENT GLOBALLY
    // =====================================================

    window.supabaseClient = supabaseClient;
    window.INTELLIVERY_SUPABASE_URL = SUPABASE_URL;
    window.INTELLIVERY_STORAGE_BUCKET = STORAGE_BUCKET;


    // =====================================================
    // GET CURRENT USER
    // =====================================================

    window.getCurrentUser = async function () {

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();

        if (error) {
            console.error('getCurrentUser error:', error);
            return null;
        }

        return data.user || null;
    };


    // =====================================================
    // GET CURRENT SESSION
    // =====================================================

    window.getCurrentSession = async function () {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('getCurrentSession error:', error);
            return null;
        }

        return data.session || null;
    };


    // =====================================================
    // LOGIN USER
    // =====================================================

    window.loginUser = async function (email, password) {

        // -------------------------------------------------
        // Authenticate with Supabase Auth
        // -------------------------------------------------

        const {
            data: authData,
            error: authError
        } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            console.error('Supabase login error:', authError);
            throw new Error(authError.message);
        }

        if (!authData || !authData.user) {
            throw new Error('Login failed. No user account was returned.');
        }


        // -------------------------------------------------
        // Get user profile
        // -------------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from('profiles')
            .select(`
                id,
                email,
                full_name,
                role,
                department,
                matric_no,
                created_at
            `)
            .eq('id', authData.user.id)
            .single();


        if (profileError) {

            console.error(
                'Profile retrieval error:',
                profileError
            );

            // Authentication succeeded, but profile lookup failed.
            // Sign the user out so we don't leave a partially
            // authenticated session behind.

            await supabaseClient.auth.signOut();

            throw new Error(
                'Login succeeded, but your user profile could not be loaded: ' +
                profileError.message
            );
        }


        // -------------------------------------------------
        // Return complete profile
        // -------------------------------------------------

        return {
            id: profile.id,
            email: profile.email || authData.user.email,
            full_name:
                profile.full_name ||
                authData.user.user_metadata?.full_name ||
                '',
            role: profile.role || 'student',
            department: profile.department || null,
            matric_no: profile.matric_no || null,
            created_at: profile.created_at || null
        };
    };


    // =====================================================
    // LOGOUT
    // =====================================================

    window.logoutUser = async function () {

        const {
            error
        } = await supabaseClient.auth.signOut();

        if (error) {
            console.error('Logout error:', error);
            throw new Error(error.message);
        }

        return true;
    };


    // =====================================================
    // GET CURRENT USER PROFILE
    // =====================================================

    window.getUserProfile = async function () {

        const user = await window.getCurrentUser();

        if (!user) {
            return null;
        }

        const {
            data: profile,
            error
        } = await supabaseClient
            .from('profiles')
            .select(`
                id,
                email,
                full_name,
                role,
                department,
                matric_no,
                created_at
            `)
            .eq('id', user.id)
            .single();

        if (error) {
            console.error(
                'getUserProfile error:',
                error
            );

            return null;
        }

        return profile;
    };


    // =====================================================
    // SUPABASE STORAGE HELPERS
    // =====================================================

    window.uploadProjectFile = async function (
        file,
        filePath
    ) {

        if (!file) {
            throw new Error('No file selected.');
        }

        const {
            data,
            error
        } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(
                filePath,
                file,
                {
                    upsert: false
                }
            );

        if (error) {
            console.error(
                'File upload error:',
                error
            );

            throw new Error(error.message);
        }

        return data;
    };


    // =====================================================
    // GET STORAGE FILE URL
    // =====================================================

    window.getProjectFileUrl = function (filePath) {

        const {
            data
        } = supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        return data.publicUrl;
    };


    // =====================================================
    // READY MESSAGE
    // =====================================================

    console.log(
        'IntelliVerify: Supabase client initialized successfully.'
    );

})();
