const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendOTPEmail, sendPasswordResetOTPEmail } = require('../utils/emailService');
  const { sendNotificationToDevice } = require('../utils/firebaseAdmin');

const router = express.Router();

// Temporary storage for pending registrations (in production, use Redis)
const pendingRegistrations = new Map();

// Clean up expired registrations every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of pendingRegistrations.entries()) {
    if (now > data.otpExpire) {
      pendingRegistrations.delete(email);
    }
  }
}, 15 * 60 * 1000);

// @desc    Request registration OTP (Step 1)
// @route   POST /api/v1/auth/register
// @access  Public
router.post('/register', [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { firstName, lastName, email, phone, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ 
    $or: [{ email }, { phone }] 
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: existingUser.email === email 
        ? 'Email already registered' 
        : 'Phone number already registered'
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Hash password before storing temporarily
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Store registration data temporarily
  pendingRegistrations.set(email, {
    firstName,
    lastName,
    email,
    phone,
    password: hashedPassword,
    otp,
    otpExpire,
    createdAt: Date.now()
  });

  // Send OTP email
  try {
    await sendOTPEmail(email, firstName, otp);
    
    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please verify to complete registration.',
      requiresVerification: true,
      email
    });
  } catch (error) {
    // Remove from pending if email fails
    pendingRegistrations.delete(email);
    console.error('Error sending OTP email:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    });
  }
}));

// @desc    Verify OTP and complete registration (Step 2)
// @route   POST /api/v1/auth/verify-registration
// @access  Public
router.post('/verify-registration', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, otp } = req.body;

  // Get pending registration
  const pendingData = pendingRegistrations.get(email);

  if (!pendingData) {
    return res.status(404).json({
      success: false,
      message: 'Registration session not found or expired. Please register again.'
    });
  }

  // Check if OTP is expired
  if (Date.now() > pendingData.otpExpire) {
    pendingRegistrations.delete(email);
    return res.status(400).json({
      success: false,
      message: 'OTP has expired. Please register again.'
    });
  }

  // Verify OTP
  if (pendingData.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP'
    });
  }

  // Check again if user was created in the meantime
  const existingUser = await User.findOne({ 
    $or: [{ email: pendingData.email }, { phone: pendingData.phone }] 
  });

  if (existingUser) {
    pendingRegistrations.delete(email);
    return res.status(400).json({
      success: false,
      message: 'User already registered. Please login.'
    });
  }

  // Create user (password is already hashed)
  const user = await User.create({
    firstName: pendingData.firstName,
    lastName: pendingData.lastName,
    email: pendingData.email,
    phone: pendingData.phone,
    password: pendingData.password,
    emailVerified: true // Mark as verified since OTP was confirmed
  });

  // Remove from pending registrations
  pendingRegistrations.delete(email);

  // Generate auth token
  const token = user.generateAuthToken();

  // Update last login
  await user.updateLastLogin();

  res.status(201).json({
    success: true,
    message: 'Registration completed successfully',
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified
    }
  });
}));

// @desc    Resend registration OTP
// @route   POST /api/v1/auth/resend-registration-otp
// @access  Public
router.post('/resend-registration-otp', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  // Check if there's a pending registration
  const pendingData = pendingRegistrations.get(email);

  if (!pendingData) {
    return res.status(404).json({
      success: false,
      message: 'No pending registration found. Please start registration again.'
    });
  }

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpire = Date.now() + 10 * 60 * 1000;

  // Update pending registration with new OTP
  pendingData.otp = otp;
  pendingData.otpExpire = otpExpire;
  pendingRegistrations.set(email, pendingData);

  // Send OTP email
  try {
    await sendOTPEmail(email, pendingData.firstName, otp);
    
    res.json({
      success: true,
      message: 'New verification code sent successfully'
    });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
}));

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account has been deactivated. Please contact support.'
    });
  }

  // Check password
  const isPasswordCorrect = await user.matchPassword(password);

  if (!isPasswordCorrect) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Generate token
  const token = user.generateAuthToken();

  // Update last login
  await user.updateLastLogin();

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      lastLogin: user.lastLogin
    }
  });
}));

// @desc    Get current user profile
// @route   GET /api/v1/auth/profile
// @access  Private
router.get('/profile', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    user
  });
}));

