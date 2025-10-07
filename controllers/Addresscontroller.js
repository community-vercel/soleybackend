const Address = require('../models/Address');
const { validateCoordinates, calculateDistance } = require('../utils/locationUtils');

// Shop coordinates
const SHOP_LAT = 41.3995;
const SHOP_LNG = 2.1909;
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
    if (!address || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Address, latitude, and longitude are required'
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

    // Create new address
    const newAddress = new Address({
      userId: req.user._id,
      type: type || 'home',
      address,
      apartment,
      instructions,
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
    res.status(500).json({
      success: false,
      message: 'Failed to save address',
      error: error.message
    });
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
    if (type) existingAddress.type = type;
    if (address) existingAddress.address = address;
    if (apartment !== undefined) existingAddress.apartment = apartment;
    if (instructions !== undefined) existingAddress.instructions = instructions;
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

