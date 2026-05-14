const { query } = require('./database/connection');

const createAssignmentsTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_task_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        assigned_by INTEGER,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(user_id, task_id)
      )
    `);
    console.log('Table created successfully');
    
    const result = await query('PRAGMA table_info(user_task_assignments)');
    console.log('Table info:', result.rows);
  } catch (error) {
    console.error('Error:', error);
  }
};

createAssignmentsTable();
