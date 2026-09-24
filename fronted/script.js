// Relative paths work automatically since frontend and backend share the Render server
const API_BASE_URL = '';

// Check server health status on load
async function checkServerHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('✅ Connected to backend:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to connect to backend:', error);
  }
}

// Universal API request helper for your frontend forms/requests
async function sendApiRequest(endpoint, data = {}, method = 'POST') {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }

    return result;
  } catch (error) {
    console.error(`Error requesting ${endpoint}:`, error);
    throw error;
  }
}

// Automatically test backend connectivity when the website loads
document.addEventListener('DOMContentLoaded', () => {
  checkServerHealth();
});
