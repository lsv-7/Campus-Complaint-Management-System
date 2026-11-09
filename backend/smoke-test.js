import 'dotenv/config';
import pool from './config/db.js';

const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:5000/api';
const password = 'CampusCare2026!';
const email = `campuscare.qa.${Date.now()}@example.edu`;
let createdEmail = null;
let studentId = null;
const passed = [];

async function request(path, { method = 'GET', token, body, expected = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected HTTP ${expected}, received ${response.status} (${data.message || 'no detail'})`);
  }
  return data;
}

function check(condition, label) {
  if (!condition) throw new Error(`Failed: ${label}`);
  passed.push(label);
}

try {
  const health = await request('/health');
  check(health.status === 'ok' && health.database === 'connected', 'API/MySQL health');

  const adminLogin = await request('/auth/login', { method: 'POST', expected: 200, body: { email: 'admin@campuscare.edu', password } });
  check(adminLogin.user.role === 'admin' && !!adminLogin.token, 'admin login');
  const studentLogin = await request('/auth/login', { method: 'POST', expected: 200, body: { email: 'aarav.mehta@campus.edu', password } });
  check(studentLogin.user.role === 'student' && !!studentLogin.token, 'seeded student login');

  const registration = await request('/auth/register', {
    method: 'POST', expected: 201,
    body: { name: 'CampusCare QA Student', email, department: 'Quality Assurance', password: 'CampusCareQA2026!' },
  });
  createdEmail = email;
  studentId = registration.user.id;
  check(registration.user.role === 'student' && !('password' in registration.user), 'student registration returns safe user fields');
  const qaLogin = await request('/auth/login', { method: 'POST', expected: 200, body: { email, password: 'CampusCareQA2026!' } });
  check(qaLogin.user.id === studentId, 'new student login');

  const categories = await request('/categories');
  const departments = await request('/departments');
  const category = categories.find(c => c.category_name === 'Infrastructure');
  const department = departments.find(d => d.department_name === 'Facilities');
  check(!!category && !!department, 'category and department lookups');

  const title = `QA smoke complaint ${Date.now()}`;
  const created = await request('/complaints', {
    method: 'POST', token: qaLogin.token, expected: 201,
    body: { title, category_id: category.id, description: 'Temporary live API verification report.', location: 'QA test location', priority: 'High' },
  });
  const complaintId = created.id;
  check(Number.isInteger(Number(complaintId)), 'complaint submission');

  const ownList = await request(`/complaints/my?search=${encodeURIComponent(title)}`, { token: qaLogin.token });
  check(ownList.length === 1 && Number(ownList[0].id) === Number(complaintId), 'student complaint listing');
  const ownDetail = await request(`/complaints/${complaintId}`, { token: qaLogin.token });
  check(ownDetail.status === 'Pending' && ownDetail.history.length === 0, 'student complaint details/status tracking');
  await request(`/complaints/${complaintId}`, { token: studentLogin.token, expected: 404 });
  check(true, 'cross-student complaint access denied');
  await request('/admin/dashboard', { token: studentLogin.token, expected: 403 });
  check(true, 'student blocked from admin APIs');

  const adminList = await request(`/admin/complaints?search=${encodeURIComponent(title)}`, { token: adminLogin.token });
  check(adminList.length === 1 && Number(adminList[0].id) === Number(complaintId), 'admin complaint listing');
  await request(`/admin/complaints/${complaintId}/assign`, { method: 'PATCH', token: adminLogin.token, body: { assigned_department: department.department_name } });
  await request(`/admin/complaints/${complaintId}/status`, { method: 'PATCH', token: adminLogin.token, body: { status: 'In Progress', remarks: 'QA verified department handoff.' } });
  const updated = await request(`/complaints/${complaintId}`, { token: qaLogin.token });
  check(updated.status === 'In Progress' && updated.assigned_department === department.department_name, 'admin assignment and status update');
  check(updated.history.length === 1 && updated.history[0].new_status === 'In Progress' && updated.history[0].remarks === 'QA verified department handoff.', 'transactional status history visible to student');

  const studentDash = await request('/student/dashboard', { token: qaLogin.token });
  check(studentDash.stats.total === 1 && studentDash.stats.inProgress === 1, 'student dashboard aggregates');
  const adminDash = await request('/admin/dashboard', { token: adminLogin.token });
  check(adminDash.stats.total >= 21 && adminDash.byCategory.length === categories.length && adminDash.highPriority.some(c => Number(c.id) === Number(complaintId)), 'admin dashboard aggregates/charts/priority results');

  const [[persisted]] = await pool.execute('SELECT c.status,c.assigned_department,(SELECT COUNT(*) FROM complaint_updates cu WHERE cu.complaint_id=c.id) history_count,(SELECT COUNT(*) FROM complaint_summary cs WHERE cs.id=c.id) view_count FROM complaints c WHERE c.id=? AND c.user_id=?',[complaintId,studentId]);
  check(persisted?.status === 'In Progress' && persisted.assigned_department === department.department_name && persisted.history_count === 1 && persisted.view_count === 1, 'complaint, assignment, history, and view persisted in MySQL');

  const corsResponse = await fetch(`${base}/health`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
  check(corsResponse.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'frontend origin CORS configuration');
  for (const label of passed) console.log(`PASS ${label}`);
  console.log(`PASS ${passed.length} smoke checks; created QA rows will be removed.`);
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  if (createdEmail) {
    try {
      await pool.execute("DELETE FROM users WHERE email=? AND role='student'", [createdEmail]);
      console.log('Cleaned up the temporary QA student and its cascading complaint/history.');
    } catch (error) {
      console.error(`QA cleanup failed for its unique temporary email: ${error.message}`);
      process.exitCode = 1;
    }
  }
  await pool.end();
}
