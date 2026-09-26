/*
===============================================================
 INTELLIVERIFY - SUPABASE CONFIGURATION
 Location:
 /js/supabase-config.js

 IMPORTANT:
 - This file is FRONTEND code.
 - The publishable key is safe to expose here.
 - NEVER put the Supabase SERVICE ROLE key here.
 - Backend/server operations use Render environment variables.

 Current database profile columns:
 - id
 - email
 - full_name
 - role
 - department
 - created_at

 NOTE:
 matric_no is intentionally NOT requested because it does not
 currently exist in the profiles table.
===============================================================
*/

(function () {
    'use strict';

    /* =========================================================
       SUPABASE CONNECTION
    ========================================================= */

    const SUPABASE_URL =
        'https://yxgxzflcgrzfndzxqibg.supabase.co';

    const SUPABASE_PUBLISHABLE_KEY =
        'sb_publishable_MSQ4teFGuhQt0xLWa2pZvA_FEWY7Qml';

    const STORAGE_BUCKET = 'project-documents';


    /* =========================================================
       CHECK SUPABASE LIBRARY
    ========================================================= */

    if (!window.supabase) {
        console.error(
            'IntelliVerify: Supabase JavaScript library was not loaded.'
        );

        return;
    }


    /* =========================================================
       CREATE SUPABASE CLIENT
    ========================================================= */

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


    /* =========================================================
       EXPOSE CLIENT GLOBALLY
    ========================================================= */

    window.supabaseClient = supabaseClient;

    window.INTELLIVERIFY_SUPABASE_URL = SUPABASE_URL;

    window.INTELLIVERIFY_STORAGE_BUCKET = STORAGE_BUCKET;


    /* =========================================================
       GET CURRENT AUTHENTICATED USER
    ========================================================= */

    window.getCurrentUser = async function () {

        try {

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

        } catch (error) {

            console.error(
                'getCurrentUser exception:',
                error
            );

            return null;
        }
    };


    /* =========================================================
       GET CURRENT SESSION
    ========================================================= */

    window.getCurrentSession = async function () {

        try {

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

        } catch (error) {

            console.error(
                'getCurrentSession exception:',
                error
            );

            return null;
        }
    };


    /* =========================================================
       GET USER PROFILE
       
       IMPORTANT:
       We ONLY request columns that currently exist in
       the profiles table.
    ========================================================= */

    window.getUserProfile = async function (userId = null) {

        try {

            const user = await window.getCurrentUser();

            const id = userId || user?.id;

            if (!id) {
                return null;
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
                    'getUserProfile error:',
                    error
                );

                throw error;
            }

            return data;

        } catch (error) {

            console.error(
                'getUserProfile exception:',
                error
            );

            throw error;
        }
    };


    /* =========================================================
       LOGIN USER
       
       1. Authenticate with Supabase Auth
       2. Retrieve profile
       3. Return profile to login.html
    ========================================================= */

    window.loginUser = async function (email, password) {

        if (!email || !password) {
            throw new Error(
                'Email and password are required.'
            );
        }

        try {

            /* -----------------------------------------------
               AUTHENTICATE
            ------------------------------------------------ */

            const {
                data: authData,
                error: authError
            } = await supabaseClient.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });

            if (authError) {
                throw authError;
            }

            if (!authData?.user) {
                throw new Error(
                    'Login succeeded, but no authenticated user was returned.'
                );
            }


            /* -----------------------------------------------
               LOAD PROFILE
            ------------------------------------------------ */

            let profile;

            try {

                profile =
                    await window.getUserProfile(
                        authData.user.id
                    );

            } catch (profileError) {

                /*
                 * Authentication succeeded, but profile
                 * retrieval failed.
                 */

                throw new Error(
                    'Login succeeded, but your user profile could not be loaded: ' +
                    profileError.message
                );
            }


            if (!profile) {

                throw new Error(
                    'Login succeeded, but no user profile was found.'
                );
            }


            /* -----------------------------------------------
               RETURN PROFILE
            ------------------------------------------------ */

            return {

                id: profile.id,

                email:
                    profile.email ||
                    authData.user.email,

                full_name:
                    profile.full_name ||
                    authData.user.user_metadata?.full_name ||
                    '',

                role:
                    profile.role ||
                    authData.user.user_metadata?.role ||
                    'student',

                department:
                    profile.department || null,

                created_at:
                    profile.created_at || null
            };

        } catch (error) {

            console.error(
                'loginUser error:',
                error
            );

            throw error;
        }
    };


    /* =========================================================
       REGISTER USER
       
       Creates:
       1. Supabase Auth account
       2. profiles table record
       
       IMPORTANT:
       matric_no is NOT inserted because the current
       profiles table does not contain that column.
    ========================================================= */

    window.registerUser = async function ({
        email,
        password,
        fullName,
        role = 'student',
        department = null
    }) {

        if (!email || !password || !fullName) {
            throw new Error(
                'Email, password and full name are required.'
            );
        }

        try {

            /* -----------------------------------------------
               CREATE AUTH ACCOUNT
            ------------------------------------------------ */

            const {
                data: authData,
                error: authError
            } = await supabaseClient.auth.signUp({

                email: email.trim(),

                password: password,

                options: {

                    data: {
                        full_name: fullName,
                        role: role,
                        department: department
                    }
                }
            });


            if (authError) {
                throw authError;
            }


            if (!authData?.user) {

                throw new Error(
                    'Failed to create user account.'
                );
            }


            /* -----------------------------------------------
               CREATE PROFILE
            ------------------------------------------------ */

            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from('profiles')
                .insert({

                    id: authData.user.id,

                    email: email.trim(),

                    full_name: fullName,

                    role: role,

                    department: department || null

                })
                .select(`
                    id,
                    email,
                    full_name,
                    role,
                    department,
                    created_at
                `)
                .single();


            if (profileError) {

                console.error(
                    'Profile creation error:',
                    profileError
                );

                throw new Error(
                    'Account was created, but the user profile could not be saved: ' +
                    profileError.message
                );
            }


            return profile;

        } catch (error) {

            console.error(
                'registerUser error:',
                error
            );

            throw error;
        }
    };


    /* =========================================================
       LOGOUT USER
    ========================================================= */

    window.logoutUser = async function () {

        try {

            const {
                error
            } = await supabaseClient.auth.signOut();

            if (error) {
                throw error;
            }

            /*
             * Return user to the main portal.
             */

            window.location.href = '/';

        } catch (error) {

            console.error(
                'logoutUser error:',
                error
            );

            throw error;
        }
    };


    /* =========================================================
       CHECK WHETHER USER IS LOGGED IN
    ========================================================= */

    window.isUserLoggedIn = async function () {

        const session =
            await window.getCurrentSession();

        return Boolean(session);
    };


    /* =========================================================
       GET USER ROLE
    ========================================================= */

    window.getUserRole = async function () {

        try {

            const profile =
                await window.getUserProfile();

            return profile?.role || null;

        } catch (error) {

            console.error(
                'getUserRole error:',
                error
            );

            return null;
        }
    };


    /* =========================================================
       PROTECT PAGE
       
       Redirects unauthenticated users to login.html
    ========================================================= */

    window.requireAuthentication = async function () {

        const user =
            await window.getCurrentUser();

        if (!user) {

            window.location.href =
                '/login.html';

            return false;
        }

        return true;
    };


    /* =========================================================
       PROTECT ROLE
    ========================================================= */

    window.requireRole = async function (allowedRoles = []) {

        const profile =
            await window.getUserProfile();

        if (!profile) {

            window.location.href =
                '/login.html';

            return false;
        }

        const userRole =
            String(profile.role || '')
                .toLowerCase();

        const roles =
            allowedRoles.map(role =>
                String(role).toLowerCase()
            );

        if (!roles.includes(userRole)) {

            console.warn(
                'Unauthorized role:',
                userRole
            );

            window.location.href =
                '/';

            return false;
        }

        return true;
    };


    /* =========================================================
       STORAGE - UPLOAD FILE
    ========================================================= */

    window.uploadProjectFile = async function (
        file,
        filePath
    ) {

        if (!file) {
            throw new Error(
                'No file was provided.'
            );
        }

        if (!filePath) {
            throw new Error(
                'A storage file path is required.'
            );
        }

        try {

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
                        upsert: false
                    }
                );

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {

            console.error(
                'File upload error:',
                error
            );

            throw error;
        }
    };


    /* =========================================================
       STORAGE - GET FILE URL
    ========================================================= */

    window.getProjectFileUrl = function (
        filePath
    ) {

        if (!filePath) {
            return null;
        }

        const {
            data
        } = supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        return data?.publicUrl || null;
    };


    /* =========================================================
       STORAGE - DELETE FILE
    ========================================================= */

    window.deleteProjectFile = async function (
        filePath
    ) {

        if (!filePath) {
            throw new Error(
                'File path is required.'
            );
        }

        try {

            const {
                error
            } = await supabaseClient
                .storage
                .from(STORAGE_BUCKET)
                .remove([filePath]);

            if (error) {
                throw error;
            }

            return true;

        } catch (error) {

            console.error(
                'File deletion error:',
                error
            );

            throw error;
        }
    };


    /* =========================================================
       DATABASE HELPER
       
       Fetch records from a table.
    ========================================================= */

    window.fetchTable = async function (
        table,
        options = {}
    ) {

        try {

            let query =
                supabaseClient
                    .from(table)
                    .select(
                        options.select || '*'
                    );

            if (options.column && options.value !== undefined) {

                query =
                    query.eq(
                        options.column,
                        options.value
                    );
            }

            if (options.orderBy) {

                query =
                    query.order(
                        options.orderBy,
                        {
                            ascending:
                                options.ascending !== false
                        }
                    );
            }

            const {
                data,
                error
            } = await query;

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {

            console.error(
                `fetchTable(${table}) error:`,
                error
            );

            throw error;
        }
    };


    /* =========================================================
       AUTH STATE LISTENER
    ========================================================= */

    supabaseClient.auth.onAuthStateChange(
        (event, session) => {

            console.log(
                'IntelliVerify Auth Event:',
                event
            );

            window.dispatchEvent(
                new CustomEvent(
                    'intelliverify-auth-change',
                    {
                        detail: {
                            event: event,
                            session: session
                        }
                    }
                )
            );
        }
    );


    /* =========================================================
       INITIALIZATION MESSAGE
    ========================================================= */

    console.log(
        'IntelliVerify Supabase client initialized successfully.'
    );

})();
