
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/Addresscontroller');


router.get('/', addressController.getSavedAddresses);
router.post('/', addressController.saveAddress);
router.put('/:addressId', addressController.updateAddress);
router.delete('/:addressId', addressController.deleteAddress);
router.patch('/:addressId/default', addressController.setDefaultAddress);
router.post('/validate', addressController.validateAddress);
router.get('/autocomplete', async (req, res) => {
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

    // Forward Google response to frontend
    res.json(data);
  } catch (error) {
    console.error('Error fetching Google API:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});
module.exports = router;