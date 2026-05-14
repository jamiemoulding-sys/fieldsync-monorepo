const bcrypt = require('bcryptjs');
const { query } = require('./database/connection');

async function updateManagerPassword() {
  try {
    const password = 'password';
    const hash = await bcrypt.hash(password, 10);
    
    console.log('Generated hash for password:', hash);
    
    // Update manager password
    const result = await query(
      'UPDATE users SET password = ? WHERE email = ?',
      [hash, 'manager@company.com']
    );
    
    console.log('Update result:', result);
    
    // Test the hash
    const isValid = await bcrypt.compare(password, hash);
    console.log('Hash validation:', isValid);
    
  } catch (error) {
    console.error('Error updating manager password:', error);
  }
}

updateManagerPassword().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
