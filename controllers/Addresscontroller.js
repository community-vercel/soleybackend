const Address = require('../models/Address');
const { validateCoordinates, calculateDistance } = require('../utils/locationUtils');
const fetch = require('node-fetch');

// Shop coordinates
const SHOP_LAT =41.403661;
const SHOP_LNG = 2.198579;
const MAX_DELIVERY_DISTANCE = 6; // km

// Get all saved addresses for user
exports.getSavedAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id || req.user.userId || req.user.id })
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    console.error('Get saved addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve addresses',
      error: error.message
    });
  }
};

// Save/Create new address
exports.saveAddress = async (req, res) => {
  try {
    const { type, address, apartment, instructions, latitude, longitude, isDefault } = req.body;

    // Validate required fields
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    if (!apartment) {
      return res.status(400).json({
        success: false,
        message: 'Apartment/House number is required'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }

    // Validate coordinates
    if (!validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    // Calculate distance from shop
    const distance = calculateDistance(SHOP_LAT, SHOP_LNG, latitude, longitude);

    if (distance > MAX_DELIVERY_DISTANCE) {
      return res.status(400).json({
        success: false,
        message: `Address is beyond our ${MAX_DELIVERY_DISTANCE}km delivery range`,
        distance: distance.toFixed(1)
      });
    }

    // Normalize type to match enum values
    const normalizedType = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Home';

    // Create new address
    const newAddress = new Address({
      userId: req.user._id || req.user.userId || req.user.id,
      type: normalizedType,
      address: address.trim(),
      apartment: apartment.trim(),
      instructions: instructions ? instructions.trim() : undefined,
      latitude,
      longitude,
      isDefault: isDefault || false
    });

    await newAddress.save();

    res.status(201).json({
      success: true,
      message: 'Address saved successfully',
      data: newAddress,
      distance: distance.toFixed(1)
    });
  } catch (error) {
    console.error('Save address error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to save address',
      error: error.message
    });
  }
};

// Get place details from Google API
exports.getPlaceDetails = async (req, res) => {
  try {
    const placeId = req.query.place_id;
    if (!placeId) {
      return res.status(400).json({ error: 'Missing place_id parameter' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&key=${process.env.GOOGLE_API_KEY}&fields=geometry`;

    const response = await fetch(url);
    const data = await response.json();
    console.log('Google Place Details response:', data);

    if (data.status !== 'OK') {
      return res.status(400).json({ error: data.error_message || 'Failed to fetch place details' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
};

// Get address autocomplete from Google API
exports.getAddressAutocomplete = async (req, res) => {
  try {
    const input = req.query.input;

    if (!input) {
      return res.status(400).json({ error: 'Missing input parameter' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&key=${process.env.GOOGLE_API_KEY}&language=en&components=country:es`;

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Error fetching Google API:', error);
    res.status(500).json({ error: 'Failed to fetch autocomplete data' });
  }
};

// Update existing address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { type, address, apartment, instructions, latitude, longitude, isDefault } = req.body;

    // Find address
    const existingAddress = await Address.findOne({
      _id: addressId,
      userId: req.user._id
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Validate apartment if provided
    if (apartment !== undefined && !apartment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Apartment/House number cannot be empty'
      });
    }

    // If coordinates are being updated, validate and check distance
    if (latitude && longitude) {
      if (!validateCoordinates(latitude, longitude)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates'
        });
      }

      const distance = calculateDistance(SHOP_LAT, SHOP_LNG, latitude, longitude);
      
      if (distance > MAX_DELIVERY_DISTANCE) {
        return res.status(400).json({
          success: false,
          message: `Address is beyond our ${MAX_DELIVERY_DISTANCE}km delivery range`,
          distance: distance.toFixed(1)
        });
      }
    }

    // Update fields
    if (type) {
      const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      existingAddress.type = normalizedType;
    }
    if (address) existingAddress.address = address.trim();
    if (apartment !== undefined) existingAddress.apartment = apartment.trim();
    if (instructions !== undefined) existingAddress.instructions = instructions.trim();
    if (latitude) existingAddress.latitude = latitude;
    if (longitude) existingAddress.longitude = longitude;
    if (isDefault !== undefined) existingAddress.isDefault = isDefault;

    await existingAddress.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: existingAddress
    });
  } catch (error) {
    console.error('Update address error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update address',
      error: error.message
    });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const address = await Address.findOneAndDelete({
      _id: addressId,
      userId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ userId: req.user._id });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message
    });
  }
};

// Set default address
exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const address = await Address.findOne({
      _id: addressId,
      userId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Remove default from all other addresses
    await Address.updateMany(
      { userId: req.user._id },
      { $set: { isDefault: false } }
    );

    // Set this address as default
    address.isDefault = true;
    await address.save();

    res.json({
      success: true,
      message: 'Default address updated',
      data: address
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address',
      error: error.message
    });
  }
};

// Validate address distance
exports.validateAddress = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const distance = calculateDistance(SHOP_LAT, SHOP_LNG, latitude, longitude);
    const canDeliver = distance <= MAX_DELIVERY_DISTANCE;

    res.json({
      success: true,
      data: {
        distance: distance.toFixed(1),
        canDeliver,
        maxDistance: MAX_DELIVERY_DISTANCE
      }
    });
  } catch (error) {
    console.error('Validate address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate address',
      error: error.message
    });
  }
};