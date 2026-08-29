package com.pdftoolsapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.pdftoolsapp.pdfcrypto.PdfCryptoPackage
import com.pdftoolsapp.pdfrender.PdfRenderPackage
import com.pdftoolsapp.pdfcompress.PdfCompressPackage
import com.pdftoolsapp.pdfextract.PdfExtractPackage
import com.pdftoolsapp.pdfocr.PdfOcrPackage
import com.pdftoolsapp.pdfsave.PdfSavePackage

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
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
