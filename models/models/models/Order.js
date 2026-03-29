const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: String,
  products: Array,
  total: Number,
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
