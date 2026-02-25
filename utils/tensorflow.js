import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

export const initTensorFlow = async () => {
    await tf.ready();
    console.log('✅ TensorFlow.js is ready!');
}