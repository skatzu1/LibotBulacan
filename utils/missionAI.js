import { useAuth } from '@clerk/clerk-expo';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://libotbackend.onrender.com'; // ← replace with your actual backend URL

// ─── Get Clerk Token ─────────────────────────────────────────────────────────
// Call this at the top of your component to pass getToken down, OR
// import useAuth directly wherever you call runPrediction.
// Since this is a utility file (not a component), we accept getToken as a param.

// ─── Convert image URI → base64 data URI ─────────────────────────────────────
async function imageUriToBase64(imageUri) {
  // On React Native, fetch() can read local file:// URIs
  const response = await fetch(imageUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result); // full data URI: "data:image/jpeg;base64,..."
    reader.onerror = () => reject(new Error('Failed to read image as base64'));
    reader.readAsDataURL(blob);
  });
}

// ─── loadModel ────────────────────────────────────────────────────────────────
// No-op now — model lives on the backend.
// Kept so Mission.js doesn't need changes (it still calls loadModel on mount).
export async function loadModel(missionId) {
  return true; // signal "ready" immediately
}

// ─── runPrediction ────────────────────────────────────────────────────────────
// Called by Mission.js after taking a photo.
//
// @param {string} imageUri   - local URI from CameraView.takePictureAsync()
// @param {string} missionId  - e.g. 'c2'
// @param {function} getToken - from Clerk's useAuth() hook, passed in from the component
//
export async function runPrediction(imageUri, missionId, getToken) {
  try {
    // 1. Convert photo to base64
    const base64Image = await imageUriToBase64(imageUri);

    // 2. Get Clerk auth token
    const token = await getToken();
    if (!token) throw new Error('Not authenticated — could not get Clerk token.');

    // 3. Call backend
    const response = await fetch(`${API_BASE}/api/verify/${missionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || `Server error ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) throw new Error(data.message || 'Verification failed');

    const { verified, confidence } = data;

    // Return shape matches what Mission.js and BucketListScreen expect
    return {
      isC2:       missionId === 'c2'       ? verified : false,
      isGatorade: missionId === 'gatorade' ? verified : false,
      isCocaCola: missionId === 'cocacola' ? verified : false,
      confidence,
      verified,
    };

  } catch (err) {
    console.error('runPrediction error:', err);
    return null;
  }
}

// ─── verifyMission ────────────────────────────────────────────────────────────
// Used by BucketListScreen. Still a stub — camera flow is owned by Mission.js.
// If you later want BucketListScreen to open its own camera and call this,
// pass imageUri and getToken as additional params.
export async function verifyMission(missionId) {
  console.warn('verifyMission called without imageUri — navigate to Mission screen instead.');
  return { verified: false, cancelled: true };
}