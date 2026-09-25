-- ============================================================
-- INTELLIVERIFY
-- Intelligent Final Year Project Topic Approval & Plagiarism
-- Detection System
--
-- Production Database Schema & Auth Triggers
-- ============================================================


-- ============================================================
-- 1. ENABLE UUID EXTENSION
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. PROFILES TABLE
-- Extends Supabase Auth Users
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Academic User',

    role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'supervisor', 'admin')),

    department TEXT DEFAULT 'Computer Science',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 3. PLAGIARISM REPORTS TABLE
-- Stores plagiarism/similarity analysis results
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plagiarism_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    filename TEXT NOT NULL,

    file_format TEXT NOT NULL,

    similarity_score NUMERIC(5,2) NOT NULL
        CHECK (similarity_score >= 0 AND similarity_score <= 100),

    risk_level TEXT NOT NULL
        CHECK (risk_level IN ('low', 'medium', 'high')),

    matches JSONB DEFAULT '[]'::jsonb,

    recommendation TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 4. TOPICS TABLE
-- Stores final-year project topic submissions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.topics (
    topic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,

    -- Topic information
    abstract TEXT,
    problem_statement TEXT NOT NULL,
    objectives TEXT NOT NULL,
    keywords TEXT,
    research_area TEXT NOT NULL,

    -- Topic similarity / plagiarism score
    similarity_score NUMERIC(5,2) DEFAULT 0
        CHECK (similarity_score >= 0 AND similarity_score <= 100),

    -- Topic approval status
    status TEXT DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'revision',
                'rejected',
                'flagged'
            )
        ),

    -- Connected plagiarism report
    plagiarism_report_id UUID
        REFERENCES public.plagiarism_reports(report_id)
        ON DELETE SET NULL,

    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 5. MESSAGES TABLE
-- Real-time communication between students,
-- supervisors and administrators
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

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

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 6. AUTOMATIC PROFILE CREATION
-- Creates a profile whenever a new Supabase Auth user
-- registers
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 7. AUTH SIGNUP TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plagiarism_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 9. PROFILES RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Public Profiles Read"
ON public.profiles;

CREATE POLICY "Public Profiles Read"
ON public.profiles
FOR SELECT
USING (true);


-- Users can update their own profile
DROP POLICY IF EXISTS "Users Update Own Profile"
ON public.profiles;

CREATE POLICY "Users Update Own Profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- ============================================================
-- 10. TOPICS RLS POLICIES
-- ============================================================

-- Students can view their own topics
DROP POLICY IF EXISTS "Students Access Own Topics"
ON public.topics;

CREATE POLICY "Students Access Own Topics"
ON public.topics
FOR SELECT
USING (
    auth.uid() = student_id
);


-- Students can submit topics
DROP POLICY IF EXISTS "Students Submit Topics"
ON public.topics;

CREATE POLICY "Students Submit Topics"
ON public.topics
FOR INSERT
WITH CHECK (
    auth.uid() = student_id
);


-- Students can update their own topics
DROP POLICY IF EXISTS "Students Update Own Topics"
ON public.topics;

CREATE POLICY "Students Update Own Topics"
ON public.topics
FOR UPDATE
USING (
    auth.uid() = student_id
)
WITH CHECK (
    auth.uid() = student_id
);


-- Supervisors and admins can view all topics
DROP POLICY IF EXISTS "Supervisors Access All Topics"
ON public.topics;

CREATE POLICY "Supervisors Access All Topics"
ON public.topics
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('supervisor', 'admin')
    )
);


-- Supervisors and admins can manage topics
DROP POLICY IF EXISTS "Supervisors Manage All Topics"
ON public.topics;

CREATE POLICY "Supervisors Manage All Topics"
ON public.topics
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('supervisor', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('supervisor', 'admin')
    )
);


-- ============================================================
-- 11. PLAGIARISM REPORT RLS POLICIES
-- ============================================================

-- Students can view their own plagiarism reports
DROP POLICY IF EXISTS "Students View Own Plagiarism Reports"
ON public.plagiarism_reports;

CREATE POLICY "Students View Own Plagiarism Reports"
ON public.plagiarism_reports
FOR SELECT
USING (
    auth.uid() = student_id
);


-- Students can create their own plagiarism reports
DROP POLICY IF EXISTS "Students Create Plagiarism Reports"
ON public.plagiarism_reports;

CREATE POLICY "Students Create Plagiarism Reports"
ON public.plagiarism_reports
FOR INSERT
WITH CHECK (
    auth.uid() = student_id
);


-- Supervisors and admins can access all plagiarism reports
DROP POLICY IF EXISTS "Supervisors Access Plagiarism Reports"
ON public.plagiarism_reports;

CREATE POLICY "Supervisors Access Plagiarism Reports"
ON public.plagiarism_reports
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('supervisor', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('supervisor', 'admin')
    )
);


-- ============================================================
-- 12. MESSAGES RLS POLICIES
-- ============================================================

-- Users can view messages they sent or received
DROP POLICY IF EXISTS "Users View Their Messages"
ON public.messages;

CREATE POLICY "Users View Their Messages"
ON public.messages
FOR SELECT
USING (
    auth.uid() = sender_id
    OR
    auth.uid() = receiver_id
);


-- Users can send messages as themselves
DROP POLICY IF EXISTS "Users Send Messages"
ON public.messages;

CREATE POLICY "Users Send Messages"
ON public.messages
FOR INSERT
WITH CHECK (
    auth.uid() = sender_id
);


-- Users can delete messages they sent
DROP POLICY IF EXISTS "Users Delete Own Messages"
ON public.messages;

CREATE POLICY "Users Delete Own Messages"
ON public.messages
FOR DELETE
USING (
    auth.uid() = sender_id
);


-- ============================================================
-- 13. ENABLE REALTIME FOR MESSAGES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'messages'
        AND schemaname = 'public'
    ) THEN

        ALTER PUBLICATION supabase_realtime
        ADD TABLE public.messages;

    END IF;
END $$;


-- ============================================================
-- 14. USEFUL INDEXES
-- Improves query performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_topics_student_id
ON public.topics(student_id);

CREATE INDEX IF NOT EXISTS idx_topics_status
ON public.topics(status);

CREATE INDEX IF NOT EXISTS idx_topics_submitted_at
ON public.topics(submitted_at);

CREATE INDEX IF NOT EXISTS idx_plagiarism_student_id
ON public.plagiarism_reports(student_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id
ON public.messages(receiver_id);

CREATE INDEX IF NOT EXISTS idx_messages_topic_id
ON public.messages(topic_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
ON public.messages(created_at);


-- ============================================================
-- END OF INTELLIVERIFY DATABASE SCHEMA
-- ============================================================

 