// @desc    Update user profile
// @route   PATCH /api/v1/auth/profile
// @access  Private
router.patch('/profile', [
  auth,
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { firstName, lastName, phone } = req.body;

  if (phone) {
    const existingUser = await User.findOne({ 
      phone, 
      _id: { $ne: req.user.id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }
  }

  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone) updateData.phone = phone;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user
  });
}));

// @desc    Change password
// @route   PATCH /api/v1/auth/change-password
// @access  Private
router.patch('/change-password', [
  auth,
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  const isCurrentPasswordCorrect = await user.matchPassword(currentPassword);

  if (!isCurrentPasswordCorrect) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
router.post('/logout', auth, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

// @desc    Request password reset OTP
// @route   POST /api/v1/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password reset code has been sent.'
    });
  }

  const otp = user.generatePasswordResetOTP();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetOTPEmail(user.email, user.firstName, otp);
    
    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email'
    });
  } catch (error) {
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpire = undefined;
    await user.save({ validateBeforeSave: false });
    
    console.error('Error sending password reset OTP email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset code. Please try again.'
    });
  }
}));

// @desc    Verify password reset OTP
// @route   POST /api/v1/auth/verify-reset-otp
// @access  Public
router.post('/verify-reset-otp', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const isValidOTP = user.verifyPasswordResetOTP(otp);

  if (!isValidOTP) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP'
    });
  }

  const resetToken = user.generateAuthToken();

  res.json({
    success: true,
    message: 'OTP verified successfully',
    resetToken
  });
}));

// @desc    Reset password with verified OTP
// @route   POST /api/v1/auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('resetToken')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, resetToken, newPassword } = req.body;

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    
    if (decoded.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.resetPasswordOTP || !user.resetPasswordOTPExpire) {
      return res.status(400).json({
        success: false,
        message: 'Please verify OTP first'
      });
    }

    if (Date.now() > user.resetPasswordOTPExpire) {
      return res.status(400).json({
        success: false,
        message: 'Reset session expired. Please request a new code.'
      });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpire = undefined;
    await user.save();

    const token = user.generateAuthToken();

    res.json({
      success: true,
      message: 'Password reset successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }
}));

// @desc    Resend password reset OTP
// @route   POST /api/v1/auth/resend-reset-otp
// @access  Public
router.post('/resend-reset-otp', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a new code has been sent.'
    });
  }

  const otp = user.generatePasswordResetOTP();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetOTPEmail(user.email, user.firstName, otp);
    
    res.json({
      success: true,
      message: 'New password reset code sent successfully'
    });
  } catch (error) {
    console.error('Error sending password reset OTP email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset code'
    });
  }
}));

// Add these routes to your auth.js routes file

// @desc    Update FCM token
// @route   POST /api/v1/auth/fcm-token
// @access  Private
router.post('/fcm-token', [
  auth,
  body('fcmToken')
    .notEmpty()
    .withMessage('FCM token is required'),
  body('deviceId')
    .optional()
    .trim(),
  body('platform')
    .optional()
    .isIn(['android', 'ios', 'web'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { fcmToken, deviceId, platform } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  await user.updateFCMToken(
    fcmToken, 
    deviceId || 'default', 
    platform || 'android'
  );

  res.json({
    success: true,
    message: 'FCM token updated successfully'
  });
}));

// @desc    Remove FCM token
// @route   DELETE /api/v1/auth/fcm-token
// @access  Private
router.delete('/fcm-token', [
  auth,
  body('deviceId')
    .optional()
    .trim()
], asyncHandler(async (req, res) => {
  const { deviceId } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  await user.removeFCMToken(deviceId || 'default');

  res.json({
    success: true,
    message: 'FCM token removed successfully'
  });
}));

// @desc    Test notification
// @route   POST /api/v1/auth/test-notification
// @access  Private
router.post('/test-notification', [
  auth
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user || !user.fcmToken) {
    return res.status(400).json({
      success: false,
      message: 'No FCM token registered'
    });
  }

  
  const result = await sendNotificationToDevice(
    user.fcmToken,
    '🔔 Test Notification',
    'This is a test notification from your app!',
    {
      type: 'test',
      timestamp: new Date().toISOString()
    }
  );

  res.json({
    success: result.success,
    message: result.success ? 'Test notification sent' : 'Failed to send notification',
    details: result
  });
}));
module.exports = router;