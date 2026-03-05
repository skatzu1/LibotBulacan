import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

export const imageToTensor = async (imageUri) => {
  try {
    console.log('📷 Processing image:', imageUri);

    // Step 1: Resize to 224x224
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 224, height: 224 } }],
      { base64: true, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Step 2: Decode base64 → Uint8Array
    const binaryString = atob(resized.base64);
    const jpegBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      jpegBytes[i] = binaryString.charCodeAt(i);
    }

    // Step 3: Decode JPEG → raw RGBA pixels
    const { data: rgbaPixels } = decodeJpeg(jpegBytes, { useTArray: true });

    // Step 4: Convert RGBA → RGB Float32 normalized to [-1, 1]
    const pixelCount = 224 * 224;
    const floatData = new Float32Array(pixelCount * 3);

    for (let i = 0; i < pixelCount; i++) {
      floatData[i * 3 + 0] = (rgbaPixels[i * 4 + 0] / 127.5) - 1.0; // R
      floatData[i * 3 + 1] = (rgbaPixels[i * 4 + 1] / 127.5) - 1.0; // G
      floatData[i * 3 + 2] = (rgbaPixels[i * 4 + 2] / 127.5) - 1.0; // B
      // Skip alpha channel [i * 4 + 3]
    }

    console.log('✅ Tensor ready, size:', floatData.length); // 150528
    return floatData;

  } catch (error) {
    console.error('❌ Image processing error:', error);
    return null;
  }
};