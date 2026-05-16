const { query } = require('./database/connection');

const createSubscriptionsTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        employee_count INTEGER NOT NULL DEFAULT 1,
        monthly_price REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'GBP',
        status TEXT NOT NULL CHECK (status IN ('active', 'paid', 'cancelled', 'expired')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_payment_at DATETIME,
        cancelled_at DATETIME,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Subscriptions table created successfully');
  } catch (error) {
    console.error('Error creating subscriptions table:', error);
  }
};

createSubscriptionsTable();
