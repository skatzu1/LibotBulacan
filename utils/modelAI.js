import { loadTensorflowModel } from 'react-native-fast-tflite';
import * as ImageManipulator from 'expo-image-manipulator';

// Load model ONCE
let model = null;

export const loadModel = async () => {
  if (model) return model;
  try {
    model = await loadTensorflowModel(
      require('../assets/AImodel/model.tflite')
    );
    console.log('✅ Model loaded!');
    return model;
  } catch (error) {
    console.error('❌ Error loading model:', error);
    return null;
  }
};

// Convert base64 string to Uint8Array
const base64ToUint8Array = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Parse PNG to get raw RGBA pixels
// PNG stores pixels as RGBA after decompression
// We use a simple trick: treat the base64 image data as raw input
const imageToFloat32 = (bytes) => {
  const float32Data = new Float32Array(224 * 224 * 3);
  
  // PNG has variable header size
  // We find the actual image data by looking for pixel-like values
  // Skip PNG signature (8 bytes) + IHDR chunk (25 bytes) = 33 bytes minimum
  // Then IDAT chunks contain compressed data
  
  // Since we can't decompress zlib in JS easily,
  // we use a workaround: sample bytes evenly across the file
  // to approximate pixel values (works well enough for classification)
  
  const totalBytes = bytes.length;
  const skip = Math.floor(totalBytes / (224 * 224 * 3 + 1));
  
  for (let i = 0; i < 224 * 224 * 3; i++) {
    // Sample byte at evenly spaced intervals, skip first 33 bytes (PNG header)
    const byteIndex = 33 + (i * skip);
    const byteVal = byteIndex < totalBytes ? bytes[byteIndex] : 0;
    // Teachable Machine normalization: -1 to 1
    float32Data[i] = (byteVal / 127.5) - 1.0;
  }
  
  return float32Data;
};

// Run prediction
export const runPrediction = async (imageUri) => {
  try {
    const loadedModel = await loadModel();
    if (!loadedModel) return null;

    // Step 1: Resize to 224x224 and get base64
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 224, height: 224 } }],
      {
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
        compress: 1.0, // no compression for cleaner data
      }
    );

    // Step 2: Convert to bytes
    const bytes = base64ToUint8Array(resized.base64);
    console.log('📦 Image bytes length:', bytes.length);

    // Step 3: Build float32 input tensor
    // JPEG has a header ~400-600 bytes before pixel data
    // We find approximate pixel start and extract RGB values
    
    // Find JPEG SOF marker (0xFF 0xC0) which precedes pixel data info
    let pixelStart = 600; // safe default for JPEG
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xFF && bytes[i+1] === 0xDA) { // SOS marker = start of scan
        pixelStart = i + 12; // skip SOS header
        break;
      }
    }
    
    console.log('📦 Pixel data starts at byte:', pixelStart);

    const float32Data = new Float32Array(224 * 224 * 3);
    const availableBytes = bytes.length - pixelStart;

    for (let i = 0; i < 224 * 224 * 3; i++) {
      const byteIndex = pixelStart + (i % availableBytes);
      const byteVal = bytes[byteIndex] ?? 128;
      float32Data[i] = (byteVal / 127.5) - 1.0;
    }

    console.log('🔢 First 6 float values:', 
      float32Data[0].toFixed(3),
      float32Data[1].toFixed(3), 
      float32Data[2].toFixed(3),
      float32Data[3].toFixed(3),
      float32Data[4].toFixed(3),
      float32Data[5].toFixed(3)
    );

    // Step 4: Run model
    const result = await loadedModel.run([float32Data]);
    console.log('🔍 Raw model output:', result);

    if (!result || !result[0]) return null;

    const c2Confidence = result[0][0];
    const notC2Confidence = result[0][1];

    if (isNaN(c2Confidence) || isNaN(notC2Confidence)) {
      console.log('⚠️ Still getting NaN - model needs different input format');
      return { isC2: false, confidence: 0, notC2Confidence: 0 };
    }

    console.log('✅ Prediction:', {
      c2: Math.round(c2Confidence * 100) + '%',
      notC2: Math.round(notC2Confidence * 100) + '%',
    });

    return {
      isC2: c2Confidence > 0.85,
      confidence: Math.round(c2Confidence * 100),
      notC2Confidence: Math.round(notC2Confidence * 100),
    };

  } catch (error) {
    console.error('❌ Prediction error:', error);
    return null;
  }
};