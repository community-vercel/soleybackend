const express = require('express');
const { query, body, param, validationResult } = require('express-validator');
const { FoodItem, Category } = require('../models/Category');
const { auth, authorize, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { detectLanguage, localizeResponse } = require('../middleware/languageMiddleware');

const router = express.Router();

// @desc    Get all food items
// @route   GET /api/v1/food-items
// @access  Public

router.use(detectLanguage);
router.use(localizeResponse);

router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isMongoId(),
  query('featured').optional().isBoolean(),
  query('popular').optional().isBoolean(),
  query('veg').optional().isBoolean(),
  query('search').optional().trim().isLength({ min: 2 }),
  query('priceMin').optional().isFloat({ min: 0 }),
  query('priceMax').optional().isFloat({ min: 0 }),
  query('rating').optional().isFloat({ min: 0, max: 5 }),
  query('sortBy').optional().isIn(['relevance', 'price-low', 'price-high', 'rating', 'popular', 'newest'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    page = 1,
    limit = 20,
    category,
    featured,
    popular,
    veg,
    search,
    priceMin,
    priceMax,
    rating,
    sortBy = 'relevance'
  } = req.query;

  const skip = (page - 1) * limit;
  let query = { isActive: true };

  // Apply filters
  if (category) query.category = category;
  if (featured !== undefined) query.isFeatured = featured === 'true';
  if (popular !== undefined) query.isPopular = popular === 'true';
  if (veg !== undefined) query.isVeg = veg === 'true';
  if (rating) query['rating.average'] = { $gte: parseFloat(rating) };

  // Price range filter
  if (priceMin !== undefined || priceMax !== undefined) {
    query.price = {};
    if (priceMin !== undefined) query.price.$gte = parseFloat(priceMin);
    if (priceMax !== undefined) query.price.$lte = parseFloat(priceMax);
  }

  // Search functionality - search in current language
  if (search) {
    const lang = req.language;
    query.$or = [
      { [`name.${lang}`]: { $regex: search, $options: 'i' } },
      { [`description.${lang}`]: { $regex: search, $options: 'i' } },
      { [`name.en`]: { $regex: search, $options: 'i' } },
      { [`description.en`]: { $regex: search, $options: 'i' } }
    ];
  }

  // Build sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'price-low':
      sortOptions = { price: 1 };
      break;
    case 'price-high':
      sortOptions = { price: -1 };
      break;
    case 'rating':
      sortOptions = { 'rating.average': -1, 'rating.count': -1 };
      break;
    case 'popular':
      sortOptions = { totalSold: -1 };
      break;
    case 'newest':
      sortOptions = { createdAt: -1 };
      break;
    default:
      sortOptions = { 'rating.average': -1 };
  }

  // Execute query
  const items = await FoodItem.find(query)
    .populate('category', 'name icon imageUrl')
    .sort(sortOptions)
    .limit(parseInt(limit))
    .skip(skip)
    .select('-reviews');

  const totalItems = await FoodItem.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit);

  res.json({
    success: true,
    count: items.length,
    totalItems,
    totalPages,
    currentPage: parseInt(page),
    language: req.language,
    items
  });
}));




router.get('/getallitems', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isMongoId().withMessage('Category must be a valid ID'),
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('popular').optional().isBoolean().withMessage('Popular must be boolean'),
  query('veg').optional().isBoolean().withMessage('Veg must be boolean'),
  query('priceMin').optional().isFloat({ min: 0 }).withMessage('Price min must be non-negative'),
  query('priceMax').optional().isFloat({ min: 0 }).withMessage('Price max must be non-negative'),
  query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  query('sortBy').optional().isIn(['relevance', 'price-low', 'price-high', 'rating', 'popular', 'newest']).withMessage('Invalid sort option')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    page = 1,
    limit = 20,
    category,
    featured,
    popular,
    veg,
    search,
    priceMin,
    priceMax,
    rating,
    sortBy = 'relevance'
  } = req.query;

  const skip = (page - 1) * limit;

  let query = { isActive: true };

  // Apply filters
  if (category) query.category = category;
  if (featured !== undefined) query.isFeatured = featured === 'true';
  if (popular !== undefined) query.isPopular = popular === 'true';
  if (veg !== undefined) query.isVeg = veg === 'true';
  if (rating) query['rating.average'] = { $gte: parseFloat(rating) };

  // Price range filter
  if (priceMin !== undefined || priceMax !== undefined) {
    query.price = {};
    if (priceMin !== undefined) query.price.$gte = parseFloat(priceMin);
    if (priceMax !== undefined) query.price.$lte = parseFloat(priceMax);
  }

  // Search functionality
  if (search) {
    query.$text = { $search: search };
  }

  // Build sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'price-low':
      sortOptions = { price: 1 };
      break;
    case 'price-high':
      sortOptions = { price: -1 };
      break;
    case 'rating':
      sortOptions = { 'rating.average': -1, 'rating.count': -1 };
      break;
    case 'popular':
      sortOptions = { totalSold: -1 };
      break;
    case 'newest':
      sortOptions = { createdAt: -1 };
      break;
    default: // relevance
      if (search) {
        sortOptions = { score: { $meta: 'textScore' } };
      } else {
        sortOptions = { 'rating.average': -1 };
      }
  }

  // Execute query
  const items = await FoodItem.find(query)
    .populate('category', 'name icon')
    .sort(sortOptions)
    .limit(parseInt(limit))
    .skip(skip)
    .select('-reviews'); // Exclude reviews for performance

  // Get total count for pagination
  const totalItems = await FoodItem.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit);

  res.json({
    success: true,
    count: items.length,
    totalItems,
    totalPages,
    currentPage: parseInt(page),
    items
  });
}));
// @desc    Get featured food items
// @route   GET /api/v1/food-items/featured
// @access  Public
router.get('/featured', [
  query('limit').optional().isInt({ min: 1, max: 20 })
], asyncHandler(async (req, res) => {
  const { limit = 6 } = req.query;

  const items = await FoodItem.find({ isFeatured: true, isActive: true })
    .populate('category', 'name icon')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: items.length,
    language: req.language,
    items
  });
}));

