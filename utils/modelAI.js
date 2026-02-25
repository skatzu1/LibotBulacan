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
  let tensor = null;
  try {
    const loadedModel = await loadModel();
    if (!loadedModel) {
      console.error('❌ Model not loaded');
      return null;
    }

    // Convert image to tensor
    tensor = await imageToTensor(imageUri);
    if (!tensor) {
      console.error('❌ Failed to process image');
      return null;
    }

    // Get raw data as Float32Array (required by fast-tflite)
    const inputData = new Float32Array(tensor.dataSync());

    console.log('📐 Input size:', inputData.length); // should be 150528 (1*224*224*3)

    // Validate size
    if (inputData.length !== 224 * 224 * 3) {
      console.error('❌ Incorrect tensor size:', inputData.length, '(expected', 224 * 224 * 3, ')');
      return null;
    }

    // Validate no NaN in input
    if (inputData.some(isNaN)) {
      console.error('❌ NaN detected in input data');
      return null;
    }

    // Run model
    const output = await loadedModel.run([inputData]);
    console.log('🤖 Raw model output:', output);

    if (!output || !output[0]) {
      console.error('❌ Invalid model output');
      return null;
    }

    const predictions = Array.from(output[0]); // convert to plain array
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
  } finally {
    if (tensor) tensor.dispose();  // always clean up
  }
};