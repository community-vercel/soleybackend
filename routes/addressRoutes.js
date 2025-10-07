
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/Addresscontroller');


router.get('/', addressController.getSavedAddresses);
router.post('/', addressController.saveAddress);
router.put('/:addressId', addressController.updateAddress);
router.delete('/:addressId', addressController.deleteAddress);
router.patch('/:addressId/default', addressController.setDefaultAddress);
router.post('/validate', addressController.validateAddress);

module.exports = router;