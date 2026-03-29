const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config();

const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI,{
  useNewUrlParser:true,
  useUnifiedTopology:true
}).then(()=>console.log('MongoDB connected'))
  .catch(err=>console.log(err));

const transporter = nodemailer.createTransport({
  service:'gmail',
  auth:{
    user:process.env.EMAIL,
    pass:process.env.APP_PASSWORD
  }
});

// ===== REGISTER =====
app.post('/register', async (req,res)=>{
  const {email,password,role} = req.body;
  const hashed = await bcrypt.hash(password,10);
  const user = new User({email,password:hashed,role});
  await user.save();
  res.json({message:'Registered'});
});

// ===== LOGIN =====
app.post('/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.status(400).send('No user found');
  const ok = await bcrypt.compare(password,user.password);
  if(!ok) return res.status(400).send('Wrong password');

  const token = jwt.sign({id:user._id,role:user.role}, process.env.JWT_SECRET);
  res.json({token,role:user.role});
});

// ===== FORGOT PASSWORD =====
app.post('/forgot', async (req,res)=>{
  const {email} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.status(400).send('User not found');

  const code = Math.floor(100000 + Math.random()*900000).toString();
  user.resetCode = code;
  await user.save();

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: 'Password Reset Code',
    text: `Your reset code is ${code}`
  });

  res.json({message:'Code sent'});
});

app.post('/reset', async (req,res)=>{
  const {email,code,newPassword} = req.body;
  const user = await User.findOne({email});
  if(user.resetCode !== code) return res.status(400).send('Invalid code');

  user.password = await bcrypt.hash(newPassword,10);
  user.resetCode = null;
  await user.save();

  res.json({message:'Password reset'});
});

// ===== PRODUCTS =====
app.post('/add-product', async (req,res)=>{
  const {name,price,image,vendorId} = req.body;
  const product = new Product({name,price,image,vendorId});
  await product.save();
  res.json(product);
});

app.get('/products', async (req,res)=>{
  const products = await Product.find();
  res.json(products);
});

// ===== ORDERS + SMS + VENDOR WALLET =====
app.post('/order', async (req,res)=>{
  const {userId,products,total,phone} = req.body;
  const order = new Order({userId,products,total,phone});
  await order.save();

  // Credit vendors (90%)
  for(const p of products){
    const vendor = await User.findById(p.vendorId);
    if(vendor){
      vendor.wallet = (vendor.wallet||0) + p.price*0.9;
      await vendor.save();
    }
  }

  // SMS Notification (Termii)
  try{
    await axios.post('https://api.ng.termii.com/api/sms/send',{
      to: phone,
      from:'N-Alert',
      sms:`Order received. Total ₦${total}`,
      type:'plain',
      channel:'generic',
      api_key: process.env.TERMI_API_KEY
    });
  }catch(err){
    console.log('SMS failed:', err.message);
  }

  res.json({message:'Order placed'});
});

// ===== ADMIN =====
app.get('/admin/orders', async (req,res)=>{
  const orders = await Order.find();
  res.json(orders);
});

app.get('/admin/users', async (req,res)=>{
  const users = await User.find();
  res.json(users);
});

// ===== VENDOR WITHDRAW =====
app.post('/vendor/withdraw', async (req,res)=>{
  const {vendorId} = req.body;
  const vendor = await User.findById(vendorId);
  if(!vendor) return res.status(400).send('Vendor not found');

  const amount = vendor.wallet || 0;
  vendor.wallet = 0;
  await vendor.save();

  res.json({message:`Withdrawn ₦${amount}`});
});

app.listen(process.env.PORT || 5000, ()=>console.log('Backend running'));
