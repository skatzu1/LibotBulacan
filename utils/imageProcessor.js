import '@tensorflow/tfjs-react-native';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const imageToTensor = async (imageUri) => {
  let imageTensor, resized, normalized;
  try {
    await tf.ready();

    // Check URI
    console.log('📷 Image URI:', imageUri);

    // Read file as base64
    const imgB64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    console.log('📦 Base64 length:', imgB64.length);

    // Convert base64 to Uint8Array
    const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
    const rawImageData = new Uint8Array(imgBuffer);
    console.log('🔢 Raw bytes length:', rawImageData.length);

    // Decode JPEG
    imageTensor = decodeJpeg(rawImageData);
    console.log('🖼️ Decoded tensor shape:', imageTensor.shape);
    console.log('🖼️ Decoded tensor dtype:', imageTensor.dtype);
    console.log('🖼️ Decoded min/max:', 
      tf.min(imageTensor).dataSync()[0], 
      tf.max(imageTensor).dataSync()[0]
    );

    // Resize
    resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
    console.log('📐 Resized shape:', resized.shape);

    // Normalize
    normalized = resized.toFloat().div(127.5).sub(1);
    console.log('⚖️ Normalized min/max:',
      tf.min(normalized).dataSync()[0],
      tf.max(normalized).dataSync()[0]
    );

    // Batch
    const batched = normalized.expandDims(0);
    console.log('📦 Final tensor shape:', batched.shape);

    // Check for NaN before returning
    const hasNaN = tf.any(tf.isNaN(batched)).dataSync()[0];
    if (hasNaN) {
      console.error('❌ NaN detected in input tensor!');
    } else {
      console.log('✅ Tensor looks good, no NaN');
    }

    return batched;

  } catch (error) {
    console.error('❌ Image processing error:', error);
    return null;
  } finally {
    if (imageTensor) imageTensor.dispose();
    if (resized) resized.dispose();
    if (normalized) normalized.dispose();
  }
};