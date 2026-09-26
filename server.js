// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { testConnection } = require('./config/db');
const { requestLogger, errorLogger } = require('./middleware/logger');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Serves uploaded profile pictures at http://localhost:5000/uploads/<filename>
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check — useful to confirm the server + DB are both alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api', assignmentRoutes); // handles /api/shifts/:id/signup and /api/assignments/:id/...
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler (must be registered last)
app.use(errorLogger);

const PORT = process.env.PORT || 5000;

testConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
