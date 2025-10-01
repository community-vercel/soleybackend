// controllers/bannerController.js
const Banner = require('../models/Banner');

// Get all active banners (for public/Flutter app)
exports.getActiveBanners = async (req, res) => {
  try {
    const { category } = req.query;
    const banners = await Banner.getActiveBanners(category);
    
    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active banners',
      error: error.message
    });
  }
};

// Get all banners (admin only)
exports.getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, isActive } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const banners = await Banner.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Banner.countDocuments(query);

    res.status(200).json({
      success: true,
      data: banners,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching banners',
      error: error.message
    });
  }
};

// Get single banner by ID
exports.getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching banner',
      error: error.message
    });
  }
};

// Create new banner
exports.createBanner = async (req, res) => {
  try {
    const banner = await Banner.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating banner',
      error: error.message
    });
  }
};

// Update banner
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating banner',
      error: error.message
    });
  }
};

// Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting banner',
      error: error.message
    });
  }
};

// Toggle banner active status
exports.toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
      data: banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling banner status',
      error: error.message
    });
  }
};

// Reorder banners
exports.reorderBanners = async (req, res) => {
  try {
    const { bannerOrders } = req.body; // Array of { id, order }

    const updatePromises = bannerOrders.map(({ id, order }) =>
      Banner.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Banners reordered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reordering banners',
      error: error.message
    });
  }
};