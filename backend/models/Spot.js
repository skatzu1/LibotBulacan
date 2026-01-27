import mongoose from "mongoose";

const SpotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
});

const Spot = mongoose.model("Spot", SpotSchema);

export default Spot;
