const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Offer = require('../models/offer');
const { FoodItem } = require('../models/Category');
const { auth, authorize, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');

const router = express.Router();

// @desc    Get all active offers with applied items
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

  if (featured !== undefined) query.isFeatured = featured === 'true';
  if (type) query.type = type;

  const offers = await Offer.find(query)
    .populate({
      path: 'appliedToItems',
      select: 'name imageUrl price originalPrice category isActive',
      populate: {
        path: 'category',
        select: 'name icon'
      }
    })
    .populate('appliedToCategories', 'name icon')
    .sort({ priority: -1, isFeatured: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .select('-usageHistory');

  // Filter by user usage if authenticated
  let filteredOffers = offers;
  if (req.user) {
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    filteredOffers = offers.filter(offer => offer.canUserUse(req.user.id));
  }

  // Calculate discounted prices for items
  const offersWithPrices = filteredOffers.map(offer => {
    const offerObj = offer.toObject();
    
    if (offerObj.appliedToItems && offerObj.appliedToItems.length > 0) {
      offerObj.appliedToItems = offerObj.appliedToItems.map(item => {
        const discountedPrice = calculateItemDiscount(item.price, offer);
        return {
          ...item,
          discountedPrice,
          savings: item.price - discountedPrice
        };
      });
    }

    return offerObj;
  });

  const totalOffers = await Offer.countDocuments(query);
  const totalPages = Math.ceil(totalOffers / limit);

  res.json({
    success: true,
    count: offersWithPrices.length,
    totalOffers,
    totalPages,
    currentPage: parseInt(page),
    offers: offersWithPrices
  });
}));

// Helper function to calculate item discount
function calculateItemDiscount(originalPrice, offer) {
  if (!offer.isValid) return originalPrice;
  
  let discountedPrice = originalPrice;
  
  switch (offer.type) {
    case 'percentage':
      discountedPrice = originalPrice * (1 - offer.value / 100);
      if (offer.maxDiscountAmount) {
        const maxDiscount = originalPrice - offer.maxDiscountAmount;
        discountedPrice = Math.max(discountedPrice, maxDiscount);
      }
      break;
      
    case 'fixed-amount':
      discountedPrice = Math.max(0, originalPrice - offer.value);
      break;
      
    case 'buy-one-get-one':
      // For BOGO, return half price (assuming quantity of 2)
      discountedPrice = originalPrice / 2;
      break;
  }
  
  return Math.round(discountedPrice * 100) / 100;
}

// @desc    Get food items with active offers
// @route   GET /api/v1/offers/items-with-offers
// @access  Public
router.get('/items-with-offers', asyncHandler(async (req, res) => {
  const now = new Date();

  // Find all active offers
  const activeOffers = await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    appliedToItems: { $exists: true, $ne: [] }
  }).populate('appliedToItems');

  // Get unique food items from all offers
  const itemIds = new Set();
  activeOffers.forEach(offer => {
    offer.appliedToItems.forEach(item => {
      if (item._id) itemIds.add(item._id.toString());
    });
  });

  // Fetch full item details
  const items = await FoodItem.find({
    _id: { $in: Array.from(itemIds) },
    isActive: true
  }).populate('category', 'name icon');

  // Attach best offer to each item
  const itemsWithOffers = items.map(item => {
    const itemOffers = activeOffers.filter(offer =>
      offer.appliedToItems.some(oi => oi._id.toString() === item._id.toString())
    );

    // Find best offer (highest discount)
    let bestOffer = null;
    let bestDiscountedPrice = item.price;
    let bestSavings = 0;

    itemOffers.forEach(offer => {
      const discountedPrice = calculateItemDiscount(item.price, offer);
      const savings = item.price - discountedPrice;
      
      if (savings > bestSavings) {
        bestOffer = {
          id: offer._id,
          title: offer.title,
          type: offer.type,
          value: offer.value,
          badge: offer.discountDisplay
        };
        bestDiscountedPrice = discountedPrice;
        bestSavings = savings;
      }
    });

    return {
      ...item.toObject(),
      offer: bestOffer,
      discountedPrice: bestDiscountedPrice,
      savings: bestSavings,
      discountPercentage: bestSavings > 0 ? Math.round((bestSavings / item.price) * 100) : 0
    };
  });

  res.json({
    success: true,
    count: itemsWithOffers.length,
    items: itemsWithOffers
  });
}));

// @desc    Apply offer to food items
// @route   POST /api/v1/offers/:id/apply-to-items
// @access  Private (Admin/Manager only)
router.post('/:id/apply-to-items', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid offer ID'),
  body('itemIds').isArray({ min: 1 }).withMessage('Item IDs array is required'),
  body('itemIds.*').isMongoId().withMessage('Invalid item ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { itemIds } = req.body;

  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  // Verify all items exist and are active
  const items = await FoodItem.find({
    _id: { $in: itemIds },
    isActive: true
  });

  if (items.length !== itemIds.length) {
    return res.status(400).json({
      success: false,
      message: 'Some items not found or inactive'
    });
  }

  // Update offer with items
  offer.appliedToItems = itemIds;
  await offer.save();

  // Populate items for response
  await offer.populate({
    path: 'appliedToItems',
    select: 'name imageUrl price category',
    populate: { path: 'category', select: 'name icon' }
  });

  res.json({
    success: true,
    message: 'Offer applied to items successfully',
    offer
  });
}));

