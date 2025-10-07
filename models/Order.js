const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  foodItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  selectedMealSize: {
    name: String,
    
    additionalPrice: {
      type: Number,
      default: 0
    }
  },
  selectedExtras: [{
    name: String,
    price: Number
  }],
  selectedAddons: [{
    name: String,
    price: Number,
    imageUrl: String
  }],
  specialInstructions: String,
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

const deliveryAddressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum:["home","Home", "office", "Office", "pickup", "other"],
    default: 'pickup'
  },
  
  address: {
    type: String,
    required: true
  },
  apartment: String,
  instructions: String,
  latitude: Number,
  longitude: Number
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: [0, 'Delivery fee cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  couponCode: String,
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  },
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'pickup',
      'shop',
      'out-for-delivery',
      'delivered',
      'cancelled',
      'refunded'
    ],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash-on-delivery','cashOnDelivery', 'card','shop', 'paypal', 'stripe', 'wallet'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially-refunded'],
    default: 'pending'
  },
  paymentDetails: {
    transactionId: String,
    paymentGateway: String,
    paidAt: Date,
    failureReason: String
  },
  deliveryType: {
    type: String,
    enum: ['delivery', 'pickup'],
    required: true
  },
  deliveryAddress: {
    type: deliveryAddressSchema,
    required: function() {
      return this.deliveryType === 'delivery';
    }
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  preparationTime: {
    type: Number, // in minutes
    default: 30
  },
  deliveryTime: {
    type: Number, // in minutes
    default: 30
  },
  specialInstructions: String,
  customerNotes: String,
  adminNotes: String,
  rating: {
    food: {
      type: Number,
      min: 1,
      max: 5
    },
    delivery: {
      type: Number,
      min: 1,
      max: 5
    },
    overall: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    ratedAt: Date
  },
  deliveryAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  trackingUpdates: [{
    status: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    }
  }],
  refund: {
    amount: Number,
    reason: String,
    processedAt: Date,
    refundId: String
  },
  cancellation: {
    reason: String,
    cancelledBy: {
      type: String,
      enum: ['customer', 'admin', 'system']
    },
    cancelledAt: Date,
    refundProcessed: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `FK${String(count + 1).padStart(6, '0')}`;
    
    // Set estimated delivery time if not provided
    if (!this.estimatedDeliveryTime) {
      const totalTime = this.preparationTime + (this.deliveryType === 'delivery' ? this.deliveryTime : 0);
      this.estimatedDeliveryTime = new Date(Date.now() + totalTime * 60 * 1000);
    }
  }
  next();
});

// Indexes for better performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ branchId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ deliveryType: 1 });
orderSchema.index({ createdAt: -1 });

// Virtual for status display
orderSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Order Placed',
    'confirmed': 'Order Confirmed',
    'preparing': 'Preparing',
    'ready': 'Ready for Pickup',
    'out-for-delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for estimated delivery remaining time
orderSchema.virtual('estimatedTimeRemaining').get(function() {
  if (!this.estimatedDeliveryTime) return null;
  
  const now = new Date();
  const remaining = this.estimatedDeliveryTime - now;
  
  if (remaining <= 0) return 0;
  
  return Math.ceil(remaining / (1000 * 60)); // in minutes
});

// Method to add tracking update
orderSchema.methods.addTrackingUpdate = function(status, message, location) {
  this.trackingUpdates.push({
    status,
    message,
    location,
    timestamp: new Date()
  });
  
  // Update main status if provided
  if (status) {
    this.status = status;
  }
  
  return this.save();
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function(status, details = {}) {
  this.paymentStatus = status;
  
  if (details.transactionId) {
    this.paymentDetails.transactionId = details.transactionId;
  }
  
  if (details.paymentGateway) {
    this.paymentDetails.paymentGateway = details.paymentGateway;
  }
  
  if (status === 'paid') {
    this.paymentDetails.paidAt = new Date();
  } else if (status === 'failed' && details.failureReason) {
    this.paymentDetails.failureReason = details.failureReason;
  }
  
  return this.save();
};

// Method to cancel order
orderSchema.methods.cancelOrder = function(reason, cancelledBy = 'customer') {
  this.status = 'cancelled';
  this.cancellation = {
    reason,
    cancelledBy,
    cancelledAt: new Date()
  };
  
  this.addTrackingUpdate('cancelled', `Order cancelled: ${reason}`);
  
  return this.save();
};

// Method to process refund
orderSchema.methods.processRefund = function(amount, reason, refundId) {
  this.refund = {
    amount: amount || this.total,
    reason,
    processedAt: new Date(),
    refundId
  };
  
  this.paymentStatus = amount >= this.total ? 'refunded' : 'partially-refunded';
  
  if (this.cancellation) {
    this.cancellation.refundProcessed = true;
  }
  
  return this.save();
};

// Method to add rating
orderSchema.methods.addRating = function(ratingData) {
  this.rating = {
    ...ratingData,
    ratedAt: new Date()
  };
  
  return this.save();
};

// Static method to get order statistics
orderSchema.statics.getOrderStats = async function(startDate, endDate) {
  const matchConditions = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };

  const stats = await this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        uniqueCustomers: { $addToSet: '$userId' } // Collect unique user IDs
      }
    },
    {
      $project: {
        _id: 0,
        totalOrders: 1,
        totalRevenue: 1,
        averageOrderValue: 1,
        completedOrders: 1,
        cancelledOrders: 1,
        uniqueCustomers: { $size: '$uniqueCustomers' } // Count unique user IDs
      }
    }
  ]);

  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    uniqueCustomers: 0
  }}

// Static method to get popular items
orderSchema.statics.getPopularItems = async function(limit = 10, startDate, endDate) {
  const matchConditions = {
    status: { $in: ['delivered', 'confirmed', 'preparing', 'ready', 'out-for-delivery'] }
  };
  
  if (startDate && endDate) {
    matchConditions.createdAt = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: matchConditions },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.foodItem',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.totalPrice' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'fooditems',
        localField: '_id',
        foreignField: '_id',
        as: 'foodItem'
      }
    },
    { $unwind: '$foodItem' }
  ]);
};

module.exports = mongoose.model('Order', orderSchema);