-- ============================================================
-- INTELLIVERIFY 2.0 — COMPLETE DATABASE SCHEMA
-- ============================================================
-- Supabase / PostgreSQL
--
-- Fresh, unified schema for:
--   1. Multi-role authentication (student / supervisor / admin)
--   2. Many-to-many supervisor-student pairing via codes
--   3. Topic submission + status workflow with audit trail
--   4. Plagiarism scans against supervisor-uploaded corpus
--   5. Document storage (private buckets)
--   6. Realtime messaging
--   7. In-app notifications
--
-- Design notes:
--   • All user references point to public.profiles(id), not auth.users(id),
--     so PostgREST can auto-embed relationships.
--   • RLS is strict. Clients can only read what they own or supervise.
--   • Every privileged write goes through the Express backend
--     (service role key). The browser cannot fake scores or roles.
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 2. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 PROFILES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    email TEXT UNIQUE NOT NULL,

    full_name TEXT,

    role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'supervisor', 'admin')),

    department TEXT DEFAULT 'Computer Science',

    -- Pairing code: only populated for students. Null for
    -- supervisors and admins.
    pairing_code TEXT UNIQUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2.2 ASSIGNMENTS  (many-to-many supervisor ↔ student)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    supervisor_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    -- How the link was created. Codes are student-initiated,
    -- admin is an override.
    linked_by TEXT NOT NULL
        CHECK (linked_by IN ('code', 'admin')),

    linked_at TIMESTAMPTZ DEFAULT NOW(),

    -- A supervisor can only be linked to a student once.
    UNIQUE (supervisor_id, student_id)
);


-- ------------------------------------------------------------
-- 2.3 DOCUMENTS  (corpus + student submissions)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    uploaded_by UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    -- 'corpus' = supervisor-supplied reference document
    -- 'submission' = student-uploaded document
    purpose TEXT NOT NULL
        CHECK (purpose IN ('corpus', 'submission')),

    filename TEXT NOT NULL,
    file_format TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,

    -- Path inside the storage bucket
    storage_path TEXT NOT NULL,

    extracted_text TEXT,
    word_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2.4 PLAGIARISM REPORTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plagiarism_reports (
    report_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    -- Link back to the stored document
    document_id UUID
        REFERENCES public.documents(id)
        ON DELETE SET NULL,

    -- Original file info (denormalized for quick display)
    filename TEXT NOT NULL,
    file_format TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    storage_path TEXT NOT NULL,

    -- Extracted content snapshot
    extracted_text TEXT,
    word_count INTEGER DEFAULT 0,

    -- Results
    similarity_score NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (similarity_score >= 0 AND similarity_score <= 100),

    risk_level TEXT NOT NULL DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high')),

    matches JSONB NOT NULL DEFAULT '[]'::jsonb,

    recommendation TEXT,

    -- Processing pipeline state
    scan_status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (scan_status IN (
            'uploaded',
            'extracting',
            'scanning',
            'completed',
            'failed'
        )),

    scan_error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);


