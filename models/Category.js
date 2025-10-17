// models/Category.js
const mongoose = require('mongoose');
const multilingualTextSchema = new mongoose.Schema({
  en: { type: String, required: true }, // English (required as default)
  es: { type: String, default: '' },    // Spanish (Español)
  ca: { type: String, default: '' },    // Catalan (Català)
  ar: { type: String, default: '' }     // Arabic (العربية)
}, { _id: false });

const categorySchema = new mongoose.Schema({
name: {
    type: multilingualTextSchema,
    required: [true, 'Category name is required']
  },
  description: {
    type: multilingualTextSchema
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

categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ 'name.en': 'text', 'name.es': 'text', 'name.ca': 'text', 'name.ar': 'text' });

// Method to get localized data
categorySchema.methods.getLocalized = function(lang = 'en') {
  const validLangs = ['en', 'es', 'ca', 'ar'];
  const selectedLang = validLangs.includes(lang) ? lang : 'en';
  
  return {
    _id: this._id,
    name: this.name[selectedLang] || this.name.en,
    description: this.description ? (this.description[selectedLang] || this.description.en) : '',
    imageUrl: this.imageUrl,
    icon: this.icon,
    isActive: this.isActive,
    sortOrder: this.sortOrder,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Category = mongoose.model('Category', categorySchema);

// models/FoodItem.js
const mealSizeSchema = new mongoose.Schema({
  name: {
    type: multilingualTextSchema,
    required: true
  },
  additionalPrice: {
    type: Number,
    required: true,
    default: 0
  }
}, { _id: false });

const extraSchema = new mongoose.Schema({
  name: {
    type: multilingualTextSchema,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  }
}, { _id: false });

const addonSchema = new mongoose.Schema({
  name: {
    type: multilingualTextSchema,
    required: true
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
}, { _id: false });

const nutritionSchema = new mongoose.Schema({
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
  fiber: Number,
  sugar: Number,
  sodium: Number
}, { _id: false });

const ingredientSchema = new mongoose.Schema({
  name: {
    type: multilingualTextSchema,
    required: true
  },
  optional: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const foodItemSchema = new mongoose.Schema({
  name: {
    type: multilingualTextSchema,
    required: [true, 'Food item name is required']
  },
  description: {
    type: multilingualTextSchema,
    required: [true, 'Description is required']
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
    alt: {
      type: multilingualTextSchema
    }
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  tags: [{
    type: multilingualTextSchema
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
    type: Number,
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
  ingredients: [ingredientSchema],
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']
  }],
  servingSize: String,
  weight: Number,
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
    metaTitle: {
      type: multilingualTextSchema
    },
    metaDescription: {
      type: multilingualTextSchema
    },
    keywords: [{
      type: multilingualTextSchema
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Method to get localized data
// Fixed getLocalized method for FoodItem schema

foodItemSchema.methods.getLocalized = function (lang = 'en') {
  const validLangs = ['en', 'es', 'ca', 'ar'];
  const selectedLang = validLangs.includes(lang) ? lang : 'en';

  // Helper function to extract the correct language from multilingual field
  const extractLang = (field) => {
    if (!field) return '';
    
    // If it's already a string (legacy data), return it
    if (typeof field === 'string') {
      return field;
    }
    
    // If it's an object (multilingual), get the requested language
    if (typeof field === 'object') {
      // Return requested language, with fallback order
      return field[selectedLang] || field['en'] || field['es'] || field['ca'] || field['ar'] || '';
    }
    
    return '';
  };

  return {
    _id: this._id,
    name: extractLang(this.name),
    description: extractLang(this.description),
    price: this.price,
    originalPrice: this.originalPrice,
    imageUrl: this.imageUrl,
    images: this.images.map(img => ({
      url: img.url,
      alt: extractLang(img.alt)
    })),
    category: this.category ? {
      _id: this.category._id,
      name: extractLang(this.category.name),
      icon: this.category.icon,
      id: this.category.id
    } : null,
    tags: this.tags.map(tag => extractLang(tag)),
    isVeg: this.isVeg,
    isVegan: this.isVegan,
    isGlutenFree: this.isGlutenFree,
    isNutFree: this.isNutFree,
    spiceLevel: this.spiceLevel,
    isFeatured: this.isFeatured,
    isPopular: this.isPopular,
    isActive: this.isActive,
    isAvailable: this.isAvailable,
    availableFrom: this.availableFrom,
    availableUntil: this.availableUntil,
    preparationTime: this.preparationTime,
    rating: this.rating,
    nutrition: this.nutrition,
    mealSizes: this.mealSizes.map(size => ({
      name: extractLang(size.name),
      additionalPrice: size.additionalPrice
    })),
    extras: this.extras.map(extra => ({
      name: extractLang(extra.name),
      price: extra.price
    })),
    addons: this.addons.map(addon => ({
      name: extractLang(addon.name),
      price: addon.price,
      imageUrl: addon.imageUrl
    })),
    ingredients: this.ingredients.map(ingredient => ({
      name: extractLang(ingredient.name),
      optional: ingredient.optional
    })),
    allergens: this.allergens,
    servingSize: this.servingSize,
    weight: this.weight,
    sku: this.sku,
    barcode: this.barcode,
    stockQuantity: this.stockQuantity,
    lowStockAlert: this.lowStockAlert,
    totalSold: this.totalSold,
    reviews: this.reviews || [],
    discountPercentage: this.discountPercentage,
    availabilityStatus: this.availabilityStatus,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    seoData: {
      metaTitle: extractLang(this.seoData?.metaTitle),
      metaDescription: extractLang(this.seoData?.metaDescription),
      keywords: this.seoData?.keywords?.map(keyword => extractLang(keyword)) || []
    }
  };
};
// Virtual for discount percentage
foodItemSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for availability status
foodItemSchema.virtual('availabilityStatus').get(function() {
  if (!this.isActive || !this.isAvailable) return 'unavailable';
  const now = new Date();
  if (this.availableFrom && now < this.availableFrom) return 'upcoming';
  if (this.availableUntil && now > this.availableUntil) return 'expired';
  if (this.stockQuantity <= 0) return 'out-of-stock';
  if (this.stockQuantity <= this.lowStockAlert) return 'low-stock';
  return 'available';
});

// Indexes for better performance
foodItemSchema.index({ category: 1, isActive: 1 });
foodItemSchema.index({ isFeatured: 1, isActive: 1 });
foodItemSchema.index({ isPopular: 1, isActive: 1 });
foodItemSchema.index({ 
  'name.en': 'text', 
  'name.es': 'text', 
  'name.ca': 'text', 
  'name.ar': 'text',
  'description.en': 'text',
  'description.es': 'text',
  'description.ca': 'text',
  'description.ar': 'text'
});

// Existing methods remain the same...
foodItemSchema.methods.addReview = function(userId, rating, comment) {
  const existingReview = this.reviews.find(review => 
    review.user.toString() === userId.toString()
  );
  
  if (existingReview) {
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.createdAt = new Date();
  } else {
    this.reviews.push({ user: userId, rating, comment });
  }
  
  return this.save();
};

foodItemSchema.methods.updateStock = function(quantity, operation = 'subtract') {
  if (operation === 'subtract') {
    this.stockQuantity -= quantity;
    this.totalSold += quantity;
  } else {
    this.stockQuantity += quantity;
  }
  
  if (this.stockQuantity < 0) this.stockQuantity = 0;
  return this.save();
};

const FoodItem = mongoose.model('FoodItem', foodItemSchema);

module.exports = { FoodItem, Category };