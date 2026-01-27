import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Spot from "./models/Spot.js"

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

app.get("/api/spots", async (req, res) => {
  try {
    const spots = await Spot.find();
    res.json(spots); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/* 
Example in Dataabse

db.spots.insertMany([
  {
    name: "Beautiful Beach",
    description: "A beach with crystal-clear water...",
    image: "https://example.com/beach.jpg",
    coordinates: { lat: 10.123, lng: 123.456 }
  },
  {
    name: "Historic Museum",
    description: "A museum with ancient artifacts.",
    image: "https://example.com/museum.jpg",
    coordinates: { lat: 10.567, lng: 123.890 }
  }
]);
*/



/*
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
*/