const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactcontroller');
const { auth, authorize, optionalAuth } = require('../middleware/auth');

// ✅ Public route — Submit contact form
router.post('/', contactController.submitContactForm);


// Get all contact messages (with pagination, search, and filters)
router.get('/',auth,
  authorize('admin', 'manager'), contactController.getAllContacts);

// Get contact stats
router.get('/stats',auth,
  authorize('admin', 'manager'), contactController.getContactStats);

// Get a single contact by ID
router.get('/:id',auth,
  authorize('admin', 'manager'), contactController.getContactById);

// Update contact status
router.put('/:id/status',auth,
  authorize('admin', 'manager'), contactController.updateContactStatus);

// Reply to a contact message
router.post('/:id/reply',auth,
  authorize('admin', 'manager'), contactController.replyToContact);

// Delete a contact
router.delete('/:id',auth,
  authorize('admin', 'manager'), contactController.deleteContact);

module.exports = router;
