package com.pdftools.pdfsave

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Output currently lives in the app's private folder, which disappears on
 * uninstall and is awkward to reach from a file manager. This copies a
 * finished file into the public Downloads collection instead.
 */
class PdfSaveModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PdfSave"

    private fun clean(path: String) = path.removePrefix("file://")

    @ReactMethod
    fun saveToDownloads(srcPath: String, displayName: String, mimeType: String, promise: Promise) {
        try {
            val source = File(clean(srcPath))
            if (!source.exists()) {
                promise.reject("E_MISSING", "That file is no longer there.")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Scoped storage: MediaStore owns the write, no permission needed.
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, displayName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }

                val resolver = reactContext.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: run {
                        promise.reject("E_IO", "Could not create the file in Downloads.")
                        return
                    }

                resolver.openOutputStream(uri).use { out ->
                    if (out == null) {
                        promise.reject("E_IO", "Could not open Downloads for writing.")
                        return
                    }
                    source.inputStream().use { it.copyTo(out) }
                }

                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
                promise.resolve(uri.toString())
            } else {
                // API 28 and below: direct write, needs WRITE_EXTERNAL_STORAGE.
                val dir = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                )
                if (!dir.exists()) dir.mkdirs()

                var target = File(dir, displayName)
                var counter = 1
                val stem = displayName.substringBeforeLast('.')
                val ext = displayName.substringAfterLast('.', "")
                while (target.exists()) {
                    target = File(dir, "$stem ($counter)${if (ext.isEmpty()) "" else ".$ext"}")
                    counter++
                }

                source.copyTo(target, overwrite = false)
                promise.resolve("file://${target.absolutePath}")
            }
        } catch (e: SecurityException) {
            promise.reject("E_PERMISSION", "Storage permission is needed to save to Downloads.", e)
        } catch (e: Exception) {
            promise.reject("E_IO", e.message, e)
        }
    }
}
