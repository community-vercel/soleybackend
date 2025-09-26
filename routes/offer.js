const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Offer = require('../models/offer');
const { auth, authorize, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Get all active offers
// @route   GET /api/v1/offers
// @access  Public
router.get('/', [
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('type').optional().isIn(['percentage', 'fixed-amount', 'buy-one-get-one', 'free-delivery', 'combo']).withMessage('Invalid offer type'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], optionalAuth, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    featured,
    type,
    page = 1,
    limit = 20
  } = req.query;

  const skip = (page - 1) * limit;
  const now = new Date();

  let query = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  };

  // Apply filters
  if (featured !== undefined) query.isFeatured = featured === 'true';
  if (type) query.type = type;

  const offers = await Offer.find(query)
    .populate('appliedToCategories', 'name')
    .populate('appliedToItems', 'name imageUrl price')
    .sort({ priority: -1, isFeatured: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .select('-usageHistory'); // Don't expose usage history to public

  // Filter offers that user can still use (if authenticated)
  let filteredOffers = offers;
  if (req.user) {
    filteredOffers = offers.filter(offer => offer.canUserUse(req.user.id));
  }

  const totalOffers = await Offer.countDocuments(query);
  const totalPages = Math.ceil(totalOffers / limit);

  res.json({
    success: true,
    count: filteredOffers.length,
    totalOffers,
    totalPages,
    currentPage: parseInt(page),
    offers: filteredOffers
  });
}));

// @desc    Get featured offers
// @route   GET /api/v1/offers/featured
// @access  Public
router.get('/featured', optionalAuth, asyncHandler(async (req, res) => {
  const now = new Date();

  const offers = await Offer.find({
    isActive: true,
    isFeatured: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  })
  .populate('appliedToCategories', 'name')
  .populate('appliedToItems', 'name imageUrl price')
  .sort({ priority: -1, createdAt: -1 })
  .limit(6)
  .select('-usageHistory');

  // Filter offers that user can still use (if authenticated)
  let filteredOffers = offers;
  if (req.user) {
    filteredOffers = offers.filter(offer => offer.canUserUse(req.user.id));
  }

  res.json({
    success: true,
    count: filteredOffers.length,
    offers: filteredOffers
  });
}));

// @desc    Get single offer
// @route   GET /api/v1/offers/:id
// @access  Public
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid offer ID')
], optionalAuth, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const offer = await Offer.findById(req.params.id)
    .populate('appliedToCategories', 'name')
    .populate('appliedToItems', 'name imageUrl price')
    .select('-usageHistory');

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  if (!offer.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Offer is not available'
    });
  }

  // Check if user can use this offer
  let userCanUse = true;
  if (req.user) {
    userCanUse = offer.canUserUse(req.user.id);
  }

  res.json({
    success: true,
    offer: {
      ...offer.toJSON(),
      userCanUse
    }
  });
}));

// @desc    Validate coupon code
// @route   POST /api/v1/offers/validate-coupon
// @access  Private
router.post('/validate-coupon', [
  auth,
  body('couponCode').trim().notEmpty().withMessage('Coupon code is required'),
  body('orderDetails.subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be non-negative'),
  body('orderDetails.items').isArray({ min: 1 }).withMessage('Order must contain items'),
  body('orderDetails.deliveryType').isIn(['delivery', 'pickup']).withMessage('Invalid delivery type')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { couponCode, orderDetails } = req.body;

  const offer = await Offer.findByCouponCode(couponCode);

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Invalid coupon code'
    });
  }

  // Check if user can use this offer
  if (!offer.canUserUse(req.user.id)) {
    return res.status(400).json({
      success: false,
      message: 'You have already used this coupon'
    });
  }

  // Calculate discount
  const discountResult = offer.calculateDiscount(orderDetails);

  if (!discountResult.valid) {
    return res.status(400).json({
      success: false,
      message: discountResult.reason
    });
  }

  res.json({
    success: true,
    message: 'Coupon code is valid',
    offer: {
      id: offer._id,
      title: offer.title,
      type: offer.type,
      discountAmount: discountResult.discount
    }
  });
}));

// @desc    Create offer (Admin/Manager only)
// @route   POST /api/v1/offers
// @access  Private (Admin/Manager only)
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('imageUrl').isURL().withMessage('Valid image URL is required'),
  body('type').isIn(['percentage', 'fixed-amount', 'buy-one-get-one', 'free-delivery', 'combo']).withMessage('Invalid offer type'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be non-negative'),
  body('minOrderAmount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be non-negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const offer = await Offer.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Offer created successfully',
    offer
  });
}));

// @desc    Update offer (Admin/Manager only)
// @route   PUT /api/v1/offers/:id
// @access  Private (Admin/Manager only)
router.put('/:id', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid offer ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('imageUrl').optional().isURL().withMessage('Valid image URL is required'),
  body('type').optional().isIn(['percentage', 'fixed-amount', 'buy-one-get-one', 'free-delivery', 'combo']).withMessage('Invalid offer type'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be non-negative'),
  body('minOrderAmount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be non-negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  let offer = await Offer.findById(req.params.id);

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  offer = await Offer.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Offer updated successfully',
    offer
  });
}));

// @desc    Delete offer (Admin only)
// @route   DELETE /api/v1/offers/:id
// @access  Private (Admin only)
router.delete('/:id', [
  auth,
  authorize('admin'),
  param('id').isMongoId().withMessage('Invalid offer ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const offer = await Offer.findById(req.params.id);

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  await offer.deleteOne();

  res.json({
    success: true,
    message: 'Offer deleted successfully'
  });
}));

// @desc    Get offer usage statistics (Admin/Manager only)
// @route   GET /api/v1/offers/:id/stats
// @access  Private (Admin/Manager only)
router.get('/:id/stats', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid offer ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const offer = await Offer.findById(req.params.id)
    .populate('usageHistory.user', 'firstName lastName email')
    .populate('usageHistory.order', 'orderNumber total createdAt');

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  const stats = {
    totalUsage: offer.usageCount,
    remainingUses: offer.remainingUses,
    totalDiscountGiven: offer.usageHistory.reduce((sum, usage) => sum + usage.discountAmount, 0),
    averageDiscountPerUse: offer.usageCount > 0 
      ? offer.usageHistory.reduce((sum, usage) => sum + usage.discountAmount, 0) / offer.usageCount 
      : 0,
    uniqueUsers: new Set(offer.usageHistory.map(usage => usage.user._id.toString())).size,
    recentUsage: offer.usageHistory.slice(-10) // Last 10 uses
  };

  res.json({
    success: true,
    offer: {
      id: offer._id,
      title: offer.title,
      couponCode: offer.couponCode,
      isValid: offer.isValid
    },
    stats
  });
}));

module.exports = router;