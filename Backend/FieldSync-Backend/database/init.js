const { query } = require('./connection');

const initDatabase = async () => {
  try {
    console.log('🛠 Initializing database...');

    // USERS
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // LOCATIONS
    await query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        latitude FLOAT,
        longitude FLOAT,
        radius FLOAT DEFAULT 100,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // SHIFTS
    await query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        location_id INTEGER REFERENCES locations(id),
        clock_in_time TIMESTAMP DEFAULT NOW(),
        clock_out_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // TASKS
    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // TASK COMPLETIONS
    await query(`
      CREATE TABLE IF NOT EXISTS task_completions (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id),
        user_id INTEGER REFERENCES users(id),
        shift_id INTEGER REFERENCES shifts(id),
        completed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database initialized successfully');

  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
};

module.exports = { initDatabase };
