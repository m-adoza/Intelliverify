// ============================================================
// INTELLIVERIFY BACKEND SERVER
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');


// ============================================================
// EXPRESS APP
// ============================================================

const app = express();


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(express.json({
    limit: '10mb'
}));

app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));


// ============================================================
// FRONTEND FOLDER
// ============================================================
//
// Your project currently uses "fronted".
// This automatically supports either:
//
// frontend/
// OR
// fronted/
//
// so we don't accidentally break your existing structure.
// ============================================================

const frontendFolderName =
    fs.existsSync(
        path.join(__dirname, 'frontend')
    )
        ? 'frontend'
        : 'fronted';

const staticPath =
    path.join(
        __dirname,
        frontendFolderName
    );


// ============================================================
// SERVE FRONTEND
// ============================================================

app.use(
    express.static(staticPath)
);
// Serve shared JavaScript files
app.use(
    '/js', express.static(path.join(__dirname, 'js'))
);

// ============================================================
// SUPABASE SERVER CLIENT
// ============================================================
//
// IMPORTANT:
// The backend uses the SERVICE ROLE KEY.
// This must ONLY exist in Render/environment variables.
//
// DO NOT put the service-role key inside frontend files.
// ============================================================

const supabaseUrl =
    process.env.SUPABASE_URL;

const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


let supabase = null;


if (
    supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    supabaseServiceRoleKey
) {

    supabase =
        createClient(
            supabaseUrl,
            supabaseServiceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

} else {

    console.warn(
        '⚠️ Supabase backend credentials are not configured.'
    );

}


// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {

    res.json({

        status: 'online',

        supabaseConnected:
            Boolean(supabase),

        frontendFolder:
            frontendFolderName,

        timestamp:
            new Date().toISOString()

    });

});


// ============================================================
// USER REGISTRATION
// ============================================================

app.post('/api/register', async (req, res) => {

    try {

        if (!supabase) {

            return res.status(500).json({
                error:
                    'Database connection not configured on server.'
            });

        }


        const {
            email,
            password,
            fullName,
            role,
            department
        } = req.body;


        // ----------------------------------------------------
        // Validate required fields
        // ----------------------------------------------------

        if (
            !email ||
            !password ||
            !fullName ||
            !role
        ) {

            return res.status(400).json({
                error:
                    'Please fill in all required fields.'
            });

        }


        // ----------------------------------------------------
        // Validate role
        // ----------------------------------------------------

        const allowedRoles = [
            'student',
            'supervisor',
            'admin'
        ];


        if (
            !allowedRoles.includes(role)
        ) {

            return res.status(400).json({
                error:
                    'Invalid user role.'
            });

        }


        // ----------------------------------------------------
        // Create Supabase Auth user
        // ----------------------------------------------------

        const {
            data: authData,
            error: authError
        } =
            await supabase.auth.admin.createUser({

                email,

                password,

                email_confirm: true,

                user_metadata: {

                    full_name:
                        fullName,

                    role:
                        role

                }

            });


        if (authError) {

            console.error(
                'Supabase Auth registration error:',
                authError
            );

            return res.status(400).json({
                error:
                    authError.message
            });

        }


        const user =
            authData?.user;


        if (!user) {

            return res.status(400).json({
                error:
                    'Failed to create user account.'
            });

        }


        // ----------------------------------------------------
        // The database trigger should automatically create
        // the profiles row.
        //
        // We then update it with the registration details.
        // ----------------------------------------------------

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from('profiles')
                .update({

                    email:
                        email,

                    full_name:
                        fullName,

                    role:
                        role,

                    department:
                        department ||
                        'Computer Science'

                })
                .eq(
                    'id',
                    user.id
                )
                .select()
                .single();


        if (profileError) {

            console.error(
                'Profile update error:',
                profileError
            );


            // ------------------------------------------------
            // If profile creation/update fails, remove the
            // newly created Auth account to avoid leaving an
            // incomplete account behind.
            // ------------------------------------------------

            try {

                await supabase.auth.admin.deleteUser(
                    user.id
                );

            } catch (deleteError) {

                console.error(
                    'Failed to rollback Auth user:',
                    deleteError
                );

            }


            return res.status(500).json({

                error:
                    'Account was created but the profile could not be saved: ' +
                    profileError.message

            });

        }


        // ----------------------------------------------------
        // Registration successful
        // ----------------------------------------------------

        return res.status(201).json({

            message:
                'Registration successful! You can now log in.',

            user: {

                id:
                    user.id,

                email:
                    user.email,

                fullName:
                    profile?.full_name ||
                    fullName,

                role:
                    profile?.role ||
                    role,

                department:
                    profile?.department ||
                    department ||
                    'Computer Science'

            }

        });

    } catch (error) {

        console.error(
            'Registration exception:',
            error
        );


        return res.status(500).json({

            error:
                'Server error during registration.'

        });

    }

});


