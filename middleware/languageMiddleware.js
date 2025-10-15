// ============================================
// BACKEND FIX: middleware/languageMiddleware.js
// ============================================
// CRITICAL: The problem is that localizeResponse is converting
// multilingual objects into single strings, which breaks Flutter parsing

const supportedLanguages = ['en', 'es', 'ca', 'ar'];
const defaultLanguage = 'en';

/**
 * Middleware to detect and set the user's preferred language
 */
const detectLanguage = (req, res, next) => {
  let language = defaultLanguage;
  
  // Priority order for language detection
  // 1. Query parameter (?lang=es)
  if (req.query.lang && supportedLanguages.includes(req.query.lang)) {
    language = req.query.lang;
  }
  // 2. X-Language custom header (RECOMMENDED for mobile apps)
  else if (req.headers['x-language'] && supportedLanguages.includes(req.headers['x-language'])) {
    language = req.headers['x-language'];
  }
  // 3. Accept-Language header
  else if (req.headers['accept-language']) {
    const headerLang = req.headers['accept-language'].split(',')[0].split('-')[0];
    if (supportedLanguages.includes(headerLang)) {
      language = headerLang;
    }
  }
  // 4. User preference from auth token (if authenticated)
  else if (req.user && req.user.preferredLanguage && supportedLanguages.includes(req.user.preferredLanguage)) {
    language = req.user.preferredLanguage;
  }
  
  // CRITICAL: Set language on request object
  req.language = language;
  
  // Set language in response header
  res.setHeader('Content-Language', language);
  
  console.log(`🌍 Language detected: ${language} from ${req.path}`);
  
  next();
};

/**
 * Helper to check if object is a multilingual text object
 */
const isMultilingualObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return keys.some(key => supportedLanguages.includes(key));
};

/**
 * CRITICAL FIX: Return FULL multilingual object, not just one language
 * This allows Flutter to parse all languages and choose locally
 */
const preserveMultilingualFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle Mongoose documents
  const plainObj = obj._doc || obj;
  const result = {};
  
  for (const key in plainObj) {
    const value = plainObj[key];
    
    // Skip internal MongoDB fields
    if (key === '__v' || key === '_id') {
      result[key] = value;
      continue;
    }
    
    // Preserve multilingual objects AS IS (don't localize)
    if (isMultilingualObject(value)) {
      result[key] = {
        en: value.en || '',
        es: value.es || '',
        ca: value.ca || '',
        ar: value.ar || ''
      };
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      result[key] = value.map(item => preserveMultilingualFields(item));
    }
    // Handle nested objects (but not Mongoose special objects)
    else if (value && typeof value === 'object' && value.constructor.name === 'Object') {
      result[key] = preserveMultilingualFields(value);
    }
    // Keep everything else as is
    else {
      result[key] = value;
    }
  }
  
  return result;
};

/**
 * UPDATED: Response wrapper that preserves multilingual data
 * This is the KEY FIX - don't localize server-side, send all languages
 */
const localizeResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    if (!data || !data.success) {
      return originalJson(data);
    }
    
    console.log(`📦 Localizing response for language: ${req.language}`);
    
    // Process single item
    if (data.item) {
      // If item has getLocalized method, use it to get the localized version
      // BUT also include the full multilingual data
      if (typeof data.item.getLocalized === 'function') {
        const localized = data.item.getLocalized(req.language);
        // Send BOTH localized data AND full multilingual data
        data.item = {
          ...localized,
          _multilingual: preserveMultilingualFields(data.item)
        };
      } else {
        data.item = preserveMultilingualFields(data.item);
      }
    }
    
    // Process array of items
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(item => {
        if (typeof item.getLocalized === 'function') {
          return {
            ...item.getLocalized(req.language),
            _multilingual: preserveMultilingualFields(item)
          };
        }
        return preserveMultilingualFields(item);
      });
    }
    
    // Process single category
    if (data.category) {
      if (typeof data.category.getLocalized === 'function') {
        data.category = {
          ...data.category.getLocalized(req.language),
          _multilingual: preserveMultilingualFields(data.category)
        };
      } else {
        data.category = preserveMultilingualFields(data.category);
      }
    }
    
    // Process array of categories
    if (data.categories && Array.isArray(data.categories)) {
      data.categories = data.categories.map(cat => {
        if (typeof cat.getLocalized === 'function') {
          return {
            ...cat.getLocalized(req.language),
            _multilingual: preserveMultilingualFields(cat)
          };
        }
        return preserveMultilingualFields(cat);
      });
    }
    
    // Process orders
    if (data.order) {
      data.order = preserveMultilingualFields(data.order);
    }
    if (data.orders && Array.isArray(data.orders)) {
      data.orders = data.orders.map(order => preserveMultilingualFields(order));
    }
    
    // Include language info in response
    data.language = req.language;
    data.availableLanguages = supportedLanguages;
    
    return originalJson(data);
  };
  
  next();
};

module.exports = {
  detectLanguage,
  localizeResponse,
  preserveMultilingualFields,
  supportedLanguages,
  defaultLanguage
};
