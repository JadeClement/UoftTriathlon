const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function testAdminLogin() {
  try {
    console.log('🔐 Testing admin login...');
    
    // Login as admin
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'info@uoft-tri.club',
      password: 'admin123'
    });
    
    console.log('✅ Admin login successful!');
    console.log('User:', loginResponse.data.user);
    console.log('Token:', loginResponse.data.token.substring(0, 50) + '...');
    
    const token = loginResponse.data.token;
    
    // Test admin stats endpoint
    console.log('\n📊 Testing admin stats...');
    const statsResponse = await axios.get(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Admin stats successful!');
    console.log('Stats:', statsResponse.data.stats);
    
    // Test members endpoint
    console.log('\n👥 Testing members endpoint...');
    const membersResponse = await axios.get(`${API_BASE}/admin/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Members endpoint successful!');
    console.log('Total members:', membersResponse.data.members.length);
    
    console.log('\n🎉 All tests passed! Backend is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAdminLogin();


