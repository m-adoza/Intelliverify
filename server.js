require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Auto-detect whether your folder is named 'frontend' or 'fronted'
const frontendFolderName = fs.existsSync(path.join(__dirname, 'frontend')) ? 'frontend' : 'fronted';
const staticPath = path.join(__dirname, frontendFolderName);

// Serve frontend static files (HTML, CSS, JS, Images)
app.use(express.static(staticPath));

// Environment Variables & Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
}

const supabase = (supabaseUrl && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Backend API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    supabaseConnected: Boolean(supabase),
    timestamp: new Date().toISOString()
  });
});

// Serve index.html for main site visits and unknown page routes
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Backend is running, but index.html was not found in the frontend folder.");
  }
});

// Port Binding for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

