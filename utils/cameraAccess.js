// Camera and photo-library access, asked for by the app itself before any
// camera opens: the photo-mission camera, the profile and review photo
// cameras, and AR.
//
// QA 2026-10-16: "everything involving the camera" crashed, on Android and
// iPhone, and the phone never asked for camera access. Each library was left
// to ask on its own: image-crop-picker, VisionCamera and Viro all can, but Viro
// stops with "resumed without the required camera permissions" if it starts
// without it, and nothing explained a refusal. Now the app asks first, in one
// place, and a refusal gets a plain explanation with a way to Settings instead
// of a camera that fails.
import { Linking, Platform } from "react-native";
import { showAlert } from "../components/AppAlert";

// AppAlert runs a button's action once its card has faded (150 ms), while the
// <Modal> it sits in is still being taken down. A camera or photo picker
// opened in that moment is presented over the closing modal: on iOS it can be
// dismissed along with it, or take the app down. This gives the modal time to
// go first.
const ALERT_CLOSE_MS = 400;
export const afterAlertCloses = () => new Promise((resolve) => setTimeout(resolve, ALERT_CLOSE_MS));

const openSettings = () => Linking.openSettings().catch(() => {});

function explainCameraOff(purpose) {
  showAlert(
    "Camera access is off",
    `LibotBulacan needs the camera ${purpose}. Allow camera access for LibotBulacan in your phone's Settings, then try again.`,
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: openSettings },
    ],
    { tone: "warning", icon: "camera-off" },
  );
}

function explainPhotosOff() {
  showAlert(
    "Photo access is off",
    "To add a photo from your gallery, allow photo access for LibotBulacan in your phone's Settings, then try again.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: openSettings },
    ],
    { tone: "warning", icon: "image" },
  );
}

/**
 * Makes sure the app may use the camera, asking the phone's own permission
 * prompt when it hasn't been answered yet. Resolves true when the camera can
 * open; otherwise explains why not and resolves false.
 * `purpose` finishes "needs the camera …": "to take mission photos".
 */
export async function ensureCameraAccess(purpose = "for this") {
  let Camera;
  try {
    ({ Camera } = require("react-native-vision-camera"));
  } catch {
    return true; // no camera module in this build: the library asks for itself
  }
  try {
    let status = Camera.getCameraPermissionStatus();
    if (status === "granted") return true;
    // iOS asks once; after a "Don't Allow" only Settings can change it. Android
    // can ask again, and answers "denied" straight away (no prompt) once the
    // user has chosen "Don't ask again".
    if (status === "not-determined" || Platform.OS === "android") {
      status = await Camera.requestCameraPermission();
      if (status === "granted") return true;
    }
  } catch {
    return true; // couldn't tell: let the camera library ask as it always has
  }
  explainCameraOff(purpose);
  return false;
}

/**
 * What to show when the camera or photo picker (react-native-image-crop-picker)
 * fails. Says nothing for a cancel, points to Settings for a refused
 * permission, and otherwise shows `title` with "Please try again."
 */
export function explainPickerError(err, title = "Couldn't add the photo") {
  if (err?.code === "E_PICKER_CANCELLED") return;
  if (err?.code === "E_NO_LIBRARY_PERMISSION") return explainPhotosOff();
  if (err?.code === "E_NO_CAMERA_PERMISSION") return explainCameraOff("to take a photo");
  showAlert(title, "Please try again.");
}
