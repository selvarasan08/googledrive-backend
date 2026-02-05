const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const {
  generateActivationToken,
  generatePasswordResetToken,
  getTokenExpiration,
} = require('../utils/tokenGenerator');

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body;

    // Validate input
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Generate activation token
    const activationToken = generateActivationToken();
    const activationTokenExpires = getTokenExpiration(24); // 24 hours

    // Create user (inactive by default)
    const user = await User.create({
      email,
      firstName,
      lastName,
      password,
      isActive: false,
      activationToken,
      activationTokenExpires,
    });

    // Return token to frontend for EmailJS
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to activate your account.',
      activationToken, // Frontend needs this for EmailJS
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

/**
 * @desc    Activate user account
 * @route   GET /api/auth/activate/:token
 * @access  Public
 */
const activateAccount = async (req, res) => {
  try {
    const { token } = req.params;

    // Find user by token ONLY (ignore expiry first)
    const user = await User.findOne({ activationToken: token });

    // Token not found at all
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activation link',
      });
    }

    // Already activated? Cool, still success.
    if (user.isActive) {
      return res.status(200).json({
        success: true,
        message: 'Account already activated. You can log in.',
      });
    }

    // Token expired
    if (user.activationTokenExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Activation link has expired',
      });
    }

    // Activate user
    user.isActive = true;
    user.activationToken = null;
    user.activationTokenExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Account activated successfully! You can now login.',
    });
  } catch (error) {
    console.error('Activation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during activation',
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if account is activated
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account not activated. Please check your email for activation link.',
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          storageUsed: user.storageUsed,
          storageLimit: user.storageLimit,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
};

/**
 * @desc    Forgot password - send reset token to frontend
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email address',
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not (security)
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Check if account is activated
    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account not activated. Please activate your account first.',
      });
    }

    // Generate reset token
    const resetToken = generatePasswordResetToken();
    const resetTokenExpires = getTokenExpiration(1); // 1 hour

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Return token to frontend for EmailJS
    res.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email.',
      resetToken, // Frontend needs this for EmailJS
      firstName: user.firstName, // For personalized email
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request',
      error: error.message,
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide new password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset',
      error: error.message,
    });
  }
};

/**
 * @desc    Verify JWT token
 * @route   GET /api/auth/verify
 * @access  Private
 */
const verifyToken = async (req, res) => {
  try {
    // User is already attached to req by protect middleware
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          storageUsed: req.user.storageUsed,
          storageLimit: req.user.storageLimit,
        },
      },
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token verification',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  activateAccount,
  login,
  forgotPassword,
  resetPassword,
  verifyToken,
};