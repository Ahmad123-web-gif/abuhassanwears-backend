const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  vendorId: String
});

module.exports = mongoose.model('Product', productSchema);