// @desc    Get popular food items
// @route   GET /api/v1/food-items/popular
// @access  Public
router.get('/popular', [
  query('limit').optional().isInt({ min: 1, max: 20 })
], asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const items = await FoodItem.find({ isActive: true })
    .populate('category', 'name icon')
    .sort({ totalSold: -1, 'rating.average': -1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: items.length,
    language: req.language,
    items
  });
}));

// @desc    Get single food item (localized)
// @route   GET /api/v1/food-items/:id?lang=es
// @access  Public
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid food item ID')
], optionalAuth, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const item = await FoodItem.findById(req.params.id)
    .populate('category', 'name icon')
    .populate({
      path: 'reviews.user',
      select: 'firstName lastName avatar'
    });

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Food item not found'
    });
  }

  if (!item.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Food item is not available'
    });
  }

  res.json({
    success: true,
    language: req.language,
    item
  });
}));

// @desc    Get single food item
// @route   GET /api/v1/food-items/:id
// @access  Public
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid food item ID')
], optionalAuth, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const item = await FoodItem.findById(req.params.id)
    .populate('category', 'name icon')
    .populate({
      path: 'reviews.user',
      select: 'firstName lastName avatar'
    });

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Food item not found'
    });
  }

  if (!item.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Food item is not available'
    });
  }

  res.json({
    success: true,
    item
  });
}));

// @desc    Add review to food item
// @route   POST /api/v1/food-items/:id/reviews
// @access  Private
router.post('/:id/reviews', [
  auth,
  param('id').isMongoId().withMessage('Invalid food item ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { rating, comment } = req.body;

  const item = await FoodItem.findById(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Food item not found'
    });
  }

  // Check if user already reviewed this item
  const existingReview = item.reviews.find(
    review => review.user.toString() === req.user.id
  );

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'You have already reviewed this item'
    });
  }

  // Add review
  await item.addReview(req.user.id, rating, comment);

  res.status(201).json({
    success: true,
    message: 'Review added successfully'
  });
}));

// @desc    Create food item
// @route   POST /api/v1/food-items
// @access  Private (Admin/Manager only)
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('name.en').trim().notEmpty().withMessage('English name is required'),
  body('name.es').optional().trim(),
  body('name.ca').optional().trim(),
  body('name.ar').optional().trim(),
  body('description.en').trim().notEmpty().withMessage('English description is required'),
  body('description.es').optional().trim(),
  body('description.ca').optional().trim(),
  body('description.ar').optional().trim(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('imageUrl').isURL().withMessage('Valid image URL is required'),
  body('category').isMongoId().withMessage('Valid category ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const category = await Category.findById(req.body.category);
  if (!category) {
    return res.status(400).json({
      success: false,
      message: 'Category not found'
    });
  }

  const item = await FoodItem.create(req.body);
  await item.populate('category', 'name icon');

  res.status(201).json({
    success: true,
    message: 'Food item created successfully',
    item
  });
}));


// @desc    Update food item
// @route   PUT /api/v1/food-items/:id
// @access  Private (Admin/Manager only)
router.put('/:id', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid food item ID'),
  body('name.en').optional().trim().notEmpty(),
  body('name.es').optional().trim(),
  body('name.ca').optional().trim(),
  body('name.ar').optional().trim(),
  body('description.en').optional().trim().notEmpty(),
  body('description.es').optional().trim(),
  body('description.ca').optional().trim(),
  body('description.ar').optional().trim(),
  body('price').optional().isFloat({ min: 0 }),
  body('imageUrl').optional().isURL(),
  body('category').optional().isMongoId()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  let item = await FoodItem.findById(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Food item not found'
    });
  }

  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }
  }

  item = await FoodItem.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('category', 'name icon');

  res.json({
    success: true,
    message: 'Food item updated successfully',
    item
  });
}));
// @desc    Delete food item
// @route   DELETE /api/v1/food-items/:id
// @access  Private (Admin only)
router.delete('/:id', [
  auth,
  authorize('admin'),
  param('id').isMongoId()
], asyncHandler(async (req, res) => {
  const item = await FoodItem.findById(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Food item not found'
    });
  }

  await item.deleteOne();

  res.json({
    success: true,
    message: 'Food item deleted successfully'
  });
}));


// @desc    Update stock for food item
// @route   PATCH /api/v1/food-items/:id/stock
// @access  Private (Admin/Manager only)
router.patch('/:id/stock', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid food item ID'),
  body('quantity').isInt().withMessage('Quantity must be an integer'),
  body('operation').isIn(['add', 'subtract']).withMessage('Operation must be add or subtract')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { quantity, operation } = req.body;

  const item = await FoodItem.findById(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Food item not found'
    });
  }

  await item.updateStock(Math.abs(quantity), operation);

  res.json({
    success: true,
    message: 'Stock updated successfully',
    stockQuantity: item.stockQuantity
  });
}));

module.exports = router;