-- ============================================================
-- INTELLIVERIFY
-- UPDATED DATABASE SCHEMA
-- Supabase / PostgreSQL
--
-- Supports:
-- 1. Authentication
-- 2. Student/Supervisor/Admin profiles
-- 3. Topic submission
-- 4. Supabase Storage documents
-- 5. Document text extraction
-- 6. Plagiarism scanning
-- 7. TF-IDF / Cosine Similarity results
-- 8. Topic approval workflow
-- 9. Messaging
-- 10. Realtime messaging
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 2. PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    email TEXT UNIQUE NOT NULL,

    full_name TEXT,

    role TEXT NOT NULL DEFAULT 'student'
        CHECK (
            role IN (
                'student',
                'supervisor',
                'admin'
            )
        ),

    department TEXT DEFAULT 'Computer Science',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. PLAGIARISM REPORTS
-- ============================================================
--
-- One record represents one uploaded/scanned document.
--
-- Storage:
-- project-documents/{USER_ID}/{FILE}
--
-- scan_status:
-- uploaded
-- extracting
-- ready
-- scanning
-- completed
-- failed
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plagiarism_reports (

    report_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,


    -- --------------------------------------------------------
    -- ORIGINAL FILE INFORMATION
    -- --------------------------------------------------------

    filename TEXT NOT NULL,

    file_format TEXT NOT NULL,

    mime_type TEXT,

    file_size BIGINT,

    storage_path TEXT NOT NULL,

    file_url TEXT,


    -- --------------------------------------------------------
    -- EXTRACTED DOCUMENT INFORMATION
    -- --------------------------------------------------------

    extracted_text TEXT,

    word_count INTEGER DEFAULT 0,


    -- --------------------------------------------------------
    -- PLAGIARISM RESULT
    -- --------------------------------------------------------

    similarity_score NUMERIC(5,2)
        NOT NULL DEFAULT 0
        CHECK (
            similarity_score >= 0
            AND similarity_score <= 100
        ),

    risk_level TEXT NOT NULL DEFAULT 'low'
        CHECK (
            risk_level IN (
                'low',
                'medium',
                'high'
            )
        ),


    -- --------------------------------------------------------
    -- MATCHING SOURCES
    -- --------------------------------------------------------
    --
    -- Example:
    --
    -- [
    --   {
    --      "report_id": "...",
    --      "filename": "old_project.docx",
    --      "similarity": 42.7
    --   }
    -- ]
    -- --------------------------------------------------------

    matches JSONB
        NOT NULL DEFAULT '[]'::jsonb,


    -- --------------------------------------------------------
    -- HUMAN-READABLE RESULT
    -- --------------------------------------------------------

    recommendation TEXT,


    -- --------------------------------------------------------
    -- PROCESSING STATUS
    -- --------------------------------------------------------

    scan_status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (
            scan_status IN (
                'uploaded',
                'extracting',
                'ready',
                'scanning',
                'completed',
                'failed'
            )
        ),

    scan_error TEXT,


    -- --------------------------------------------------------
    -- TIMESTAMPS
    -- --------------------------------------------------------

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    processed_at TIMESTAMPTZ

);


-- ============================================================
-- 4. TOPICS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.topics (

    topic_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,

    problem_statement TEXT NOT NULL,

    objectives TEXT NOT NULL,

    keywords TEXT,

    research_area TEXT NOT NULL,


    -- --------------------------------------------------------
    -- APPROVAL STATUS
    -- --------------------------------------------------------

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'revision',
                'rejected'
            )
        ),


    -- --------------------------------------------------------
    -- PLAGIARISM REPORT USED FOR THIS TOPIC
    -- --------------------------------------------------------

    plagiarism_report_id UUID
        REFERENCES public.plagiarism_reports(report_id)
        ON DELETE SET NULL,


    -- --------------------------------------------------------
    -- OPTIONAL REVIEW INFORMATION
    -- --------------------------------------------------------

    reviewer_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    reviewer_comment TEXT,

    reviewed_at TIMESTAMPTZ,


    submitted_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()

);


-- ============================================================
-- 5. MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (

    message_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    receiver_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    topic_id UUID
        REFERENCES public.topics(topic_id)
        ON DELETE SET NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()

);


-- ============================================================
-- 6. AUTOMATIC PROFILE CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$

