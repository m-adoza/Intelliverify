const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Security Setup
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Authorization & JWT Middleware
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid authentication session' });
  }

  req.user = user;
  next();
}

// Advanced Similarity Algorithm (Token Overlap & N-Gram Match)
function computePlagiarismScore(title, abstract, existingTopics) {
  if (!existingTopics || existingTopics.length === 0) return { score: 0, matchedText: null };

  const tokenize = (text) => text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const targetTokens = new Set([...tokenize(title), ...tokenize(abstract)]);

  let maxScore = 0;
  let matchedSnippet = null;

  for (const topic of existingTopics) {
    const sourceTokens = new Set([...tokenize(topic.title), ...tokenize(topic.abstract)]);
    const intersection = new Set([...targetTokens].filter(x => sourceTokens.has(x)));
    const union = new Set([...targetTokens, ...sourceTokens]);

    const jaccard = union.size === 0 ? 0 : Math.round((intersection.size / union.size) * 100);

    if (jaccard > maxScore) {
      maxScore = jaccard;
      matchedSnippet = topic.title;
    }
  }

  return { score: maxScore, matchedText: matchedSnippet };
}

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// Plagiarism Pre-check Endpoint
app.post('/api/plagiarism/check', verifyAuth, async (req, res) => {
  try {
    const { title, abstract } = req.body;
    const { data: existingTopics } = await supabase.from('topics').select('title, abstract');

    const result = computePlagiarismScore(title, abstract, existingTopics);

    res.json({
      success: true,
      score: result.score,
      message: result.score > 20 
        ? `High similarity (${result.score}%) detected matching existing project: "${result.matchedText}".`
        : "Topic passed similarity pre-check."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Topics API
app.get('/api/student/topics', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/topics', verifyAuth, async (req, res) => {
  try {
    const { title, abstract } = req.body;
    const { data: existing } = await supabase.from('topics').select('title, abstract');

    const { score } = computePlagiarismScore(title, abstract, existing);

    const { data, error } = await supabase.from('topics').insert([{
      student_id: req.user.id,
      title,
      abstract,
      similarity_score: score,
      status: score > 20 ? 'Flagged' : 'Pending'
    }]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supervisor Topics API
app.get('/api/supervisor/topics', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/supervisor/topics/:id', verifyAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('topics')
      .update({ status })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Metrics API
app.get('/api/admin/stats', verifyAuth, async (req, res) => {
  try {
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: approvedProjects } = await supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'Approved');

    res.json({ success: true, totalUsers: totalUsers || 0, approvedProjects: approvedProjects || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`IntelliVerify Backend Service operational on port ${PORT}`);
});