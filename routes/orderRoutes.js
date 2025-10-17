const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Order = require('../models/Order');

const { FoodItem } = require('../models/Category');
const User = require('../models/User');

const { auth, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const Branch =require('../models/Branch');
const router = express.Router();
const { sendOrderStatusNotification, sendNewOrderNotification } = require('../utils/notificationService');

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
// Update your POST /api/v1/orders route
// Update your POST /api/v1/orders route validation
router.post('/', [
  auth,
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.foodItem.id').isMongoId().withMessage('Invalid food item ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price is required'),
  body('items.*.totalPrice').isFloat({ min: 0 }).withMessage('Total price is required'),
  body('deliveryType').isIn(['delivery', 'pickup']).withMessage('Invalid delivery type'),
  body('paymentMethod').isIn(['cash-on-delivery','cashOnDelivery', 'card','shop', 'paypal', 'stripe']).withMessage('Invalid payment method'),
  body('codPaymentType').optional().isIn(['cash', 'card']).withMessage('Invalid COD payment type'),
  body('branchId').isMongoId().withMessage('Invalid branch ID'),
  body('deliveryFee').optional().isFloat({ min: 0 }).withMessage('Delivery fee must be a positive number'),
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
    codPaymentType,
    branchId,
    deliveryAddress,
    specialInstructions,
    couponCode,
    deliveryFee: clientDeliveryFee,
    subtotal: clientSubtotal,
    tax: clientTax,
    total: clientTotal
  } = req.body;

  if ((paymentMethod === 'cashOnDelivery' || paymentMethod === 'cash-on-delivery') && !codPaymentType) {
    return res.status(400).json({
      success: false,
      message: 'COD payment type (cash or card) is required for cash on delivery orders'
    });
  }

  if (deliveryType === 'delivery' && !deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'Delivery address is required for delivery orders'
    });
  }

  let processedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const foodItemId = item.foodItem?.id || item.foodItem;
    const foodItem = await FoodItem.findById(foodItemId);

    if (!foodItem || !foodItem.isActive) {
      return res.status(400).json({
        success: false,
        message: `Food item ${foodItemId} is not available`
      });
    }

    // Validate food item is in stock
    if (foodItem.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${foodItem.name}`
      });
    }
    let unitPrice = foodItem.price;

    // Use prices from frontend exactly as sent
    processedItems.push({
      foodItem: foodItem._id,
      quantity: item.quantity,
      selectedMealSize: item.selectedMealSize || undefined,
      selectedExtras: item.selectedExtras || [],
      selectedAddons: item.selectedAddons || [],
      specialInstructions: item.specialInstructions || '',
      unitPrice: unitPrice,
      totalPrice: item.totalPrice
    });

    subtotal += item.totalPrice;
    await foodItem.updateStock(item.quantity, "subtract");
  }

  const deliveryFee = clientDeliveryFee || 0.0;
  const tax = clientTax || 0;
  const discount = couponCode ? (clientSubtotal * 0.1) : 0;
  const total = clientTotal;

  console.log('Order calculation:', {
    subtotal: clientSubtotal,
    deliveryFee,
    tax,
    discount,
    total
  });

  const orderNumber = "ORD" + Date.now();

  const orderData = {
    orderNumber,
    userId: req.user.id,
    items: processedItems,
    subtotal: clientSubtotal,
    deliveryFee,
    tax,
    discount,
    couponCode,
    total,
    paymentMethod,
    paymentStatus: 'pending',
    deliveryType,
    deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : undefined,
    branchId,
    specialInstructions,
    ...(codPaymentType && { codPaymentType })
  };

  const order = await Order.create(orderData);

  await order.populate([
    { path: 'userId', select: 'firstName lastName email phone' },
    { path: 'items.foodItem', select: 'name imageUrl price' },
    { path: 'branchId', select: 'name address phone' }
  ]);

  const orderUserId = order.userId._id ? order.userId._id.toString() : order.userId.toString();

  try {
    if (order.userId?.fcmToken) {
      await sendOrderStatusNotification(orderUserId, order, 'pending');
      console.log('✅ Customer notification sent');
    }

    const adminUsers = await User.find({
      role: { $in: ['admin', 'manager', 'superadmin'] },
      isActive: true,
      fcmToken: { $exists: true, $ne: null }
    }).select('firstName lastName email fcmToken fcmTokens');

    if (adminUsers.length > 0) {
      const adminTokens = [];
      adminUsers.forEach(admin => {
        if (admin.fcmToken) adminTokens.push(admin.fcmToken);
        if (admin.fcmTokens?.length) {
          admin.fcmTokens.forEach(tokenObj => {
            if (tokenObj.token && !adminTokens.includes(tokenObj.token)) {
              adminTokens.push(tokenObj.token);
            }
          });
        }
      });

      const uniqueAdminTokens = [...new Set(adminTokens)];
      if (uniqueAdminTokens.length > 0) {
        await sendNewOrderNotification(uniqueAdminTokens, order);
        console.log('✅ Admin notifications sent');
      }
    }
  } catch (notificationError) {
    console.error('Notification error:', notificationError);
  }

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    order
  });
}));


router.get('/getall', [
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

  let query = { userId: req.user.id || req.user._id || req.user.userId };
  if (status) query.status = status;



  const orders = await Order.find()
    .populate([
      { path: 'items.foodItem', select: 'name imageUrl price' },
      { path: 'branchId', select: 'name address phone' },
{ path: 'userId', select: 'firstName lastName phone email', options: { virtuals: true } }

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
  orders:orders
  });
}));

router.get('/stats', [
  auth,
  authorize('admin', 'manager'),

], asyncHandler(async (req, res) => {

  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate = new Date(),
    
  } = req.query;

  const stats = await Order.getOrderStats(
    new Date(startDate),
    new Date(endDate),
  );

  res.json({
    success: true,
    stats
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

  let query = { userId: req.user.id || req.user._id || req.user.userId };
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
  body('status').isIn(['pending', 'confirmed', 'preparing', 'pickup', 'ready','shop', 'out-for-delivery', 'delivered', 'cancelled']).withMessage('Invalid status'),
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
      const orderUserId = order.userId._id ? order.userId._id.toString() : order.userId.toString();

  await sendOrderStatusNotification(
  orderUserId,
    order,
    status,
    message ? { title: '📦 Order Update', body: message } : null
  );

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


module.exports = router;