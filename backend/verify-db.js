import 'dotenv/config';
import pool from './config/db.js';

try {
  const [[users]] = await pool.query('SELECT COUNT(*) count FROM users');
  const [[categories]] = await pool.query('SELECT COUNT(*) count FROM categories');
  const [[departments]] = await pool.query('SELECT COUNT(*) count FROM departments');
  const [[complaints]] = await pool.query('SELECT COUNT(*) count FROM complaints');
  const [[updates]] = await pool.query('SELECT COUNT(*) count FROM complaint_updates');
  const [summaryRows] = await pool.query('SELECT * FROM complaint_summary');
  const [[orphans]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM complaints c LEFT JOIN users u ON u.id=c.user_id WHERE u.id IS NULL) complaint_users,
      (SELECT COUNT(*) FROM complaints c LEFT JOIN categories k ON k.id=c.category_id WHERE k.id IS NULL) complaint_categories,
      (SELECT COUNT(*) FROM complaint_updates cu LEFT JOIN complaints c ON c.id=cu.complaint_id WHERE c.id IS NULL) update_complaints
  `);
  const [procedureSets] = await pool.query('CALL get_complaint_statistics()');
  const procedureStats = procedureSets[0]?.[0] ?? null;
  const procedureCategoryCount = procedureSets[1]?.length ?? 0;
  const result = {
    users: users.count,
    categories: categories.count,
    departments: departments.count,
    complaints: complaints.count,
    complaint_updates: updates.count,
    complaint_summary_rows: summaryRows.length,
    orphaned_foreign_keys: orphans,
    procedure: { statistics: procedureStats, category_rows: procedureCategoryCount },
  };
  console.log(JSON.stringify(result, null, 2));
  if (Object.values(orphans).some(Number) || !procedureStats) process.exitCode = 1;
} catch (error) {
  console.error(`Database verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