-- ------------------------------------------------------------
-- 2.5 TOPICS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.topics (
    topic_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,
    problem_statement TEXT NOT NULL,
    objectives TEXT NOT NULL,
    keywords TEXT,
    research_area TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'revision',
            'rejected'
        )),

    -- Optional attached plagiarism report (must be ≤30%)
    plagiarism_report_id UUID
        REFERENCES public.plagiarism_reports(report_id)
        ON DELETE SET NULL,

    -- Latest reviewer (whichever linked supervisor acted)
    reviewer_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    reviewer_comment TEXT,
    reviewed_at TIMESTAMPTZ,

    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2.6 TOPIC STATUS HISTORY  (audit trail)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.topic_status_history (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    topic_id UUID NOT NULL
        REFERENCES public.topics(topic_id)
        ON DELETE CASCADE,

    actor_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    old_status TEXT,
    new_status TEXT NOT NULL,
    comment TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2.7 MESSAGES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.messages (
    message_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    receiver_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    -- Optional topic context
    topic_id UUID
        REFERENCES public.topics(topic_id)
        ON DELETE SET NULL,

    content TEXT NOT NULL,

    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2.8 NOTIFICATIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    type TEXT NOT NULL,

    title TEXT NOT NULL,
    body TEXT,

    -- Frontend route to open on click
    link TEXT,

    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role
    ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_pairing_code
    ON public.profiles(pairing_code);

CREATE INDEX IF NOT EXISTS idx_assignments_supervisor
    ON public.assignments(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_assignments_student
    ON public.assignments(student_id);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by
    ON public.documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_documents_purpose
    ON public.documents(purpose);

CREATE INDEX IF NOT EXISTS idx_reports_user
    ON public.plagiarism_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_reports_status
    ON public.plagiarism_reports(scan_status);

CREATE INDEX IF NOT EXISTS idx_topics_student
    ON public.topics(student_id);

CREATE INDEX IF NOT EXISTS idx_topics_status
    ON public.topics(status);

CREATE INDEX IF NOT EXISTS idx_topics_submitted
    ON public.topics(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_topic
    ON public.topic_status_history(topic_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver
    ON public.messages(receiver_id);

CREATE INDEX IF NOT EXISTS idx_messages_created
    ON public.messages(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON public.notifications(user_id, is_read)
    WHERE is_read = FALSE;


-- ============================================================
-- 4. HELPER FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 CURRENT USER ROLE
-- Returns the role of the currently authenticated user.
-- SECURITY DEFINER bypasses RLS on profiles, avoiding
-- recursion when profiles has RLS policies that call this.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ------------------------------------------------------------
-- 4.2 IS ADMIN
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;


-- ------------------------------------------------------------
-- 4.3 GENERATE PAIRING CODE
-- Format: IV-XXXXXX
-- Charset excludes 0/O and 1/I/L to avoid transcription errors.
-- Loops until a unique code is found.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_code  TEXT;
    v_taken BOOLEAN;
    i       INT;
BEGIN
    LOOP
        v_code := 'IV-';

        FOR i IN 1..6 LOOP
            v_code := v_code ||
                substr(
                    v_chars,
                    floor(random() * length(v_chars))::int + 1,
                    1
                );
        END LOOP;

        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE pairing_code = v_code
        ) INTO v_taken;

        EXIT WHEN NOT v_taken;
    END LOOP;

    RETURN v_code;
END;
$$;


-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- 5.1 AUTO UPDATE updated_at
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS reports_updated_at ON public.plagiarism_reports;
CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON public.plagiarism_reports
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS topics_updated_at ON public.topics;
CREATE TRIGGER topics_updated_at
    BEFORE UPDATE ON public.topics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ------------------------------------------------------------
-- 5.2 AUTO-CREATE PROFILE ON SIGNUP
-- Runs after auth.users insert.
--   • Students get a fresh pairing code.
--   • Metadata can only set role to 'student' or 'supervisor'.
--     Admins must be promoted by another admin via backend.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_code TEXT;
BEGIN
    v_role := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'role', ''),
        'student'
    );

    -- Never trust metadata for admin promotion.
    IF v_role NOT IN ('student', 'supervisor') THEN
        v_role := 'student';
    END IF;

    IF v_role = 'student' THEN
        v_code := public.generate_pairing_code();
    ELSE
        v_code := NULL;
    END IF;

    INSERT INTO public.profiles (
        id, email, full_name, role, department, pairing_code
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            'Academic User'
        ),
        v_role,
        COALESCE(
            NEW.raw_user_meta_data->>'department',
            'Computer Science'
        ),
        v_code
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------
-- 5.3 PREVENT ROLE + PAIRING CODE ESCALATION
-- Only service_role (the Express backend) can change role
-- or pairing_code. Blocks an obvious privilege-escalation path.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_jwt_role TEXT;
BEGIN
    v_jwt_role :=
        current_setting('request.jwt.claims', true)::json->>'role';

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
            RAISE EXCEPTION
                'Role changes require service_role privileges';
        END IF;
    END IF;

    IF NEW.pairing_code IS DISTINCT FROM OLD.pairing_code THEN
        IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
            RAISE EXCEPTION
                'Pairing code changes require service_role privileges';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();


-- ------------------------------------------------------------
-- 5.4 FREEZE PLAGIARISM SCORES AFTER COMPLETION
-- Once a report reaches scan_status = 'completed', its
-- score, risk_level and matches can never change.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.freeze_plagiarism_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.scan_status = 'completed' THEN
        IF NEW.similarity_score IS DISTINCT FROM OLD.similarity_score
           OR NEW.risk_level IS DISTINCT FROM OLD.risk_level
           OR NEW.matches IS DISTINCT FROM OLD.matches
        THEN
            RAISE EXCEPTION
                'Cannot modify a completed plagiarism report';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_freeze_score ON public.plagiarism_reports;
CREATE TRIGGER reports_freeze_score
    BEFORE UPDATE ON public.plagiarism_reports
    FOR EACH ROW EXECUTE FUNCTION public.freeze_plagiarism_score();


-- ------------------------------------------------------------
-- 5.5 RESTRICT NOTIFICATION UPDATES
-- Clients may only flip is_read. Everything else is immutable.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_notification_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.user_id    IS DISTINCT FROM OLD.user_id
       OR NEW.type    IS DISTINCT FROM OLD.type
       OR NEW.title   IS DISTINCT FROM OLD.title
       OR NEW.body    IS DISTINCT FROM OLD.body
       OR NEW.link    IS DISTINCT FROM OLD.link
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Only is_read can be modified on notifications';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_restrict_update ON public.notifications;
CREATE TRIGGER notifications_restrict_update
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.restrict_notification_update();


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plagiarism_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 6.1 PROFILES
-- Read: own profile, linked profiles, all admins, or self as admin.
-- Write: backend only (no policy for INSERT/UPDATE/DELETE).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR public.is_admin()
        OR role = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE (a.supervisor_id = auth.uid() AND a.student_id = profiles.id)
               OR (a.student_id    = auth.uid() AND a.supervisor_id = profiles.id)
        )
    );


-- ------------------------------------------------------------
-- 6.2 ASSIGNMENTS
-- Read: supervisor, student, or admin involved.
-- Write: backend only.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS assignments_select_policy ON public.assignments;
CREATE POLICY assignments_select_policy
    ON public.assignments
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = supervisor_id
        OR auth.uid() = student_id
        OR public.is_admin()
    );


