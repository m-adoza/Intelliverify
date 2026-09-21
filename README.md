# IntelliVerify — Academic Topic Approval & Plagiarism Detection Engine

IntelliVerify is an enterprise-grade SaaS platform designed for academic institutions to manage final year project topic proposals, run real-time automated similarity/plagiarism detection scans, and streamline communication between students, supervisors, and administrators.

---

## 🛠️ Architecture & Tech Stack

* **Frontend:** Static HTML5, CSS Custom Properties (Linear/Vercel Design System), ES6+ JavaScript, Supabase JS SDK v2. Hosted on **Vercel**.
* **Backend:** Node.js, Express REST API, Custom Token Jaccard & N-Gram Plagiarism Engine, JWT Bearer Token Middleware. Hosted on **Render**.
* **Database & Auth:** Supabase PostgreSQL with `auth.users` sync triggers, Row Level Security (RLS), and Realtime WebSockets.

---

## 🚀 Quick Start & Local Setup

### 1. Database Setup
1. Execute `database/schema.sql` inside your Supabase project's SQL Editor.
2. Ensure `profiles` and `topics` tables are active with Row Level Security enabled.

### 2. Backend Environment Setup
1. Navigate to the `backend/` directory.
2. Install dependencies:
   ```bash
   npm install