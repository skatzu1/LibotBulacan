require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

// Set DNS to use Google's servers
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoURI = 'mongodb+srv://jasper:libot@cluster0.avsb8nx.mongodb.net/libot_db?retryWrites=true&w=majority';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Error:', err.message));

const app = require('express')();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));