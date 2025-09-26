// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Category name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  imageUrl: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '🍔'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to get food items count
categorySchema.virtual('itemsCount', {
  ref: 'FoodItem',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Index for better performance
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ name: 'text' });

const Category = mongoose.model('Category', categorySchema);

// models/FoodItem.js
const mealSizeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  additionalPrice: {
    type: Number,
    required: true,
    default: 0
  }
});

const extraSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  }
});

const addonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  imageUrl: {
    type: String,
    default: ''
  }
});

const nutritionSchema = new mongoose.Schema({
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
  fiber: Number,
  sugar: Number,
  sodium: Number
});

const foodItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Food item name is required'],
    trim: true,
    maxlength: [200, 'Name cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  images: [{
    url: String,
    alt: String
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  tags: [{
    type: String,
    trim: true
  }],
  isVeg: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  isGlutenFree: {
    type: Boolean,
    default: false
  },
  isNutFree: {
    type: Boolean,
    default: false
  },
  spiceLevel: {
    type: String,
    enum: ['none', 'mild', 'medium', 'hot', 'very-hot'],
    default: 'none'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  availableFrom: {
    type: Date,
    default: null
  },
  availableUntil: {
    type: Date,
    default: null
  },
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5']
    },
    count: {
      type: Number,
      default: 0
    }
  },
  nutrition: nutritionSchema,
  mealSizes: [mealSizeSchema],
  extras: [extraSchema],
  addons: [addonSchema],
  ingredients: [{
    name: String,
    optional: {
      type: Boolean,
      default: false
    }
  }],
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']
  }],
  servingSize: String,
  weight: Number, // in grams
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  stockQuantity: {
    type: Number,
    default: 0
  },
  lowStockAlert: {
    type: Number,
    default: 10
  },
  totalSold: {
    type: Number,
    default: 0
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  seoData: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for discount percentage
foodItemSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for availability status
foodItemSchema.virtual('availabilityStatus').get(function() {
  if (!this.isActive || !this.isAvailable) {
    return 'unavailable';
  }
  
  const now = new Date();
  
  if (this.availableFrom && now < this.availableFrom) {
    return 'upcoming';
  }
  
  if (this.availableUntil && now > this.availableUntil) {
    return 'expired';
  }
  
  if (this.stockQuantity <= 0) {
    return 'out-of-stock';
  }
  
  if (this.stockQuantity <= this.lowStockAlert) {
    return 'low-stock';
  }
  
  return 'available';
});

// Indexes for better performance
foodItemSchema.index({ category: 1, isActive: 1 });
foodItemSchema.index({ isFeatured: 1, isActive: 1 });
foodItemSchema.index({ isPopular: 1, isActive: 1 });
foodItemSchema.index({ name: 'text', description: 'text' });
foodItemSchema.index({ 'rating.average': -1 });
foodItemSchema.index({ price: 1 });
foodItemSchema.index({ totalSold: -1 });

// Pre-save middleware to update rating
foodItemSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = totalRating / this.reviews.length;
    this.rating.count = this.reviews.length;
  }
  next();
});

// Method to add review
foodItemSchema.methods.addReview = function(userId, rating, comment) {
  // Check if user already reviewed
  const existingReview = this.reviews.find(review => 
    review.user.toString() === userId.toString()
  );
  
  if (existingReview) {
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.createdAt = new Date();
  } else {
    this.reviews.push({
      user: userId,
      rating,
      comment
    });
  }
  
  return this.save();
};

// Method to update stock
foodItemSchema.methods.updateStock = function(quantity, operation = 'subtract') {
  if (operation === 'subtract') {
    this.stockQuantity -= quantity;
    this.totalSold += quantity;
  } else {
    this.stockQuantity += quantity;
  }
  
  // Ensure stock doesn't go negative
  if (this.stockQuantity < 0) {
    this.stockQuantity = 0;
  }
  
  return this.save();
};

// Static method to get popular items
foodItemSchema.statics.getPopularItems = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ totalSold: -1, 'rating.average': -1 })
    .limit(limit)
    .populate('category');
};

// Static method to get featured items
foodItemSchema.statics.getFeaturedItems = function(limit = 6) {
  return this.find({ isFeatured: true, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('category');
};

// Static method to search items
foodItemSchema.statics.searchItems = function(query, options = {}) {
  const {
    category,
    isVeg,
    priceMin,
    priceMax,
    rating,
    sortBy = 'relevance',
    limit = 20,
    skip = 0
  } = options;
  
  let searchQuery = { isActive: true };
  
  // Text search
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  // Category filter
  if (category) {
    searchQuery.category = category;
  }
  
  // Veg filter
  if (isVeg !== undefined) {
    searchQuery.isVeg = isVeg;
  }
  
  // Price range filter
  if (priceMin !== undefined || priceMax !== undefined) {
    searchQuery.price = {};
    if (priceMin !== undefined) searchQuery.price.$gte = priceMin;
    if (priceMax !== undefined) searchQuery.price.$lte = priceMax;
  }
  
  // Rating filter
  if (rating) {
    searchQuery['rating.average'] = { $gte: rating };
  }
  
  let sortOptions = {};
  
  // Sort options
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
      if (query) {
        sortOptions = { score: { $meta: 'textScore' } };
      } else {
        sortOptions = { 'rating.average': -1 };
      }
  }
  
  return this.find(searchQuery)
    .sort(sortOptions)
    .populate('category')
    .limit(limit)
    .skip(skip);
};

const FoodItem = mongoose.model('FoodItem', foodItemSchema);

module.exports = { FoodItem, Category };