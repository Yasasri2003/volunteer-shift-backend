// utils/validatePassword.js
//
// Requires: at least 8 characters, at least one letter, one number, and
// one symbol. Mirrored on the frontend for instant feedback — the backend
// re-checks regardless, so it can't be bypassed by editing frontend code.

function getPasswordIssues(password) {
  const issues = [];
  if (typeof password !== 'string' || password.length < 8) {
    issues.push('at least 8 characters');
  }
  if (!/[a-zA-Z]/.test(password)) {
    issues.push('a letter');
  }
  if (!/[0-9]/.test(password)) {
    issues.push('a number');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    issues.push('a symbol (e.g. ! @ # $ %)');
  }
  return issues;
}

function isStrongPassword(password) {
  return getPasswordIssues(password).length === 0;
}

module.exports = { isStrongPassword, getPasswordIssues };
