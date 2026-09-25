-- ============================================================
-- INTELLIVERIFY DATABASE SCHEMA
-- Supabase / PostgreSQL
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'supervisor', 'admin')),
    department TEXT DEFAULT 'Computer Science',
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 2. PLAGIARISM REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plagiarism_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    filename TEXT NOT NULL,

    file_format TEXT NOT NULL,

    similarity_score NUMERIC(5,2) NOT NULL DEFAULT 0,

    risk_level TEXT NOT NULL
        CHECK (risk_level IN ('low', 'medium', 'high')),

    matches JSONB DEFAULT '[]'::jsonb,

    recommendation TEXT,

    file_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. TOPICS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.topics (
    topic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,

    problem_statement TEXT NOT NULL,

    objectives TEXT NOT NULL,

    keywords TEXT,

    research_area TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'revision',
                'rejected'
            )
        ),

    plagiarism_report_id UUID
        REFERENCES public.plagiarism_reports(report_id)
        ON DELETE SET NULL,

    submitted_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 4. MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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
-- 5. AUTOMATIC PROFILE CREATION
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
        COALESCE(
            NEW.raw_user_meta_data->>'role',
            'student'
        )
    );

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plagiarism_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. PROFILE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (true);


-- ============================================================
-- 8. PLAGIARISM REPORT POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view own plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Users can view own plagiarism reports"
ON public.plagiarism_reports
FOR SELECT
USING (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "Users can create own plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Users can create own plagiarism reports"
ON public.plagiarism_reports
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "Admins can view all plagiarism reports"
ON public.plagiarism_reports;

CREATE POLICY "Admins can view all plagiarism reports"
ON public.plagiarism_reports
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
);


-- ============================================================
-- 9. TOPIC POLICIES
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
        AND profiles.role IN ('supervisor', 'admin')
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
        AND profiles.role IN ('supervisor', 'admin')
    )
);


-- ============================================================
-- 10. MESSAGE POLICIES
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
-- 11. REALTIME
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime
        ADD TABLE public.messages;
    END IF;
END $$;
