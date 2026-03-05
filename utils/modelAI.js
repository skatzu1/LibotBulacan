import { loadTensorflowModel } from 'react-native-fast-tflite';
import { imageToTensor } from './imageProcessor';

// Cache model globally
let model = null;

export const loadModel = async () => {
  if (model) return model;

  try {
    model = await loadTensorflowModel(
      require('../assets/AImodel/model.tflite')
    );
    console.log('✅ Model loaded successfully');
    return model;

  } catch (error) {
    console.error('❌ Model loading failed:', error);
    return null;
  }
};

export const runPrediction = async (imageUri) => {
  try {
    const loadedModel = await loadModel();
    if (!loadedModel) {
      console.error('❌ Model not loaded');
      return null;
    }

    // imageToTensor already returns a Float32Array — no conversion needed
    const inputData = await imageToTensor(imageUri);
    if (!inputData) {
      console.error('❌ Failed to process image');
      return null;
    }

    console.log('📐 Input size:', inputData.length); // should be 150528 (224*224*3)

    // Validate size
    if (inputData.length !== 224 * 224 * 3) {
      console.error('❌ Incorrect input size:', inputData.length, '(expected', 224 * 224 * 3, ')');
      return null;
    }

    // Validate no NaN in input
    if (inputData.some(isNaN)) {
      console.error('❌ NaN detected in input data');
      return null;
    }

    // Run model — fast-tflite takes an array of typed arrays
    const output = await loadedModel.run([inputData]);
    console.log('🤖 Raw model output:', output);

    if (!output || !output[0]) {
      console.error('❌ Invalid model output');
      return null;
    }

    const predictions = Array.from(output[0]);
    console.log('📊 Predictions:', predictions);

    // Validate output
    if (predictions.some(isNaN)) {
      console.error('⚠️ NaN detected in predictions');
      return null;
    }

    // For 2-class model: [C2 confidence, not-C2 confidence]
    const confidence = predictions[0];
    const otherConfidence = predictions[1];

    return {
      isC2: confidence > 0.90,
      confidence: Math.round(confidence * 100),
      notC2Confidence: Math.round(otherConfidence * 100),
    };

  } catch (error) {
    console.error('❌ Prediction error:', error);
    return null;
  }
  // ✅ No tensor.dispose() needed — Float32Array is plain JS memory, GC handles it
};