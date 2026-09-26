// middleware/logger.js
// Lightweight request + error logger.
// Logs every request to a file so you have an audit trail for your
// project's "logging for maintainability" requirement.

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logFile = path.join(logDir, 'requests.log');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms) user=${req.user?.id || 'anonymous'}\n`;
    fs.appendFile(logFile, line, () => {}); // fire-and-forget, don't block the response
  });

  next();
}

function errorLogger(err, req, res, next) {
  const line = `[${new Date().toISOString()}] ERROR ${req.method} ${req.originalUrl} - ${err.message}\n${err.stack}\n`;
  fs.appendFile(logFile, line, () => {});
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

module.exports = { requestLogger, errorLogger };
