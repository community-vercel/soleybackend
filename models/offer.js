const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Offer title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Offer description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Subtitle cannot be more than 100 characters']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  bannerColor: {
    type: String,
    default: '#E91E63',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed-amount', 'buy-one-get-one', 'free-delivery', 'combo'],
    required: true
  },
  value: {
    type: Number,
    required: function() {
      return ['percentage', 'fixed-amount'].includes(this.type);
    },
    min: [0, 'Value cannot be negative']
  },
  couponCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]+$/, 'Coupon code can only contain uppercase letters and numbers']
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order amount cannot be negative']
  },
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Maximum discount amount cannot be negative']
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usageCount: {
    type: Number,
    default: 0
  },
  userUsageLimit: {
    type: Number,
    default: 1 // How many times a single user can use this offer
  },
  appliedToCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  appliedToItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodItem'
  }],
  excludedItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodItem'
  }],
  deliveryTypes: [{
    type: String,
    enum: ['delivery', 'pickup']
  }],
  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }],
  userTiers: [{
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(endDate) {
        return endDate > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  priority: {
    type: Number,
    default: 1, // Higher number = higher priority
    min: 1,
    max: 10
  },
  termsAndConditions: [{
    type: String,
    trim: true
  }],
usageHistory: [{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  discountAmount: Number,
  usedAt: {
    type: Date,
    default: Date.now
  }
}, { default: [] }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if offer is currently valid
offerSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         now <= this.endDate &&
         (this.usageLimit === null || this.usageCount < this.usageLimit);
});

// Virtual for remaining uses
offerSchema.virtual('remainingUses').get(function() {
  if (this.usageLimit === null) return 'Unlimited';
  return Math.max(0, this.usageLimit - this.usageCount);
});

// Virtual for discount display
offerSchema.virtual('discountDisplay').get(function() {
  switch (this.type) {
    case 'percentage':
      return `${this.value}% OFF`;
    case 'fixed-amount':
      return `$${this.value} OFF`;
    case 'buy-one-get-one':
      return 'Buy 1 Get 1 Free';
    case 'free-delivery':
      return 'Free Delivery';
    case 'combo':
      return 'Special Combo Deal';
    default:
      return 'Special Offer';
  }
});

// Indexes
offerSchema.index({ isActive: 1, endDate: 1 });
offerSchema.index({ couponCode: 1 });
offerSchema.index({ startDate: 1, endDate: 1 });
offerSchema.index({ isFeatured: 1, priority: -1 });
offerSchema.index({ type: 1 });

// Method to check if user can use this offer
offerSchema.methods.canUserUse = function(userId) {
  if (!this.isValid) return false;
  
  // Ensure usageHistory is an array; default to empty array if undefined or null
  const usageHistory = Array.isArray(this.usageHistory) ? this.usageHistory : [];
  
  const userUsage = usageHistory.filter(usage => 
    usage.user.toString() === userId.toString()
  ).length;
  
  return userUsage < this.userUsageLimit;
};

// Method to calculate discount for an order
offerSchema.methods.calculateDiscount = function(orderDetails) {
  const { subtotal, items, deliveryType } = orderDetails;
  
  // Check minimum order amount
  if (subtotal < this.minOrderAmount) {
    return { valid: false, reason: `Minimum order amount is $${this.minOrderAmount}` };
  }
  
  // Check delivery type restriction
  if (this.deliveryTypes.length > 0 && !this.deliveryTypes.includes(deliveryType)) {
    return { valid: false, reason: 'Offer not valid for this delivery type' };
  }
  
  let discount = 0;
  
  switch (this.type) {
    case 'percentage':
      discount = (subtotal * this.value) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
      break;
      
    case 'fixed-amount':
      discount = Math.min(this.value, subtotal);
      break;
      
    case 'free-delivery':
      // This would be handled in order calculation
      discount = 2.99; // Assuming delivery fee is $2.99
      break;
      
    case 'buy-one-get-one':
      // Simplified BOGO logic
      if (this.appliedToItems.length > 0) {
        const eligibleItems = items.filter(item => 
          this.appliedToItems.some(offerId => 
            offerId.toString() === item.foodItem.toString()
          )
        );
        
        eligibleItems.forEach(item => {
          const freeQuantity = Math.floor(item.quantity / 2);
          discount += freeQuantity * item.unitPrice;
        });
      }
      break;
  }
  
  return {
    valid: true,
    discount: Math.round(discount * 100) / 100
  };
};

// Method to apply offer to user
offerSchema.methods.applyToUser = async function(userId, orderId, discountAmount) {
  this.usageHistory.push({
    user: userId,
    order: orderId,
    discountAmount,
    usedAt: new Date()
  });
  
  this.usageCount += 1;
  return this.save();
};

// Static method to find valid offers for user
offerSchema.statics.findValidOffersForUser = function(userId, orderDetails) {
  const now = new Date();
  
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ['$usageCount', '$usageLimit'] } }
    ]
  })
  .populate('appliedToCategories appliedToItems excludedItems')
  .sort({ priority: -1, createdAt: -1 });
};

// Static method to find offer by coupon code
offerSchema.statics.findByCouponCode = function(code) {
  return this.findOne({
    couponCode: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });
};

module.exports = mongoose.model('Offer', offerSchema);