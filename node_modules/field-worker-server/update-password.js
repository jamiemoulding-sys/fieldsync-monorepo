const bcrypt = require('bcryptjs');
const { query } = require('./database/connection');

async function updateEmployeePassword() {
  try {
    const password = 'password';
    const hash = await bcrypt.hash(password, 10);
    
    // Update the employee password
    const result = await query(
      'UPDATE users SET password = ? WHERE email = ?',
      [hash, 'employee@company.com']
    );
    
    console.log('Updated employee password successfully');
    console.log('Rows affected:', result.changes);
    
    // Test the login
    const userResult = await query(
      'SELECT * FROM users WHERE email = ?',
      ['employee@company.com']
    );
    
    if (userResult.rows.length > 0) {
      const isValid = await bcrypt.compare(password, userResult.rows[0].password);
      console.log('Password verification test:', isValid);
    }
    
  } catch (error) {
    console.error('Error updating password:', error);
  }
}

updateEmployeePassword().then(() => {
  process.exit(0);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
