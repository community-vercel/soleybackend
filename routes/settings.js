const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Setting = require('../models/Setting');
const { auth, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Get restaurant settings
// @route   GET /api/v1/settings
// @access  Private (Admin/Manager only)
router.get('/', [
  auth,
  authorize('admin', 'manager')
], asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  
  // Create default settings if none exist
  if (!settings) {
    settings = await Setting.create({
      restaurantName: 'My Restaurant',
      contactPhone: '+1234567890',
      contactEmail: 'contact@restaurant.com',
      address: {
        street: '123 Main Street',
        city: 'City',
        state: 'State',
        zipCode: '12345',
        country: 'United States'
      }
    });
  }
  
  res.json({
    success: true,
    settings
  });
}));

// @desc    Get public settings (for frontend)
// @route   GET /api/v1/settings/public
// @access  Public
router.get('/public', asyncHandler(async (req, res) => {
  const settings = await Setting.findOne()
    .select('-paymentGateways.secretKey -paymentGateways.webhookSecret -emailSettings.smtpPassword -smsSettings.apiSecret');
  
  if (!settings) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant settings not found'
    });
  }
  
  // Only return public information
  const publicSettings = {
    restaurantName: settings.restaurantName,
    description: settings.description,
    logo: settings.logo,
    address: settings.address,
    contactPhone: settings.contactPhone,
    contactEmail: settings.contactEmail,
    websiteUrl: settings.websiteUrl,
    operatingHours: settings.operatingHours,
    timezone: settings.timezone,
    currency: settings.currency,
    deliverySettings: settings.deliverySettings,
    pickupSettings: settings.pickupSettings,
    socialMedia: settings.socialMedia,
    theme: settings.theme,
    maintenanceMode: settings.maintenanceMode,
    isCurrentlyOpen: settings.isCurrentlyOpen
  };
  
  res.json({
    success: true,
    settings: publicSettings
  });
}));

// @desc    Update restaurant settings
// @route   PUT /api/v1/settings
// @access  Private (Admin/Manager only)
router.put('/', [
  auth,
  authorize('admin', 'manager'),
  body('restaurantName').optional().trim().isLength({ min: 1 }).withMessage('Restaurant name cannot be empty'),
  body('contactPhone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('contactEmail').optional().isEmail().withMessage('Please provide a valid email'),
  body('currency').optional().isISO4217().withMessage('Please provide a valid currency code'),
  body('orderSettings.minOrderAmount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount cannot be negative'),
  body('deliverySettings.deliveryRadius').optional().isFloat({ min: 1 }).withMessage('Delivery radius must be at least 1 km')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  let settings = await Setting.findOne();
  
  if (settings) {
    settings = await Setting.findOneAndUpdate({}, req.body, { 
      new: true, 
      runValidators: true,
      upsert: false
    });
  } else {
    settings = await Setting.create(req.body);
  }

  res.json({
    success: true,
    message: 'Settings updated successfully',
    settings
  });
}));

// @desc    Update operating hours
// @route   PUT /api/v1/settings/hours
// @access  Private (Admin/Manager only)
router.put('/hours', [
  auth,
  authorize('admin', 'manager'),
  body('operatingHours').isArray().withMessage('Operating hours must be an array'),
  body('operatingHours.*.day').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).withMessage('Invalid day'),
  body('operatingHours.*.openTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid open time format'),
  body('operatingHours.*.closeTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid close time format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const settings = await Setting.findOneAndUpdate(
    {},
    { operatingHours: req.body.operatingHours },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Operating hours updated successfully',
    operatingHours: settings.operatingHours
  });
}));

// @desc    Add delivery zone
// @route   POST /api/v1/settings/delivery-zones
// @access  Private (Admin/Manager only)
router.post('/delivery-zones', [
  auth,
  authorize('admin', 'manager'),
  body('name').trim().notEmpty().withMessage('Zone name is required'),
  body('deliveryFee').isFloat({ min: 0 }).withMessage('Delivery fee must be non-negative'),
  body('coordinates').isArray({ min: 3 }).withMessage('Coordinates must be an array with at least 3 points')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const settings = await Setting.findOne();
  settings.deliveryZones.push(req.body);
  await settings.save();

  res.status(201).json({
    success: true,
    message: 'Delivery zone added successfully',
    deliveryZones: settings.deliveryZones
  });
}));

// @desc    Toggle maintenance mode
// @route   PATCH /api/v1/settings/maintenance
// @access  Private (Admin only)
router.patch('/maintenance', [
  auth,
  authorize('admin'),
  body('isEnabled').isBoolean().withMessage('isEnabled must be boolean'),
  body('message').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const settings = await Setting.findOneAndUpdate(
    {},
    { 
      'maintenanceMode.isEnabled': req.body.isEnabled,
      ...(req.body.message && { 'maintenanceMode.message': req.body.message })
    },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: `Maintenance mode ${req.body.isEnabled ? 'enabled' : 'disabled'}`,
    maintenanceMode: settings.maintenanceMode
  });
}));

module.exports = router;