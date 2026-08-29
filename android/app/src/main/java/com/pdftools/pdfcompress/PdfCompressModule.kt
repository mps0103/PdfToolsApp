package com.pdftools.pdfcompress

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.cos.COSName
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import java.io.File

class PdfCompressModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        PDFBoxResourceLoader.init(reactContext.applicationContext)
    }

    override fun getName() = "PdfCompress"

    private fun clean(path: String) = path.removePrefix("file://")

    /**
     * Re-encodes every image on every page as JPEG at the given quality,
     * capping the longest edge at maxEdge pixels. Set grayscale to drop colour.
     * Text and vectors are untouched.
     */
    @ReactMethod
    fun rewriteImages(
        srcPath: String,
        destPath: String,
        quality: Float,
        maxEdge: Int,
        grayscale: Boolean,
        promise: Promise
    ) {
        try {
            val srcFile = File(clean(srcPath))
            val before = srcFile.length()
            var touched = 0

            PDDocument.load(srcFile).use { doc ->
                for (page in doc.pages) {
                    val resources = page.resources ?: continue
                    // Copy the name list first — we mutate resources while iterating.
                    val names = resources.xObjectNames.toList()

                    for (name in names) {
                        val xObject = try {
                            resources.getXObject(name)
                        } catch (e: Exception) {
                            null
                        } ?: continue

                        if (xObject !is PDImageXObject) continue

                        val original = try {
                            xObject.image
                        } catch (e: Exception) {
                            null
                        } ?: continue

                        val processed = transform(original, maxEdge, grayscale)
                        if (processed == null) {
                            original.recycle()
                            continue
                        }

                        val replacement = JPEGFactory.createFromImage(doc, processed, quality)
                        resources.put(name as COSName, replacement)
                        touched++

                        if (processed != original) processed.recycle()
                        original.recycle()
                    }
                }

                doc.isAllSecurityToBeRemoved = false
                doc.save(File(clean(destPath)))
            }

            val after = File(clean(destPath)).length()
            promise.resolve(
                Arguments.createMap().apply {
                    putString("path", destPath)
                    putDouble("bytesBefore", before.toDouble())
                    putDouble("bytesAfter", after.toDouble())
                    putInt("imagesRewritten", touched)
                }
            )
        } catch (e: OutOfMemoryError) {
            promise.reject("E_MEMORY", "This file has images too large to process on device.")
        } catch (e: Exception) {
            promise.reject("E_IO", e.message, e)
        }
    }

    /** Returns a downscaled and/or desaturated copy, or the input when nothing to do. */
    private fun transform(source: Bitmap, maxEdge: Int, grayscale: Boolean): Bitmap? {
        val longest = maxOf(source.width, source.height)
        val scale = if (maxEdge > 0 && longest > maxEdge) maxEdge.toFloat() / longest else 1f

        if (scale == 1f && !grayscale) return source

        val w = (source.width * scale).toInt().coerceAtLeast(1)
        val h = (source.height * scale).toInt().coerceAtLeast(1)
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)

        val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
        if (grayscale) {
            paint.colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
        }

        Canvas(out).drawBitmap(
            source,
            android.graphics.Rect(0, 0, source.width, source.height),
            android.graphics.Rect(0, 0, w, h),
            paint
        )
        return out
    }
}
