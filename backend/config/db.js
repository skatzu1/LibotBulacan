// backend/config/db.js
const mongoose = require('mongoose');
require('dotenv').config(); // load .env

const connectDB = async () => {
  const URL ='mongodb+srv://jasper:libot@cluster0.llz6l4v.mongodb.net/libot_db?retryWrites=true&w=majority&ssl=true';
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected ✅');
  } catch (err) {
    console.error('MongoDB connection failed ❌', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;