-- ------------------------------------------------------------
-- 6.3 DOCUMENTS
-- Read: own documents, supervised students' submissions,
--       any corpus document (for supervisors), or admin.
-- Write: backend only.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS documents_select_policy ON public.documents;
CREATE POLICY documents_select_policy
    ON public.documents
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = uploaded_by
        OR public.is_admin()
        OR (
            purpose = 'corpus'
            AND public.current_user_role() = 'supervisor'
        )
        OR (
            purpose = 'submission'
            AND EXISTS (
                SELECT 1 FROM public.assignments a
                WHERE a.supervisor_id = auth.uid()
                  AND a.student_id    = documents.uploaded_by
            )
        )
    );


-- ------------------------------------------------------------
-- 6.4 PLAGIARISM REPORTS
-- Read: own, supervised students', or admin.
-- Write: backend only.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS reports_select_policy ON public.plagiarism_reports;
CREATE POLICY reports_select_policy
    ON public.plagiarism_reports
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.supervisor_id = auth.uid()
              AND a.student_id    = plagiarism_reports.user_id
        )
    );


-- ------------------------------------------------------------
-- 6.5 TOPICS
-- Read: own, supervised students', or admin.
-- Write: backend only.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS topics_select_policy ON public.topics;
CREATE POLICY topics_select_policy
    ON public.topics
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = student_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.supervisor_id = auth.uid()
              AND a.student_id    = topics.student_id
        )
    );


-- ------------------------------------------------------------
-- 6.6 TOPIC STATUS HISTORY
-- Read: same rules as topics.
-- Write: backend only.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS history_select_policy ON public.topic_status_history;
CREATE POLICY history_select_policy
    ON public.topic_status_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.topics t
            WHERE t.topic_id = topic_status_history.topic_id
              AND (
                  t.student_id = auth.uid()
                  OR public.is_admin()
                  OR EXISTS (
                      SELECT 1 FROM public.assignments a
                      WHERE a.supervisor_id = auth.uid()
                        AND a.student_id    = t.student_id
                  )
              )
        )
    );


-- ------------------------------------------------------------
-- 6.7 MESSAGES
-- Read: sender or receiver.
-- Insert: sender_id must equal auth.uid().
-- No updates or deletes.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS messages_select_policy ON public.messages;
CREATE POLICY messages_select_policy
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

DROP POLICY IF EXISTS messages_insert_policy ON public.messages;
CREATE POLICY messages_insert_policy
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);


-- ------------------------------------------------------------
-- 6.8 NOTIFICATIONS
-- Read: own only.
-- Update: own only, and only is_read can change.
-- Write: backend only.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS notifications_select_policy ON public.notifications;
CREATE POLICY notifications_select_policy
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_policy ON public.notifications;
CREATE POLICY notifications_update_policy
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 7. REALTIME
-- Enable realtime streaming for messages and notifications.
-- Idempotent — safe to run multiple times.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;


-- ============================================================
-- 8. STORAGE BUCKETS
-- Both private. All access is via signed URLs generated by
-- the backend (service role key).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
    ('submissions', 'submissions', false),
    ('corpus',      'corpus',      false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 9. COMPLETE
-- ============================================================

SELECT 'IntelliVerify 2.0 schema installed.' AS status;
