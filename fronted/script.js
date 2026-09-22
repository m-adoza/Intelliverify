// Set your live Render backend URL
const API_BASE_URL = 'https://intelliverify.onrender.com';

// Example: Health check endpoint test
async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();
    console.log('Server health:', data);
  } catch (error) {
    console.error('Failed to connect to backend:', error);
  }
}

// Example: POST request template to your backend
async function submitData(endpoint, payload) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error requesting ${endpoint}:`, error);
    throw error;
  }
}

// Automatically check backend status on script load
checkServerHealth();