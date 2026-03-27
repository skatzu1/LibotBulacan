import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function ARScreen() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://ar-web-lemon.vercel.app/index.html' }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});