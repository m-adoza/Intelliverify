require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors());
app.use(express.json());

// Auto-detect frontend folder name
const frontendFolderName = fs.existsSync(path.join(__dirname, 'frontend')) ? 'frontend' : 'fronted';
const staticPath = path.join(__dirname, frontendFolderName);

// Serve static frontend files
app.use(express.static(staticPath));

// Supabase Client Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    supabaseConnected: Boolean(supabase),
    timestamp: new Date().toISOString()
  });
});

// User Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not configured on server.' });
    }

    const { email, password, fullName, role, matricNo, department } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: role }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;
    if (!user) {
      return res.status(400).json({ error: 'Failed to create user account.' });
    }

    // 2. Save profile and role in 'public.users' table
    const { error: dbError } = await supabase
      .from('users')
      .insert([
        {
          id: user.id,
          full_name: fullName,
          email: email,
          role: role,
          matric_no: matricNo || null,
          department: department || null
        }
      ]);

    if (dbError) {
      console.error('Database insertion error:', dbError);
      return res.status(500).json({ error: 'Account created, but failed to save profile role: ' + dbError.message });
    }

    res.status(201).json({
      message: 'Registration successful! You can now log in.',
      user: { id: user.id, email: user.email, role: role }
    });
  } catch (error) {
    console.error('Registration exception:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// User Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not configured.' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Fetch user profile role from database
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single();

    res.json({
      message: 'Login successful',
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: userProfile?.full_name || data.user.user_metadata?.full_name,
        role: userProfile?.role || data.user.user_metadata?.role || 'student'
      }
    });
  } catch (error) {
    console.error('Login exception:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Serve frontend pages for any route
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Backend is running, but index.html was not found.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 IntelliVerify Server running on port ${PORT}`);
});
