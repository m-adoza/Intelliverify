// ============================================================
// SUPABASE CLIENTS
// ============================================================
// Two clients:
//
//   admin  — service role. Bypasses RLS. Server-only.
//            Used for privileged writes: creating reports,
//            updating topic status, changing roles.
//
//   asUser — anon key + user's JWT. Enforces RLS as that user.
//            Used for user-scoped reads so authorization is
//            validated by Postgres, not by our code.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Set them in .env (local) or Render → Environment (production).'
    );
    process.exit(1);
}

if (!ANON_KEY) {
    console.warn(
        'SUPABASE_ANON_KEY is not set. User-scoped queries will fail.'
    );
}

// Privileged client — never sent to the browser
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Per-request user-scoped client
function asUser(accessToken) {
    return createClient(SUPABASE_URL, ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        global: {
            headers: { Authorization: `Bearer ${accessToken}` }
        }
    });
}

module.exports = {
    admin,
    asUser,
    SUPABASE_URL
};