// ============================================================
// USER LOGIN
// ============================================================

app.post('/api/login', async (req, res) => {

    try {

        if (!supabase) {

            return res.status(500).json({

                error:
                    'Database connection not configured.'

            });

        }


        const {
            email,
            password
        } = req.body;


        // ----------------------------------------------------
        // Validate input
        // ----------------------------------------------------

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({

                error:
                    'Email and password are required.'

            });

        }


        // ----------------------------------------------------
        // Authenticate user
        // ----------------------------------------------------

        const {
            data,
            error
        } =
            await supabase.auth.signInWithPassword({

                email,
                password

            });


        if (error) {

            return res.status(401).json({

                error:
                    error.message

            });

        }


        if (
            !data ||
            !data.user ||
            !data.session
        ) {

            return res.status(401).json({

                error:
                    'Login failed. No active session was created.'

            });

        }


        // ----------------------------------------------------
        // Fetch profile
        // ----------------------------------------------------

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    role,
                    department,
                    created_at
                `)
                .eq(
                    'id',
                    data.user.id
                )
                .single();


        if (profileError) {

            console.error(
                'Profile lookup error:',
                profileError
            );


            return res.status(500).json({

                error:
                    'Unable to load user profile.'

            });

        }


        // ----------------------------------------------------
        // Successful login
        // ----------------------------------------------------

        return res.json({

            message:
                'Login successful',

            token:
                data.session.access_token,

            refreshToken:
                data.session.refresh_token,

            user: {

                id:
                    data.user.id,

                email:
                    data.user.email,

                fullName:
                    profile?.full_name ||
                    data.user.user_metadata?.full_name ||
                    'Student',

                role:
                    profile?.role ||
                    data.user.user_metadata?.role ||
                    'student',

                department:
                    profile?.department ||
                    'Computer Science'

            }

        });

    } catch (error) {

        console.error(
            'Login exception:',
            error
        );


        return res.status(500).json({

            error:
                'Server error during login.'

        });

    }

});


// ============================================================
// GET CURRENT USER PROFILE
// ============================================================
//
// This endpoint will be useful for dashboard/profile pages.
// The frontend sends:
//
// Authorization: Bearer <access_token>
// ============================================================

app.get('/api/profile', async (req, res) => {

    try {

        if (!supabase) {

            return res.status(500).json({

                error:
                    'Database connection not configured.'

            });

        }


        const authHeader =
            req.headers.authorization;


        if (
            !authHeader ||
            !authHeader.startsWith('Bearer ')
        ) {

            return res.status(401).json({

                error:
                    'Authorization token is required.'

            });

        }


        const token =
            authHeader.replace(
                'Bearer ',
                ''
            );


        const {
            data: userData,
            error: userError
        } =
            await supabase.auth.getUser(
                token
            );


        if (
            userError ||
            !userData?.user
        ) {

            return res.status(401).json({

                error:
                    'Invalid or expired authentication token.'

            });

        }


        const user =
            userData.user;


        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    role,
                    department,
                    created_at
                `)
                .eq(
                    'id',
                    user.id
                )
                .single();


        if (profileError) {

            return res.status(500).json({

                error:
                    'Unable to retrieve profile.'

            });

        }


        return res.json({

            user: profile

        });

    } catch (error) {

        console.error(
            'Profile endpoint error:',
            error
        );


        return res.status(500).json({

            error:
                'Server error while loading profile.'

        });

    }

});


// ============================================================
// API 404 HANDLER
// ============================================================
//
// This prevents unknown API requests from falling through to
// index.html.
// ============================================================

app.use('/api', (req, res) => {

    res.status(404).json({

        error:
            'API endpoint not found.'

    });

});


// ============================================================
// FRONTEND FALLBACK
// ============================================================
//
// Allows the Express server to serve the frontend application.
// ============================================================

app.get('*', (req, res) => {

    const indexPath =
        path.join(
            staticPath,
            'index.html'
        );


    if (
        fs.existsSync(indexPath)
    ) {

        return res.sendFile(
            indexPath
        );

    }


    return res.status(404).send(
        'Backend is running, but index.html was not found.'
    );

});


// ============================================================
// START SERVER
// ============================================================

const PORT =
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `🚀 IntelliVerify Server running on port ${PORT}`
        );

        console.log(
            `📁 Frontend folder: ${frontendFolderName}`
        );

        console.log(
            `🗄️ Supabase connected: ${Boolean(supabase)}`
        );

    }
);
