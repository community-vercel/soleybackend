// middleware/languageMiddleware.js

const supportedLanguages = ['en', 'es', 'ca', 'ar'];
const defaultLanguage = 'en';

/**
 * Middleware to detect and set the user's preferred language
 * Checks in order: query param, header, user preference, default
 */
const detectLanguage = (req, res, next) => {
  let language = defaultLanguage;
  
  // 1. Check query parameter (?lang=es)
  if (req.query.lang && supportedLanguages.includes(req.query.lang)) {
    language = req.query.lang;
  }
  // 2. Check Accept-Language header
  else if (req.headers['accept-language']) {
    const headerLang = req.headers['accept-language'].split(',')[0].split('-')[0];
    if (supportedLanguages.includes(headerLang)) {
      language = headerLang;
    }
  }
  // 3. Check X-Language custom header (recommended for mobile apps)
  else if (req.headers['x-language'] && supportedLanguages.includes(req.headers['x-language'])) {
    language = req.headers['x-language'];
  }
  // 4. Check user preference from auth token (if authenticated)
  else if (req.user && req.user.preferredLanguage && supportedLanguages.includes(req.user.preferredLanguage)) {
    language = req.user.preferredLanguage;
  }
  
  // Set language on request object
  req.language = language;
  
  // Set language in response header for client reference
  res.setHeader('Content-Language', language);
  
  next();
};

/**
 * Helper function to get localized field value
 */
const getLocalizedField = (field, language = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[language] || field.en || '';
};

/**
 * Helper function to localize an entire object
 */
const localizeObject = (obj, language = 'en') => {
  if (!obj) return null;
  
  const localized = {};
  
  for (const key in obj) {
    const value = obj[key];
    
    // Skip if value is null or undefined
    if (value === null || value === undefined) {
      localized[key] = value;
      continue;
    }
    
    // If it's a multilingual object (has en, es, ca, ar keys)
    if (typeof value === 'object' && 
        !Array.isArray(value) && 
        ('en' in value || 'es' in value || 'ca' in value || 'ar' in value)) {
      localized[key] = value[language] || value.en || '';
    }
    // If it's an array, localize each item
    else if (Array.isArray(value)) {
      localized[key] = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return localizeObject(item, language);
        }
        return item;
      });
    }
    // If it's a nested object, recurse
    else if (typeof value === 'object' && value !== null) {
      localized[key] = localizeObject(value, language);
    }
    // Otherwise, keep as is
    else {
      localized[key] = value;
    }
  }
  
  return localized;
};

/**
 * Response wrapper that automatically localizes data
 */
const localizeResponse = (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json method
  res.json = function(data) {
    // Only localize if success is true and items/data exists
    if (data && data.success && req.language !== 'en') {
      // Localize single item
      if (data.item && typeof data.item.getLocalized === 'function') {
        data.item = data.item.getLocalized(req.language);
      }
      // Localize array of items
      else if (data.items && Array.isArray(data.items)) {
        data.items = data.items.map(item => 
          typeof item.getLocalized === 'function' 
            ? item.getLocalized(req.language)
            : localizeObject(item._doc || item, req.language)
        );
      }
      // Localize single category
      else if (data.category && typeof data.category.getLocalized === 'function') {
        data.category = data.category.getLocalized(req.language);
      }
      // Localize array of categories
      else if (data.categories && Array.isArray(data.categories)) {
        data.categories = data.categories.map(cat => 
          typeof cat.getLocalized === 'function'
            ? cat.getLocalized(req.language)
            : localizeObject(cat._doc || cat, req.language)
        );
      }
      // Localize orders (for items in orders)
      else if (data.order && data.order.items) {
        data.order = localizeObject(data.order._doc || data.order, req.language);
      }
      else if (data.orders && Array.isArray(data.orders)) {
        data.orders = data.orders.map(order => 
          localizeObject(order._doc || order, req.language)
        );
      }
    }
    
    // Call original json method
    return originalJson(data);
  };
  
  next();
};

module.exports = {
  detectLanguage,
  localizeResponse,
  getLocalizedField,
  localizeObject,
  supportedLanguages,
  defaultLanguage
};