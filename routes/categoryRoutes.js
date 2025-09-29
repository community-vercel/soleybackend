const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Category } = require('../models/Category');
const { auth, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
  const { FoodItem } = require('../models/Category');

const router = express.Router();

// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .populate('itemsCount')
    .sort({ sortOrder: 1, name: 1 });

  res.json({
    success: true,
    count: categories.length,
    categories
  });
}));

// @desc    Get single category
// @route   GET /api/v1/categories/:id
// @access  Public
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid category ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const category = await Category.findById(req.params.id).populate('itemsCount');

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  if (!category.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Category is not available'
    });
  }

  res.json({
    success: true,
    category
  });
}));

// @desc    Create category
// @route   POST /api/v1/categories
// @access  Private (Admin/Manager only)
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const category = await Category.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    category
  });
}));

// @desc    Update category
// @route   PUT /api/v1/categories/:id
// @access  Private (Admin/Manager only)
router.put('/:id', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  let category = await Category.findById(req.params.id);

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  category = await Category.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Category updated successfully',
    category
  });
}));

// @desc    Delete category
// @route   DELETE /api/v1/categories/:id
// @access  Private (Admin only)
router.delete('/:id', [
  auth,
  authorize('admin'),
  param('id').isMongoId().withMessage('Invalid category ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const category = await Category.findById(req.params.id);

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  // Check if category has items
  const itemCount = await FoodItem.countDocuments({ category: req.params.id });

  if (itemCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete category that has food items. Please move items to another category first.'
    });
  }

  await category.deleteOne();

  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
}));

module.exports = router;