BEGIN

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role
    )

    VALUES (
        NEW.id,
        NEW.email,

        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            'Academic User'
        ),

        CASE
            WHEN NEW.raw_user_meta_data->>'role'
                IN ('student', 'supervisor', 'admin')
            THEN NEW.raw_user_meta_data->>'role'

            ELSE 'student'
        END
    )

    ON CONFLICT (id)
    DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;

END;

$$;


DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;


CREATE TRIGGER on_auth_user_created

AFTER INSERT
ON auth.users

FOR EACH ROW

EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 7. UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$

BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;

$$;


-- ============================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS profiles_updated_at
ON public.profiles;

CREATE TRIGGER profiles_updated_at

BEFORE UPDATE
ON public.profiles

FOR EACH ROW

EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS plagiarism_reports_updated_at
ON public.plagiarism_reports;

CREATE TRIGGER plagiarism_reports_updated_at

BEFORE UPDATE
ON public.plagiarism_reports

FOR EACH ROW

EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS topics_updated_at
ON public.topics;

CREATE TRIGGER topics_updated_at

BEFORE UPDATE
ON public.topics

FOR EACH ROW

EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plagiarism_reports
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.topics
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messages
ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 10. PROFILE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view profiles"
ON public.profiles;

CREATE POLICY "Users can view profiles"

ON public.profiles

FOR SELECT

USING (
    auth.uid() IS NOT NULL
);


DROP POLICY IF EXISTS "Users can update own profile"
ON public.profiles;

CREATE POLICY "Users can update own profile"

ON public.profiles

FOR UPDATE

USING (
    auth.uid() = id
)

WITH CHECK (
    auth.uid() = id
);


-- ============================================================
-- 11. PLAGIARISM REPORT POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view own plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Users can view own plagiarism reports"

ON public.plagiarism_reports

FOR SELECT

