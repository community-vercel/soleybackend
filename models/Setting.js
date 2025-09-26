
// models/Setting.js
const mongoose = require('mongoose');

const operatingHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  openTime: {
    type: String,
    default: '09:00',
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time format (HH:MM)']
  },
  closeTime: {
    type: String,
    default: '22:00',
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time format (HH:MM)']
  }
});

const socialMediaSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok'],
    required: true
  },
  url: {
    type: String,
    required: true,
    match: [/^https?:\/\/.+/, 'Please provide a valid URL']
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const paymentGatewaySchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['stripe', 'paypal', 'square', 'razorpay'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    required: function() { return this.isActive; }
  },
  secretKey: {
    type: String,
    required: function() { return this.isActive; },
    select: false // Don't include in queries by default
  },
  webhookSecret: {
    type: String,
    select: false
  },
  testMode: {
    type: Boolean,
    default: true
  }
});

const deliveryZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  coordinates: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  }],
  deliveryFee: {
    type: Number,
    required: true,
    min: [0, 'Delivery fee cannot be negative']
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order amount cannot be negative']
  },
  estimatedDeliveryTime: {
    type: Number, // in minutes
    default: 30,
    min: [5, 'Delivery time must be at least 5 minutes']
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const notificationSettingsSchema = new mongoose.Schema({
  email: {
    newOrder: { type: Boolean, default: true },
    orderCancellation: { type: Boolean, default: true },
    lowStock: { type: Boolean, default: true },
    dailyReport: { type: Boolean, default: true }
  },
  sms: {
    newOrder: { type: Boolean, default: false },
    orderCancellation: { type: Boolean, default: false }
  },
  push: {
    newOrder: { type: Boolean, default: true },
    orderCancellation: { type: Boolean, default: true }
  }
});

const taxSettingsSchema = new mongoose.Schema({
  taxName: {
    type: String,
    default: 'Tax',
    trim: true
  },
  taxRate: {
    type: Number,
    required: true,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  taxType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  isInclusive: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const settingSchema = new mongoose.Schema({
  // Basic Restaurant Information
  restaurantName: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: [100, 'Restaurant name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  logo: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please provide a valid logo URL']
  },
  favicon: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please provide a valid favicon URL']
  },
  
  // Contact Information
  contactPhone: {
    type: String,
    required: [true, 'Contact phone is required'],
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number']
  },
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  websiteUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please provide a valid website URL']
  },
  
  // Address Information
  address: {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'United States' },
    latitude: { type: Number },
    longitude: { type: Number }
  },
  
  // Operating Hours
  operatingHours: [operatingHoursSchema],
  timezone: {
    type: String,
    default: 'America/New_York'
  },
  
  // Business Settings
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    match: [/^[A-Z]{3}$/, 'Currency must be a valid 3-letter code']
  },
  language: {
    type: String,
    default: 'en',
    lowercase: true
  },
  dateFormat: {
    type: String,
    enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    default: 'MM/DD/YYYY'
  },
  timeFormat: {
    type: String,
    enum: ['12', '24'],
    default: '12'
  },
  
  // Order Settings
  orderSettings: {
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative']
    },
    maxOrderAmount: {
      type: Number,
      default: 500,
      min: [1, 'Maximum order amount must be at least 1']
    },
    orderTimeout: {
      type: Number, // in minutes
      default: 30,
      min: [5, 'Order timeout must be at least 5 minutes']
    },
    autoAcceptOrders: {
      type: Boolean,
      default: false
    },
    allowScheduledOrders: {
      type: Boolean,
      default: true
    },
    maxScheduleDays: {
      type: Number,
      default: 7,
      min: [1, 'Must allow scheduling at least 1 day ahead']
    }
  },
  
  // Delivery Settings
  deliverySettings: {
    isDeliveryEnabled: {
      type: Boolean,
      default: true
    },
    defaultDeliveryFee: {
      type: Number,
      default: 2.99,
      min: [0, 'Delivery fee cannot be negative']
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 50,
      min: [0, 'Free delivery threshold cannot be negative']
    },
    deliveryRadius: {
      type: Number, // in kilometers
      default: 10,
      min: [1, 'Delivery radius must be at least 1 km']
    },
    estimatedDeliveryTime: {
      type: Number, // in minutes
      default: 45,
      min: [10, 'Delivery time must be at least 10 minutes']
    }
  },
  
  // Pickup Settings
  pickupSettings: {
    isPickupEnabled: {
      type: Boolean,
      default: true
    },
    estimatedPickupTime: {
      type: Number, // in minutes
      default: 20,
      min: [5, 'Pickup time must be at least 5 minutes']
    },
    pickupInstructions: {
      type: String,
      trim: true,
      maxlength: [500, 'Pickup instructions cannot exceed 500 characters']
    }
  },
  
  // Delivery Zones
  deliveryZones: [deliveryZoneSchema],
  
  // Payment Settings
  paymentGateways: [paymentGatewaySchema],
  acceptedPaymentMethods: [{
    type: String,
    enum: ['cash-on-delivery', 'card', 'paypal', 'apple-pay', 'google-pay', 'bank-transfer']
  }],
  
  // Tax Settings
  taxSettings: [taxSettingsSchema],
  
  // Notification Settings
  notifications: notificationSettingsSchema,
  
  // Social Media
  socialMedia: [socialMediaSchema],
  
  // SEO Settings
  seo: {
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    keywords: [{
      type: String,
      trim: true
    }],
    googleAnalyticsId: {
      type: String,
      trim: true
    },
    facebookPixelId: {
      type: String,
      trim: true
    }
  },
  
  // Theme Settings
  theme: {
    primaryColor: {
      type: String,
      default: '#3B82F6',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
    },
    secondaryColor: {
      type: String,
      default: '#10B981',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
    },
    fontFamily: {
      type: String,
      enum: ['Inter', 'Roboto', 'Open Sans', 'Poppins', 'Lato'],
      default: 'Inter'
    }
  },
  
  // Email Settings
  emailSettings: {
    smtpHost: String,
    smtpPort: {
      type: Number,
      default: 587
    },
    smtpUser: String,
    smtpPassword: {
      type: String,
      select: false
    },
    fromEmail: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    fromName: String
  },
  
  // SMS Settings
  smsSettings: {
    provider: {
      type: String,
      enum: ['twilio', 'nexmo', 'aws-sns']
    },
    apiKey: {
      type: String,
      select: false
    },
    apiSecret: {
      type: String,
      select: false
    },
    fromNumber: String
  },
  
  // Maintenance Mode
  maintenanceMode: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'We are currently under maintenance. Please check back later.',
      maxlength: [200, 'Maintenance message cannot exceed 200 characters']
    }
  },
  
  // Privacy & Terms
  legal: {
    termsOfService: String,
    privacyPolicy: String,
    refundPolicy: String,
    cookiePolicy: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Default operating hours
settingSchema.pre('save', function(next) {
  if (!this.operatingHours || this.operatingHours.length === 0) {
    this.operatingHours = [
      { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '22:00' },
      { day: 'tuesday', isOpen: true, openTime: '09:00', closeTime: '22:00' },
      { day: 'wednesday', isOpen: true, openTime: '09:00', closeTime: '22:00' },
      { day: 'thursday', isOpen: true, openTime: '09:00', closeTime: '22:00' },
      { day: 'friday', isOpen: true, openTime: '09:00', closeTime: '23:00' },
      { day: 'saturday', isOpen: true, openTime: '10:00', closeTime: '23:00' },
      { day: 'sunday', isOpen: true, openTime: '10:00', closeTime: '21:00' }
    ];
  }
  next();
});

// Virtual for full address
settingSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}, ${this.address.country}`;
});

// Virtual for current operating status
settingSchema.virtual('isCurrentlyOpen').get(function() {
  const now = new Date();
  const currentDay = now.toLocaleLowerCase();
  const currentTime = now.toTimeString().slice(0, 5);
  
  const todayHours = this.operatingHours.find(hours => hours.day === currentDay);
  
  if (!todayHours || !todayHours.isOpen) return false;
  
  return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
});

// Method to get active payment gateway
settingSchema.methods.getActivePaymentGateway = function() {
  return this.paymentGateways.find(gateway => gateway.isActive);
};

// Method to check if delivery is available to coordinates
settingSchema.methods.isDeliveryAvailable = function(lat, lng) {
  if (!this.deliverySettings.isDeliveryEnabled) return false;
  
  // Simple radius check (you might want to implement more complex zone checking)
  const restaurantLat = this.address.latitude;
  const restaurantLng = this.address.longitude;
  
  if (!restaurantLat || !restaurantLng) return true; // Allow if coordinates not set
  
  const distance = this.calculateDistance(restaurantLat, restaurantLng, lat, lng);
  return distance <= this.deliverySettings.deliveryRadius;
};

// Helper method to calculate distance between two points
settingSchema.methods.calculateDistance = function(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Indexes
settingSchema.index({ 'address.city': 1 });
settingSchema.index({ 'deliveryZones.isActive': 1 });

module.exports = mongoose.model('Setting', settingSchema);