// @desc    Remove offer from food items
// @route   DELETE /api/v1/offers/:id/remove-from-items
// @access  Private (Admin/Manager only)
router.delete('/:id/remove-from-items', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid offer ID'),
  body('itemIds').isArray({ min: 1 }).withMessage('Item IDs array is required'),
  body('itemIds.*').isMongoId().withMessage('Invalid item ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { itemIds } = req.body;

  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  // Remove specified items from offer
  offer.appliedToItems = offer.appliedToItems.filter(
    item => !itemIds.includes(item.toString())
  );
  
  await offer.save();

  res.json({
    success: true,
    message: 'Items removed from offer successfully',
    offer
  });
}));

// @desc    Create offer with items (Admin/Manager only)
// @route   POST /api/v1/offers
// @access  Private (Admin/Manager only)
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('imageUrl').optional().isURL().withMessage('Valid image URL required'),
body('type').isIn(['percentage', 'fixed-amount', 'buy-one-get-one', 'free-delivery', 'combo']).withMessage('Invalid offer type'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be non-negative'),
  body('appliedToItems').optional().isArray().withMessage('Applied items must be an array'),
  body('appliedToItems.*').optional().isMongoId().withMessage('Invalid item ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Verify items exist if provided
  if (req.body.appliedToItems && req.body.appliedToItems.length > 0) {
    const items = await FoodItem.find({
      _id: { $in: req.body.appliedToItems },
      isActive: true
    });

    if (items.length !== req.body.appliedToItems.length) {
      return res.status(400).json({
        success: false,
        message: 'Some items not found or inactive'
      });
    }
  }

  const offer = await Offer.create(req.body);
  
  await offer.populate({
    path: 'appliedToItems',
    select: 'name imageUrl price category',
    populate: { path: 'category', select: 'name icon' }
  });

  res.status(201).json({
    success: true,
    message: 'Offer created successfully',
    offer
  });
}));
// @desc    Get single offer by ID
// @route   GET /api/v1/offer/:id
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
    .populate({
      path: 'appliedToItems',
      select: 'name imageUrl price originalPrice category isActive',
      populate: {
        path: 'category',
        select: 'name icon'
      }
    })
    .populate('appliedToCategories', 'name icon')
    .populate({
      path: 'comboItems.foodItem',
      select: 'name imageUrl price category'
    });

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found'
    });
  }

  res.json({
    success: true,
    offer
  });
}));

// @desc    Update offer
// @route   PUT /api/v1/offer/:id
// @access  Private (Admin/Manager only)
router.put('/:id', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid offer ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('imageUrl').optional().isURL().withMessage('Valid image URL required'),
  body('type').optional().isIn(['percentage', 'fixed-amount', 'buy-one-get-one', 'free-delivery', 'combo']).withMessage('Invalid offer type'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be non-negative'),
  body('comboPrice').optional().isFloat({ min: 0 }).withMessage('Combo price must be non-negative'),
  body('appliedToItems').optional().isArray().withMessage('Applied items must be an array'),
  body('comboItems').optional().isArray().withMessage('Combo items must be an array')
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

  // Verify items exist if provided
  if (req.body.appliedToItems && req.body.appliedToItems.length > 0) {
    const items = await FoodItem.find({
      _id: { $in: req.body.appliedToItems },
      isActive: true
    });

    if (items.length !== req.body.appliedToItems.length) {
      return res.status(400).json({
        success: false,
        message: 'Some items not found or inactive'
      });
    }
  }

  // Verify combo items if provided
  if (req.body.comboItems && req.body.comboItems.length > 0) {
    const comboItemIds = req.body.comboItems.map(item => item.foodItem);
    const items = await FoodItem.find({
      _id: { $in: comboItemIds },
      isActive: true
    });

    if (items.length !== comboItemIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some combo items not found or inactive'
      });
    }
  }

  // Update offer
  Object.keys(req.body).forEach(key => {
    offer[key] = req.body[key];
  });

  await offer.save();

  await offer.populate([
    {
      path: 'appliedToItems',
      select: 'name imageUrl price category',
      populate: { path: 'category', select: 'name icon' }
    },
    {
      path: 'comboItems.foodItem',
      select: 'name imageUrl price category'
    }
  ]);

  res.json({
    success: true,
    message: 'Offer updated successfully',
    offer
  });
}));

// @desc    Delete offer
// @route   DELETE /api/v1/offer/:id
// @access  Private (Admin/Manager only)
router.delete('/:id', [
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

module.exports = router;