const API_BASE = 'https://libotbackend.onrender.com';

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

export async function runPrediction(imageUri, missionId, getToken) {
  try {
    const base64Image = await imageUriToBase64(imageUri);

    const token = await getToken();
    if (!token) throw new Error('Not authenticated — could not get Clerk token.');

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

    return {
      verified:   data.verified,
      confidence: data.confidence,
      noModel:    data.noModel || false,  // ✅ pass through no-model flag
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