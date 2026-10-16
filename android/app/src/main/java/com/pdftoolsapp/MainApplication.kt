package com.pdftoolsapp

import android.app.Application
import android.content.ComponentCallbacks2
import com.facebook.common.internal.Supplier
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.cache.MemoryCacheParams
import com.facebook.imagepipeline.core.DownsampleMode
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.shell.MainPackageConfig
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
        PackageList(this, MainPackageConfig(frescoConfig())).packages.apply {
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

  /**
   * Left to itself Fresco sizes its bitmap cache at a quarter of the heap,
   * and with largeHeap gone that is still far more than this app needs: the
   * only images it shows are page renders it can re-read from the cache
   * directory in milliseconds. A flat 32 MB holds the thumbnails actually
   * on screen and nothing else.
   *
   * DownsampleMode.AUTO is the half that matters for decode: it samples a
   * large image down as it is read rather than building it at full size and
   * scaling afterwards. A saved page can be several thousand pixels wide and
   * is drawn into a list row.
   *
   * No network images anywhere in this app, so the default fetcher is fine.
   */
  private fun frescoConfig(): ImagePipelineConfig {
    val params = MemoryCacheParams(
      /* maxCacheSize = */ 32 * 1024 * 1024,
      /* maxCacheEntries = */ 64,
      /* maxEvictionQueueSize = */ 8 * 1024 * 1024,
      /* maxEvictionQueueEntries = */ 16,
      /* maxCacheEntrySize = */ 8 * 1024 * 1024,
    )

    return ImagePipelineConfig.newBuilder(applicationContext)
      .setBitmapMemoryCacheParamsSupplier(Supplier { params })
      .setDownsampleMode(DownsampleMode.AUTO)
      .build()
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
