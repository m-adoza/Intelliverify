// ==========================================
// SUPABASE CLIENT & GLOBAL APP CONFIGURATION
// ==========================================

// 1. Supabase Credentials (Public / Client-side ONLY)
const SUPABASE_URL = "https://cfclliqyasriprauspxz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmY2xsaXF5YXNyaXByYXVzcHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NDQzNDAsImV4cCI6MjEwNTUyMDM0MH0._NnCm4JAnEzP36LGJHp4jBDLXHpU_QyiMcrD3d35KXo";

// 2. Initialize Supabase Client
if (typeof supabase !== "undefined") {
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("Supabase SDK is missing. Make sure the Supabase CDN script tag is included in your HTML head before config.js.");
}

// 3. Backend Express Server Base URL Configuration
// Automatically points to local Node server in development, or relative path on production/Render
window.API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : ""; // Add your deployed Render backend URL here if hosting frontend and backend separately

// 4. Global Toast Notification Helper
window.showToast = function (message, type = "info") {
  let container = document.getElementById("toast-container");
  
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const bgColors = {
    danger: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
    info: "#3b82f6"
  };

  toast.style.cssText = `
    padding: 12px 20px;
    background: ${bgColors[type] || bgColors.info};
    color: #ffffff;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
    pointer-events: auto;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  toast.innerText = message;

  container.appendChild(toast);

  // Trigger animation frame for CSS transition
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 200);
  }, 4000);
};

// 5. Global Sign Out Utility Function
window.handleSignOut = async function () {
  try {
    if (window.supabaseClient) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (err) {
    console.error("Sign-out error:", err);
  } finally {
    window.location.href = "/";
  }
};