USING (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "Supervisors can view plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Supervisors can view plagiarism reports"

ON public.plagiarism_reports

FOR SELECT

USING (

    EXISTS (

        SELECT 1

        FROM public.profiles

        WHERE profiles.id = auth.uid()

        AND profiles.role IN (
            'supervisor',
            'admin'
        )

    )

);


DROP POLICY IF EXISTS "Users can create own plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Users can create own plagiarism reports"

ON public.plagiarism_reports

FOR INSERT

WITH CHECK (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "Users can update own plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Users can update own plagiarism reports"

ON public.plagiarism_reports

FOR UPDATE

USING (
    auth.uid() = user_id
)

WITH CHECK (
    auth.uid() = user_id
);


-- ============================================================
-- 12. TOPIC POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Students can view own topics"
ON public.topics;

CREATE POLICY "Students can view own topics"

ON public.topics

FOR SELECT

USING (
    auth.uid() = student_id
);


DROP POLICY IF EXISTS "Students can submit topics"
ON public.topics;

CREATE POLICY "Students can submit topics"

ON public.topics

FOR INSERT

WITH CHECK (
    auth.uid() = student_id
);


DROP POLICY IF EXISTS "Supervisors can view all topics"
ON public.topics;

CREATE POLICY "Supervisors can view all topics"

ON public.topics

FOR SELECT

USING (

    EXISTS (

        SELECT 1

        FROM public.profiles

        WHERE profiles.id = auth.uid()

        AND profiles.role IN (
            'supervisor',
            'admin'
        )

    )

);


DROP POLICY IF EXISTS "Supervisors can update topics"
ON public.topics;

CREATE POLICY "Supervisors can update topics"

ON public.topics

FOR UPDATE

USING (

    EXISTS (

        SELECT 1

        FROM public.profiles

        WHERE profiles.id = auth.uid()

        AND profiles.role IN (
            'supervisor',
            'admin'
        )

    )

);


-- ============================================================
-- 13. MESSAGE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view their messages"
ON public.messages;

CREATE POLICY "Users can view their messages"

ON public.messages

FOR SELECT

USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
);


DROP POLICY IF EXISTS "Users can send messages"
ON public.messages;

CREATE POLICY "Users can send messages"

ON public.messages

FOR INSERT

WITH CHECK (
    auth.uid() = sender_id
);


-- ============================================================
-- 14. STORAGE
-- ============================================================
--
-- IMPORTANT:
-- You already created the bucket.
--
-- Bucket:
-- project-documents
--
-- Recommended setting:
-- PRIVATE
--
-- Files:
--
-- project-documents/
--     USER_ID/
--         unique_filename
--
-- ============================================================


-- Make sure the bucket exists.
-- This does NOT expose it publicly.

INSERT INTO storage.buckets (
    id,
    name,
    public
)

VALUES (
    'project-documents',
    'project-documents',
    false
)

ON CONFLICT (id)
DO UPDATE SET
    public = false;


-- ============================================================
-- 15. STORAGE POLICIES
-- ============================================================

DROP POLICY IF EXISTS
"Students can upload own project documents"
ON storage.objects;


CREATE POLICY
"Students can upload own project documents"

ON storage.objects

FOR INSERT

TO authenticated

WITH CHECK (

    bucket_id = 'project-documents'

    AND
    (
        storage.foldername(name)
    )[1] = auth.uid()::text

);


-- ------------------------------------------------------------
-- READ OWN DOCUMENTS
-- ------------------------------------------------------------

DROP POLICY IF EXISTS
"Users can read own project documents"
ON storage.objects;


CREATE POLICY
"Users can read own project documents"

ON storage.objects

FOR SELECT

TO authenticated

USING (

    bucket_id = 'project-documents'

    AND
    (
        storage.foldername(name)
    )[1] = auth.uid()::text

);


-- ------------------------------------------------------------
-- SUPERVISORS / ADMINS CAN READ DOCUMENTS
-- ------------------------------------------------------------

DROP POLICY IF EXISTS
"Supervisors can read project documents"
ON storage.objects;


CREATE POLICY
"Supervisors can read project documents"

ON storage.objects

FOR SELECT

TO authenticated

USING (

    bucket_id = 'project-documents'

    AND

    EXISTS (

        SELECT 1

        FROM public.profiles

        WHERE profiles.id = auth.uid()

        AND profiles.role IN (
            'supervisor',
            'admin'
        )

    )

);


-- ------------------------------------------------------------
-- DELETE OWN DOCUMENT
-- ------------------------------------------------------------

DROP POLICY IF EXISTS
"Users can delete own project documents"
ON storage.objects;


CREATE POLICY
"Users can delete own project documents"

ON storage.objects

FOR DELETE

TO authenticated

USING (

    bucket_id = 'project-documents'

    AND
    (
        storage.foldername(name)
    )[1] = auth.uid()::text

);


-- ============================================================
-- 16. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_profiles_role

ON public.profiles(role);


CREATE INDEX IF NOT EXISTS
idx_profiles_department

ON public.profiles(department);


CREATE INDEX IF NOT EXISTS
idx_plagiarism_reports_user

ON public.plagiarism_reports(user_id);


CREATE INDEX IF NOT EXISTS
idx_plagiarism_reports_status

ON public.plagiarism_reports(scan_status);


CREATE INDEX IF NOT EXISTS
idx_plagiarism_reports_created

ON public.plagiarism_reports(created_at DESC);


CREATE INDEX IF NOT EXISTS
idx_topics_student

ON public.topics(student_id);


CREATE INDEX IF NOT EXISTS
idx_topics_status

ON public.topics(status);


CREATE INDEX IF NOT EXISTS
idx_topics_submitted

ON public.topics(submitted_at DESC);


CREATE INDEX IF NOT EXISTS
idx_topics_plagiarism_report

ON public.topics(plagiarism_report_id);


CREATE INDEX IF NOT EXISTS
idx_messages_sender

ON public.messages(sender_id);


CREATE INDEX IF NOT EXISTS
idx_messages_receiver

ON public.messages(receiver_id);


CREATE INDEX IF NOT EXISTS
idx_messages_created

ON public.messages(created_at);


-- ============================================================
-- 17. REALTIME
-- ============================================================

DO $$

BEGIN

    IF NOT EXISTS (

        SELECT 1

        FROM pg_publication_tables

        WHERE pubname = 'supabase_realtime'

        AND tablename = 'messages'

    )

    THEN

        ALTER PUBLICATION supabase_realtime

        ADD TABLE public.messages;

    END IF;

END $$;


-- ============================================================
-- 18. COMPLETE
-- ============================================================

SELECT
    'IntelliVerify database schema updated successfully.'
    AS status;
