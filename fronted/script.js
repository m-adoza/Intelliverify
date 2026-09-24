// Relative path to backend server
const API_BASE = '';

// Health Check
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    console.log('✅ Server online:', data);
  } catch (err) {
    console.error('❌ Could not connect to backend:', err);
  }
}

// Utility: Show message alert on form
function showAlert(message, isError = true) {
  const alertBox = document.getElementById('alertBox');
  if (!alertBox) return;
  alertBox.style.display = 'block';
  alertBox.className = `alert-box ${isError ? 'alert-error' : 'alert-success'}`;
  alertBox.textContent = message;
}

// Registration Form Handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('role').value;
    const matricNo = document.getElementById('matricNo')?.value.trim();
    const department = document.getElementById('department')?.value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role, matricNo, department, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      showAlert('Account created successfully! Redirecting to login...', false);
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } catch (err) {
      showAlert(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register Account';
    }
  });
}

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Save user session
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showAlert(`Welcome back, ${data.user.fullName}! Redirecting...`, false);
      
      setTimeout(() => {
        if (data.user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 1200);
    } catch (err) {
      showAlert(err.message, true);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
}

document.addEventListener('DOMContentLoaded', checkHealth);
