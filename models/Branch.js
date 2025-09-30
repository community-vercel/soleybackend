const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    default: 'saborly_main',
    index: true
  },
  address: {
    type: String,
    required: true,
    trim: true,
    default: 'Saborly, C/ de Pere IV, 208, Sant Martí, 08005 Barcelona, Spain',
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    default: '+34932112072',
    unique: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
