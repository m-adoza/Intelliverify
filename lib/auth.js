// ============================================================
// AUTH MIDDLEWARE
// ============================================================
// requireAuth  — verifies the Bearer JWT, loads the profile,
//                attaches req.user and req.supabase (user client).
//
// requireRole  — factory. Restricts a route to specific roles.
// ============================================================

const { admin, asUser } = require('./supabase');
const { ApiError } = require('./errors');

async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization || '';

        if (!header.startsWith('Bearer ')) {
            throw new ApiError(401, 'Authorization header missing.');
        }

        const token = header.slice(7).trim();
        if (!token) {
            throw new ApiError(401, 'Authorization token is empty.');
        }

        // Verify the token with Supabase Auth
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data?.user) {
            throw new ApiError(401, 'Invalid or expired session.');
        }

        // Load the profile (source of truth for role)
        const { data: profile, error: profileError } = await admin
            .from('profiles')
            .select('id, email, full_name, role, department, pairing_code')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            throw new ApiError(403, 'User profile not found.');
        }

        // Attach to request
        req.user = {
            id: profile.id,
            email: profile.email,
            profile
        };
        req.supabase = asUser(token);

        next();
    } catch (err) {
        next(err);
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Authentication required.'));
        }
        if (!roles.includes(req.user.profile.role)) {
            return next(new ApiError(
                403,
                `This action requires role: ${roles.join(' or ')}.`
            ));
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
