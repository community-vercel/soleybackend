const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'other'
  },
  address: {
    type: String,
    required: true
  },
  apartment: String,
  instructions: String,
  latitude: Number,
  longitude: Number,
  isDefault: {
    type: Boolean,
    default: false
  }
});

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\+?[\d\s-()]+$/, 'Please provide a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  addresses: [addressSchema],
  role: {
    type: String,
    enum: ['user', 'admin', 'manager'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
    fcmToken: {
    type: String,
    default: null
  },
  fcmTokens: [{
    token: String,
    deviceId: String,
    platform: {
      type: String,
      enum: ['android', 'ios', 'web']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    dietary: {
      vegetarian: { type: Boolean, default: false },
      vegan: { type: Boolean, default: false },
      glutenFree: { type: Boolean, default: false },
      nutFree: { type: Boolean, default: false }
    }
  },
  lastLogin: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailOTP: String,
  emailOTPExpire: Date,
  resetPasswordOTP: String,
  resetPasswordOTPExpire: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for initials
userSchema.virtual('initials').get(function() {
  return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase();
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    console.log('Password not modified, skipping hash for:', this.email);
    return next();
  }
  // Skip if password is already hashed
  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
    console.log('Password already hashed, skipping for:', this.email);
    return next();
  }
  console.log('Hashing password for:', this.email);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  console.log('Hashed password:', this.password);
  next();
});

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
userSchema.methods.generatePasswordResetOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.resetPasswordOTP = otp;
  this.resetPasswordOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return otp;
};

// Verify password reset OTP
userSchema.methods.verifyPasswordResetOTP = function(enteredOTP) {
  if (!this.resetPasswordOTP || !this.resetPasswordOTPExpire) {
    return false;
  }
  
  if (Date.now() > this.resetPasswordOTPExpire) {
    return false;
  }
  
  return this.resetPasswordOTP === enteredOTP;
};
// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      email: this.email,
      role: this.role 
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

// Generate email OTP (6 digit)
userSchema.methods.generateEmailOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.emailOTP = otp;
  this.emailOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return otp;
};

// Verify email OTP
userSchema.methods.verifyEmailOTP = function(enteredOTP) {
  if (!this.emailOTP || !this.emailOTPExpire) {
    return false;
  }
  
  if (Date.now() > this.emailOTPExpire) {
    return false;
  }
  
  return this.emailOTP === enteredOTP;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(20).toString('hex');
  
  this.resetPasswordToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Add address
userSchema.methods.addAddress = function(addressData) {
  if (addressData.isDefault) {
    this.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }
  
  this.addresses.push(addressData);
  return this.save();
};

// Update address
userSchema.methods.updateAddress = function(addressId, addressData) {
  const addressIndex = this.addresses.findIndex(addr => 
    addr._id.toString() === addressId
  );
  
  if (addressIndex === -1) {
    throw new Error('Address not found');
  }
  
  if (addressData.isDefault) {
    this.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }
  
  Object.assign(this.addresses[addressIndex], addressData);
  return this.save();
};

// Delete address
userSchema.methods.deleteAddress = function(addressId) {
  this.addresses = this.addresses.filter(addr => 
    addr._id.toString() !== addressId
  );
  return this.save();
};

// Get default address
userSchema.methods.getDefaultAddress = function() {
  return this.addresses.find(addr => addr.isDefault) || this.addresses[0] || null;
};
userSchema.methods.updateFCMToken = async function(token, deviceId, platform) {
  // Remove old token for this device
  this.fcmTokens = this.fcmTokens.filter(t => t.deviceId !== deviceId);
  
  // Add new token
  this.fcmTokens.push({
    token,
    deviceId,
    platform,
    createdAt: new Date()
  });
  
  // Set primary token
  this.fcmToken = token;
  
  return this.save({ validateBeforeSave: false });
};

// Add method to remove FCM token
userSchema.methods.removeFCMToken = async function(deviceId) {
  this.fcmTokens = this.fcmTokens.filter(t => t.deviceId !== deviceId);
  
  // Update primary token
  if (this.fcmTokens.length > 0) {
    this.fcmToken = this.fcmTokens[0].token;
  } else {
    this.fcmToken = null;
  }
  
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', userSchema);