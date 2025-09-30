const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Order = require('../models/Order');
const { FoodItem } = require('../models/Category');
const { auth, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
router.post('/', [
  auth,
   body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
body('items.*.foodItem.id').isMongoId().withMessage('Invalid food item ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deliveryType').isIn(['delivery', 'pickup']).withMessage('Invalid delivery type'),
  body('paymentMethod').isIn(['cash-on-delivery','cashOnDelivery', 'card', 'paypal', 'stripe']).withMessage('Invalid payment method'),
body('branchId').isMongoId().withMessage('Invalid branch ID')
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
    items,
    deliveryType,
    paymentMethod,
    branchId,
    deliveryAddress,
    specialInstructions,
    couponCode
  } = req.body;

  
  // Validate delivery address for delivery orders
  if (deliveryType === 'delivery' && !deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'Delivery address is required for delivery orders'
    });
  }

  // Process cart items and calculate totals
 let processedItems = [];
  let subtotal = 0;

for (const item of items) {
  const foodItemId = item.foodItem?.id || item.foodItem; // <-- get the ID
  const foodItem = await FoodItem.findById(foodItemId);

  if (!foodItem || !foodItem.isActive) {
    return res.status(400).json({
      success: false,
      message: `Food item ${foodItemId} is not available`
    });
  }

  let unitPrice = foodItem.price;

  if (item.selectedMealSize) {
    unitPrice += item.selectedMealSize.additionalPrice || 0;
  }
  
  if (item.selectedExtras) {
    unitPrice += item.selectedExtras.reduce((sum, extra) => sum + (extra.price || 0), 0);
  }
  
  if (item.selectedAddons) {
    unitPrice += item.selectedAddons.reduce((sum, addon) => sum + (addon.price || 0), 0);
  }

  const totalPrice = unitPrice * item.quantity;

  processedItems.push({
    foodItem: foodItem._id, // <-- store ID only
    quantity: item.quantity,
    selectedMealSize: item.selectedMealSize,
    selectedExtras: item.selectedExtras || [],
    selectedAddons: item.selectedAddons || [],
    specialInstructions: item.specialInstructions,
    unitPrice,
    totalPrice
  });

  subtotal += totalPrice;

  await foodItem.updateStock(item.quantity, "subtract");
}


  // Calculate delivery fee and tax
  const deliveryFee = deliveryType === 'delivery' ? 0.0 : 0;
  const taxRate = 0.00; // 8% tax
  const tax = subtotal * taxRate;
  
  // Apply discount/coupon (simplified)
  let discount = 0;
  if (couponCode) {
    // In a real app, you'd validate the coupon code
    discount = subtotal * 0.1; // 10% discount example
  }

  const total = subtotal + deliveryFee + tax - discount;

  // Create order
  const orderNumber = "ORD" + Date.now(); // Simple unique order number

  const order = await Order.create({

orderNumber,
    userId: req.user.id,
    items: processedItems,
    subtotal,
    deliveryFee,
    tax,
    discount,
    couponCode,
    total,
    paymentMethod,
    deliveryType,
    deliveryAddress,
    branchId,
    specialInstructions
  });

  // Populate order details
  await order.populate([
    { path: 'userId', select: 'firstName lastName email phone' },
    { path: 'items.foodItem', select: 'name imageUrl price' },
    { path: 'branchId', select: 'name address phone' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    order
  });
}));

// @desc    Get user orders
// @route   GET /api/v1/orders
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  let query = { userId: req.user.id };
  if (status) query.status = status;

  const orders = await Order.find(query)
    .populate([
      { path: 'items.foodItem', select: 'name imageUrl price' },
      { path: 'branchId', select: 'name address phone' }
    ])
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  res.json({
    success: true,
    count: orders.length,
    totalOrders,
    totalPages,
    currentPage: parseInt(page),
    orders
  });
}));

// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
router.get('/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid order ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const order = await Order.findById(req.params.id)
    .populate([
      { path: 'userId', select: 'firstName lastName email phone' },
      { path: 'items.foodItem', select: 'name imageUrl price description' },
      { path: 'branchId', select: 'name address phone' },
      { path: 'deliveryAgent', select: 'firstName lastName phone' }
    ]);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const orderUserId = order.userId._id ? order.userId._id.toString() : order.userId.toString();


  
if (
  orderUserId !== req.user.id &&
  !['admin', 'manager'].includes(req.user.role)
) {
  return res.status(403).json({
    success: false,
    message: 'Not authorized to access this order'
  });
}


  res.json({
    success: true,
    order
  });
}));

// @desc    Update order status
// @route   PATCH /api/v1/orders/:id/status
// @access  Private (Admin/Manager only)
router.patch('/:id/status', [
  auth,
  authorize('admin', 'manager'),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled']).withMessage('Invalid status'),
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

  const { status, message } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Add tracking update
  await order.addTrackingUpdate(
    status,
    message || `Order status updated to ${status}`,
    null
  );

  // Set actual delivery time if delivered
  if (status === 'delivered' && !order.actualDeliveryTime) {
    order.actualDeliveryTime = new Date();
    await order.save();
  }

  res.json({
    success: true,
    message: 'Order status updated successfully',
    order: {
      id: order._id,
      status: order.status,
      estimatedTimeRemaining: order.estimatedTimeRemaining
    }
  });
}));

// @desc    Cancel order
// @route   PATCH /api/v1/orders/:id/cancel
// @access  Private
router.patch('/:id/cancel', [
  auth,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').trim().notEmpty().withMessage('Cancellation reason is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { reason } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Check if user owns this order or is admin/manager
  if (order.userId.toString() !== req.user.id && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this order'
    });
  }

  // Check if order can be cancelled
  if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: 'Order cannot be cancelled'
    });
  }

  const cancelledBy = req.user.role === 'admin' || req.user.role === 'manager' ? 'admin' : 'customer';
  await order.cancelOrder(reason, cancelledBy);

  // Restore stock for cancelled items
  for (const item of order.items) {
    const foodItem = await FoodItem.findById(item.foodItem);
    if (foodItem) {
      await foodItem.updateStock(item.quantity, 'add');
    }
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    order: {
      id: order._id,
      status: order.status,
      cancellation: order.cancellation
    }
  });
}));

// @desc    Add rating to order
// @route   POST /api/v1/orders/:id/rating
// @access  Private
router.post('/:id/rating', [
  auth,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('food').optional().isInt({ min: 1, max: 5 }).withMessage('Food rating must be between 1 and 5'),
  body('delivery').optional().isInt({ min: 1, max: 5 }).withMessage('Delivery rating must be between 1 and 5'),
  body('overall').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
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

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Check if user owns this order
  if (order.userId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to rate this order'
    });
  }

  // Check if order is delivered
  if (order.status !== 'delivered') {
    return res.status(400).json({
      success: false,
      message: 'Can only rate delivered orders'
    });
  }

  // Check if already rated
  if (order.rating && order.rating.overall) {
    return res.status(400).json({
      success: false,
      message: 'Order has already been rated'
    });
  }

  await order.addRating(req.body);

  res.json({
    success: true,
    message: 'Rating added successfully'
  });
}));

// @desc    Get order statistics (Admin/Manager only)
// @route   GET /api/v1/orders/stats
// @access  Private (Admin/Manager only)
router.get('/stats', [
  auth,
  authorize('admin', 'manager'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('branchId').optional().isMongoId().withMessage('Invalid branch ID')
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
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate = new Date(),
    branchId
  } = req.query;

  const stats = await Order.getOrderStats(
    new Date(startDate),
    new Date(endDate),
    branchId
  );

  res.json({
    success: true,
    stats
  });
}));

module.exports = router;