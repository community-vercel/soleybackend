// routes/bannerRoutes.js
const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// Public routes (for Flutter app)
router.get('/active', bannerController.getActiveBanners);

// Admin routes (add authentication middleware as needed)
router.get('/getall', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);
router.post('/', bannerController.createBanner);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);
router.patch('/:id/toggle-status', bannerController.toggleBannerStatus);
router.post('/reorder', bannerController.reorderBanners);

module.exports = router;