package com.pdftoolsapp

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * The activity launches under SplashTheme so Android paints the logo the
   * instant the icon is tapped, before React Native exists.
   *
   * The swap back to AppTheme is posted rather than done inline: calling it
   * during onCreate replaces the splash before Android has drawn it, which
   * shows the plain theme background instead. Posting defers it until the
   * window has been laid out, by which time the JS splash is taking over.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.decorView.post { setTheme(R.style.AppTheme) }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "PdfToolsApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}