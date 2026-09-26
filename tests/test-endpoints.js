// tests/test-endpoints.js
//
// Walks through the FULL workflow end-to-end against your running server:
// register -> login -> create event/shifts -> volunteers sign up ->
// organizer checks them in/out (or marks no-show) -> pull daily + monthly reports.
//
// Run this AFTER starting your server (npm run dev), from the backend folder:
//   node tests/test-endpoints.js
//
// It uses only Node's built-in fetch (Node 18+), no extra packages needed.

const BASE_URL = 'http://localhost:5000/api';

// Use a fresh, timestamped email each run so "already registered" never blocks you
const stamp = Date.now();

async function call(method, path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function log(label, result) {
  console.log(`\n--- ${label} [${result.status}] ---`);
  console.log(JSON.stringify(result.data, null, 2));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ FAILED: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

async function main() {
  // 1. Register + login an organizer
  await call('POST', '/auth/register', {
    name: 'Test Organizer', email: `org${stamp}@test.com`, password: 'test1234', role: 'organizer',
  });
  const orgLogin = await call('POST', '/auth/login', { email: `org${stamp}@test.com`, password: 'test1234' });
  const orgToken = orgLogin.data.token;
  assert(!!orgToken, 'Organizer registered and logged in');

  // 2. Register + login two volunteers
  await call('POST', '/auth/register', {
    name: 'Volunteer One', email: `vol1_${stamp}@test.com`, password: 'test1234', role: 'volunteer',
  });
  const vol1Login = await call('POST', '/auth/login', { email: `vol1_${stamp}@test.com`, password: 'test1234' });
  const vol1Token = vol1Login.data.token;

  await call('POST', '/auth/register', {
    name: 'Volunteer Two', email: `vol2_${stamp}@test.com`, password: 'test1234', role: 'volunteer',
  });
  const vol2Login = await call('POST', '/auth/login', { email: `vol2_${stamp}@test.com`, password: 'test1234' });
  const vol2Token = vol2Login.data.token;
  assert(!!vol1Token && !!vol2Token, 'Both volunteers registered and logged in');

  // 3. Organizer creates an event + a shift for TODAY (so it shows up in the daily report)
  const today = new Date().toISOString().slice(0, 10);
  const eventRes = await call('POST', '/events', {
    title: 'Endpoint Test Cleanup',
    start_date: today,
    end_date: today,
    location: 'Test Site',
  }, orgToken);
  const eventId = eventRes.data.eventId;
  assert(!!eventId, 'Event created for today');

  const shiftRes = await call('POST', `/events/${eventId}/shifts`, {
    shift_date: today, start_time: '09:00:00', end_time: '12:00:00', capacity: 5,
  }, orgToken);
  const shiftId = shiftRes.data.shiftId;
  assert(!!shiftId, 'Shift created');

  // 4. Both volunteers sign up
  const signup1 = await call('POST', `/shifts/${shiftId}/signup`, null, vol1Token);
  const signup2 = await call('POST', `/shifts/${shiftId}/signup`, null, vol2Token);
  const assignmentId1 = signup1.data.assignmentId;
  const assignmentId2 = signup2.data.assignmentId;
  assert(!!assignmentId1 && !!assignmentId2, 'Both volunteers signed up for the shift');

  // 5. Organizer checks IN volunteer 1
  const checkinRes = await call('POST', `/assignments/${assignmentId1}/checkin`, null, orgToken);
  log('Check-in volunteer 1', checkinRes);
  assert(checkinRes.status === 200, 'Check-in endpoint returned 200');

  // 6. Organizer checks OUT volunteer 1
  const checkoutRes = await call('POST', `/assignments/${assignmentId1}/checkout`, null, orgToken);
  log('Check-out volunteer 1', checkoutRes);
  assert(checkoutRes.status === 200, 'Check-out endpoint returned 200');

  // 6b. Sanity check: checkout BEFORE checkin should be rejected (test with volunteer 2, skip normal flow)
  const badCheckoutRes = await call('POST', `/assignments/${assignmentId2}/checkout`, null, orgToken);
  assert(badCheckoutRes.status === 400, 'Check-out without check-in first is correctly rejected (400)');

  // 7. Organizer marks volunteer 2 as a no-show instead
  const noShowRes = await call('POST', `/assignments/${assignmentId2}/no-show`, null, orgToken);
  log('Mark no-show volunteer 2', noShowRes);
  assert(noShowRes.status === 200, 'No-show endpoint returned 200');

  // 8. Daily report for today — should show volunteer 1 as present (with times) and volunteer 2 as no_show
  const dailyRes = await call('GET', `/reports/daily?date=${today}`, null, orgToken);
  log('Daily report', dailyRes);
  const presentRow = dailyRes.data.rows?.find(r => r.volunteer === 'Volunteer One');
  const noShowRow = dailyRes.data.rows?.find(r => r.volunteer === 'Volunteer Two');
  assert(presentRow?.attendance_status === 'present' && presentRow?.check_in_time, 'Daily report shows Volunteer One as present with a check-in time');
  assert(noShowRow?.attendance_status === 'no_show', 'Daily report shows Volunteer Two as no_show');

  // 9. Monthly report for the current month — Volunteer One should show real hours
  const year = today.slice(0, 4);
  const month = today.slice(5, 7);
  const monthlyRes = await call('GET', `/reports/monthly?year=${year}&month=${month}`, null, orgToken);
  log('Monthly report', monthlyRes);
  const monthlyRow = monthlyRes.data.rows?.find(r => r.volunteer === 'Volunteer One');
  assert(monthlyRow && Number(monthlyRow.total_hours) >= 0, 'Monthly report includes Volunteer One with calculated hours');

  // 10. Access control check: a volunteer should NOT be able to check someone in
  const forbiddenRes = await call('POST', `/assignments/${assignmentId1}/checkin`, null, vol1Token);
  assert(forbiddenRes.status === 403, 'Volunteer is correctly forbidden (403) from using the check-in endpoint');

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch((err) => {
  console.error('Test script crashed:', err);
  process.exitCode = 1;
});
