# Volunteer Shift Scheduling & Attendance — Backend API

## Setup

1. Install dependencies:
   npm install

2. Copy .env.example to .env and fill in your MySQL password:
   cp .env.example .env

3. Make sure the database is created first (run schema.sql in MySQL,
   from the earlier database setup step).

4. Start the server:
   npm run dev      (auto-restarts on file changes, needs nodemon)
   npm start         (plain node, no auto-restart)

Server runs at http://localhost:5000
Health check: GET http://localhost:5000/api/health

## Folder structure

- config/db.js          MySQL connection pool
- middleware/auth.js     JWT verification + role checking
- middleware/logger.js   Request/error logging to logs/requests.log
- controllers/           Business logic for each resource
- routes/                Express route definitions

## API overview

Auth
  POST /api/auth/register
  POST /api/auth/login

Events
  GET  /api/events              (all events, with sub-events nested)
  GET  /api/events/today        (events happening right now)
  GET  /api/events/:id
  POST /api/events               (organizer/admin only)

Shifts
  GET  /api/events/:eventId/shifts
  POST /api/events/:eventId/shifts   (organizer/admin only)

Signup / Attendance
  POST   /api/shifts/:shiftId/signup     (volunteer only — includes conflict check)
  DELETE /api/assignments/:id            (cancel signup)
  POST   /api/assignments/:id/checkin    (organizer/admin only)
  POST   /api/assignments/:id/checkout   (organizer/admin only)
  POST   /api/assignments/:id/no-show    (organizer/admin only)

Reports
  GET /api/reports/daily?date=2026-09-05
  GET /api/reports/monthly?year=2026&month=9

## Testing with curl

# Register an organizer
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Nadeesha Perera","email":"nadeesha@volunteerhub.lk","password":"test1234","role":"organizer"}'

# Login (copy the token from the response)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nadeesha@volunteerhub.lk","password":"test1234"}'

# Use the token on a protected route
curl http://localhost:5000/api/events \
  -H "Authorization: Bearer <paste_token_here>"
