package com.pdftoolsapp

import android.app.Application
import android.content.ComponentCallbacks2
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.pdftoolsapp.pdfcrypto.PdfCryptoPackage
import com.pdftoolsapp.pdfrender.PdfRenderPackage
import com.pdftoolsapp.pdfcompress.PdfCompressPackage
import com.pdftoolsapp.pdfextract.PdfExtractPackage
import com.pdftoolsapp.pdfocr.PdfOcrPackage
import com.pdftoolsapp.pdfsave.PdfSavePackage
import com.pdftoolsapp.pdfshare.PdfSharePackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(PdfCryptoPackage())
          add(PdfRenderPackage())
          add(PdfCompressPackage())
          add(PdfExtractPackage())
          add(PdfOcrPackage())
          add(PdfSavePackage())
          add(PdfSharePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }

  /**
   * Once the UI is hidden, the decoded page images Fresco is holding are of no
   * use to anyone — the next time a screen shows one it re-reads the cache
   * file. Dropping them here is what keeps this app's background footprint
   * small, which is the number Play's memory standards look hardest at.
   *
   * JS hears about it too, so screens can let go of the images they are
   * rendering rather than leaving Fresco to re-decode them on the way back.
   */
  override fun onTrimMemory(level: Int) {
    super.onTrimMemory(level)
    if (level < ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) return

    try {
      if (Fresco.hasBeenInitialized()) Fresco.getImagePipeline().clearMemoryCaches()
    } catch (_: Throwable) {
      // Trimming is best effort; never take the app down over it.
    }

    try {
      reactHost.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("memoryTrim", null)
    } catch (_: Throwable) {
    }
  }
}
