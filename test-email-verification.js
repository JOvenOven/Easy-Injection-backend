const mongoose = require('mongoose');
const config = require('config');
const { User } = require('./models/usuario');

// Connect to database
mongoose.connect(config.get('db'))
  .then(() => console.log('Connected to MongoDB...'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

async function testEmailVerification() {
  try {
    console.log('Testing email verification functionality...\n');

    // Test 1: Check if User model has verification fields
    console.log('1. Checking User model fields...');
    const userFields = Object.keys(User.schema.paths);
    const requiredFields = ['email_verificado', 'token_verificacion', 'fecha_expiracion_token'];
    
    requiredFields.forEach(field => {
      if (userFields.includes(field)) {
        console.log(`   ✓ ${field} field exists`);
      } else {
        console.log(`   ✗ ${field} field missing`);
      }
    });

    // Test 2: Check account status enum
    console.log('\n2. Checking account status enum...');
    const statusEnum = User.schema.path('estado_cuenta').enumValues;
    if (statusEnum.includes('pendiente')) {
      console.log('   ✓ "pendiente" status exists in enum');
    } else {
      console.log('   ✗ "pendiente" status missing from enum');
    }

    // Test 3: Check if verification route exists
    console.log('\n3. Checking verification route...');
    try {
      const verifyEmailRoute = require('./routes/verify-email');
      if (verifyEmailRoute) {
        console.log('   ✓ Verification route file exists');
      }
    } catch (error) {
      console.log('   ✗ Verification route file missing or has errors');
    }

    // Test 4: Check if email service exists
    console.log('\n4. Checking email service...');
    try {
      const emailService = require('./services/emailService');
      if (emailService) {
        console.log('   ✓ Email service file exists');
      }
    } catch (error) {
      console.log('   ✗ Email service file missing or has errors');
    }

    // Test 5: Check configuration
    console.log('\n5. Checking configuration...');
    try {
      const emailConfig = config.get('email');
      if (emailConfig && emailConfig.user && emailConfig.password) {
        console.log('   ✓ Email configuration exists');
      } else {
        console.log('   ⚠ Email configuration incomplete (check config files)');
      }
    } catch (error) {
      console.log('   ✗ Email configuration missing');
    }

    console.log('\n✅ Email verification setup test completed!');
    console.log('\nNext steps:');
    console.log('1. Update your config files with email credentials');
    console.log('2. Test registration with a real email');
    console.log('3. Check email for verification link');
    console.log('4. Test verification flow');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testEmailVerification();
