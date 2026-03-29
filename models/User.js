const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: { type: String, default: 'customer' },
  resetCode: String,
  wallet: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
