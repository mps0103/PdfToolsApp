package com.pdftoolsapp.pdfshare

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * ACTION_SEND straight to the system chooser. Third-party share libraries
 * kept handing the native side a null Uri under the new architecture; this
 * builds the content URI itself through the FileProvider already declared
 * in the manifest.
 */
class PdfShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PdfShare"

    private fun clean(path: String) = path.removePrefix("file://")

    @ReactMethod
    fun shareFile(path: String, mimeType: String, title: String, promise: Promise) {
        try {
            val file = File(clean(path))
            if (!file.exists()) {
                promise.reject("E_MISSING", "That file is no longer there.")
                return
            }

            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.provider",
                file
            )

            val send = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(send, title).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                // The chooser is launched from a context that may not be an
                // activity, so it needs its own task.
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            // Launch the chooser from the application context. The chooser
            // already has FLAG_ACTIVITY_NEW_TASK so this works even without an
            // activity reference.
            reactContext.startActivity(chooser)

            promise.resolve(true)
        } catch (e: IllegalArgumentException) {
            // Thrown when the file sits outside every path in filepaths.xml.
            promise.reject("E_PROVIDER", "This file is not in a shareable folder.", e)
        } catch (e: Exception) {
            promise.reject("E_IO", e.message ?: "Could not start the share sheet.", e)
        }
    }
}
