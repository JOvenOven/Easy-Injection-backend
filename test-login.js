const axios = require('axios');

const testLogin = async () => {
    try {
        console.log('🧪 Testing login functionality...\n');

        // Test data - you'll need to replace with actual user data from your database
        const loginData = {
            email: 'test@example.com', // Replace with a verified user's email
            password: 'password123'    // Replace with the actual password
        };

        console.log('📤 Sending login request...');
        console.log('Email:', loginData.email);
        console.log('Password:', '***hidden***\n');

        const response = await axios.post('http://localhost:3000/api/login', loginData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Login successful!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ Login failed!');
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', error.response.data);
        } else if (error.request) {
            console.log('Network error - is the server running?');
            console.log('Error:', error.message);
        } else {
            console.log('Error:', error.message);
        }
    }
};

// Test with invalid credentials
const testInvalidLogin = async () => {
    try {
        console.log('\n🧪 Testing invalid login...\n');

        const invalidData = {
            email: 'invalid@example.com',
            password: 'wrongpassword'
        };

        const response = await axios.post('http://localhost:3000/api/login', invalidData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('❌ This should not succeed!');
        console.log('Response:', response.data);

    } catch (error) {
        console.log('✅ Invalid login correctly rejected!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data);
    }
};

// Run tests
const runTests = async () => {
    await testLogin();
    await testInvalidLogin();
    
    console.log('\n🏁 Tests completed!');
    console.log('\nNote: Make sure you have:');
    console.log('1. A verified user in your database');
    console.log('2. The backend server running on port 3000');
    console.log('3. JWT private key configured in your environment');
};

runTests();
