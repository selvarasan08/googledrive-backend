const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a random activation token
 * @returns {string} A unique activation token
 */
const generateActivationToken = () => {
  return uuidv4() + '-' + crypto.randomBytes(20).toString('hex');
};

/**
 * Generate a random password reset token
 * @returns {string} A unique password reset token
 */
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Calculate token expiration time
 * @param {number} hours - Number of hours until expiration
 * @returns {Date} Expiration date
 */
const getTokenExpiration = (hours = 24) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

module.exports = {
  generateActivationToken,
  generatePasswordResetToken,
  getTokenExpiration,
};