package expo.modules.framerate

import android.os.Build
import android.view.Display
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs

// Lets a screen ask the display for a refresh rate.
//
// Viro draws a new frame on every display refresh whether or not anything
// moved, so on a 120/144 Hz phone the 3D views render 2–2.4× the frames they
// would at 60 Hz, for nothing visible — that is most of their heat. The request
// is the window's preferred display mode, which Android honours while this
// window is in front; clearing it hands the choice back to the system.
class FrameRateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FrameRate")

    // hz <= 0 clears the request.
    AsyncFunction("setPreferredFrameRate") { hz: Double ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.runOnUiThread {
        val window = activity.window ?: return@runOnUiThread
        val params = window.attributes
        if (hz <= 0) {
          params.preferredDisplayModeId = 0
          params.preferredRefreshRate = 0f
        } else {
          @Suppress("DEPRECATION")
          val display: Display? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.display
            else activity.windowManager.defaultDisplay
          val current = display?.mode
          // Same resolution as now, refresh rate nearest the request.
          val mode = display?.supportedModes
            ?.filter { current == null || (it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight) }
            ?.minByOrNull { abs(it.refreshRate - hz) }
          params.preferredDisplayModeId = mode?.modeId ?: 0
          params.preferredRefreshRate = mode?.refreshRate ?: hz.toFloat()
        }
        window.attributes = params
      }
    }
  }
}
