import * as ImageManipulator from "expo-image-manipulator";
import { BASE_URL as API_BASE } from "../api";

// The model looks at a 224 × 224 image; the server resizes whatever it gets.
// Sending the camera's full-resolution crop (~2800 px, JPEG at 100 %) meant a
// 3–4 MB base64 upload per attempt — seconds or a timeout on rural mobile data —
// and the 512 MB server decoding a 12-megapixel image every time.
//
// 448 px (2× the model input) at 85 % measured, over 10 real spot photos and
// both models: uploads of 42–98 KB instead of 2.7–4.4 MB, with the model's
// confidence moving by at most 4.6 points (no systematic direction) against
// its 82 % pass mark. Larger sizes were not closer (512 px: 6.6, 640 px: 7.9).
const UPLOAD_PX = 448;
const UPLOAD_QUALITY = 0.85;

async function uploadableBase64(imageUri) {
  try {
    const out = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: UPLOAD_PX } }],
      { compress: UPLOAD_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (out.base64) return `data:image/jpeg;base64,${out.base64}`;
  } catch (err) {
    console.warn("[missionAI] resize failed, sending the original:", err?.message);
  }
  return imageUriToBase64(imageUri);
}

async function imageUriToBase64(imageUri) {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image as base64'));
    reader.readAsDataURL(blob);
  });
}

export async function loadModel(missionId) {
  return true;
}

// Sends the photo AND where the phone is. The server checks both — the photo
// only counts if it was taken at the spot — and, when both pass, completes the
// mission and awards its points itself. `coords` is { latitude, longitude,
// accuracy } from expo-location.
//
// Returns { verified, confidence, noModel, tooFar, distance, noLocation,
// completed }, { error: message } when the server refused the request, or null
// when it couldn't be reached.
export async function runPrediction(imageUri, missionId, getToken, coords) {
  try {
    const base64Image = await uploadableBase64(imageUri);

    const token = await getToken();
    if (!token) throw new Error('Not authenticated — could not get Clerk token.');

    const response = await fetch(`${API_BASE}/api/verify/${missionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        image: base64Image,
        lat: coords?.latitude,
        lng: coords?.longitude,
        accuracy: coords?.accuracy,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { error: data.message || `Server error ${response.status}` };
    }

    return {
      verified:   !!data.verified,
      confidence: data.confidence,
      noModel:    data.noModel || false,
      tooFar:     data.tooFar || false,
      distance:   data.distance,
      noLocation: data.noLocation || false,
      // The server completed the mission (now or on an earlier attempt).
      completed:  !!data.verified && (data.alreadyCompleted === true || data.alreadyCompleted === false),
    };

  } catch (err) {
    console.error('runPrediction error:', err);
    return null;
  }
}

export async function verifyMission(missionId) {
  console.warn('verifyMission called without imageUri — navigate to Mission screen instead.');
  return { verified: false, cancelled: true };
}