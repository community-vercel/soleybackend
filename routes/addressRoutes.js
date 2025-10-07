
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/Addresscontroller');
const { auth, authorize } = require('../middleware/auth');


router.get('/', auth,addressController.getSavedAddresses);
router.post('/',auth, addressController.saveAddress);
router.put('/:addressId',auth, addressController.updateAddress);
router.delete('/:addressId',auth ,addressController.deleteAddress);
router.patch('/:addressId/default', auth,addressController.setDefaultAddress);
router.post('/validate',auth, addressController.validateAddress);
router.get('/autocomplete',auth, addressController.getAddressAutocomplete);

router.get('/place-details',auth, addressController.getPlaceDetails);
module.exports = router;