const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendVerificationEmail,sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();

// @desc    Register user
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

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password
  });

  // Generate email verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Create verification URL
  const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;

  // Send verification email
  try {
    await sendVerificationEmail(user.email, user.firstName, verificationUrl);
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Continue registration even if email fails
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    requiresVerification: true,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified
    }
  });
}));

// @desc    Verify email
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  // Get hashed token
  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token'
    });
  }

  // Mark email as verified
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save({ validateBeforeSave: false });

  // Generate auth token
  const token = user.generateAuthToken();

  // Update last login
  await user.updateLastLogin();

  res.json({
    success: true,
    message: 'Email verified successfully',
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      token: token,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified
    }
  });
}));

// @desc    Resend verification email
// @route   POST /api/v1/auth/resend-verification
// @access  Public
router.post('/resend-verification', [
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
    return res.status(404).json({
      success: false,
      message: 'User not found with that email'
    });
  }

  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate new verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Create verification URL
  const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;

  // Send verification email
  try {
    await sendVerificationEmail(user.email, user.firstName, verificationUrl);
    
    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification email'
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
      message: 'Invalid credential'
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

  // Check if email is verified
  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email before logging in',
      requiresVerification: true,
      email: user.email
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
      token: token,
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

  // Check if phone number is already taken by another user
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

  // Get user with password
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isCurrentPasswordCorrect = await user.matchPassword(currentPassword);

  if (!isCurrentPasswordCorrect) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
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

// @desc    Forgot password
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
    return res.status(404).json({
      success: false,
      message: 'User not found with that email'
    });
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL
  const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;

  // Send password reset email
  try {
    await sendPasswordResetEmail(user.email, user.firstName, resetUrl);
    res.json({
      success: true,
      message: 'Password reset email sent',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset email'
    });
  }
}));

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password/:resetToken
// @access  Public
router.post('/reset-password/:resetToken', [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
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

  // Get hashed token
  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  // Generate new token
  const token = user.generateAuthToken();

  res.json({
    success: true,
    message: 'Password reset successful',
    token
  });
}));

module.exports = router;