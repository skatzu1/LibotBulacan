import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';

const AR_URL = 'https://ar-web-lemon.vercel.app/ar.html'; // ← your hosted ar.html
const AR_CONFIG = {
  latitude: 14.1234,    // ← replace with your real GPS coords
  longitude: 121.5678,
  modelUrl: 'https://ar-web-lemon.vercel.app/question_mark.glb', // ← your hosted .glb
};

export default function ARScreen({ navigation }) {  // ← kept your original name
  const webviewRef = useRef(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const allGranted = Object.values(granted).every(
        (v) => v === PermissionsAndroid.RESULTS.GRANTED
      );
      if (!allGranted) {
        Alert.alert('Permissions required', 'Camera and location are needed for AR.');
      }
    }
  };

  const onWebViewLoad = () => {
    const script = `
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'AR_CONFIG',
          latitude: ${AR_CONFIG.latitude},
          longitude: ${AR_CONFIG.longitude},
          modelUrl: '${AR_CONFIG.modelUrl}'
        })
      }));
      true;
    `;
    webviewRef.current?.injectJavaScript(script);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ uri: AR_URL }}
        style={styles.webview}
        onLoad={onWebViewLoad}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        geolocationEnabled={true}
        originWhitelist={['*']}
        allowsProtectedMedia={true}
        backgroundColor="black"
      />
      {navigation && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  webview: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: { color: 'white', fontSize: 28, fontWeight: 'bold' },
});