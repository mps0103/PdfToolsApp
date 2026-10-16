package com.pdftoolsapp.pdfcompress

import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDDeviceGray
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDDeviceRGB
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import java.io.File
import java.io.FileOutputStream

class PdfCompressModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        PDFBoxResourceLoader.init(reactContext.applicationContext)
    }

    override fun getName() = "PdfCompress"

    private fun clean(path: String) = path.removePrefix("file://")

    /**
     * Rasterised signatures are capped before anything else touches them. A
     * 48 MP phone photo carries far more detail than ink on paper ever does,
     * and the alpha pass below costs four bytes a pixel.
     */
    private val signatureMaxEdge = 2400

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

                        // A plain JPEG can be decoded straight from its stored
                        // bytes at a fraction of its size. getImage() always
                        // builds the full resolution bitmap first, which for a
                        // phone photo runs to well over 100 MB before we shrink
                        // it back down.
                        val original = decodeJpegDownsampled(xObject, maxEdge)
                            ?: try {
                                xObject.image
                            } catch (e: Exception) {
                                null
                            } ?: continue

                        val processed = transform(original, maxEdge, grayscale)
                        if (processed == null) {
                            original.recycle()
                            continue
                        }

                        // Let the source go before the JPEG encoder allocates,
                        // so the two are never alive at the same moment.
                        if (processed != original) original.recycle()

                        val replacement = JPEGFactory.createFromImage(doc, processed, quality)
                        resources.put(name as COSName, replacement)
                        touched++

                        processed.recycle()
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

    /**
     * Decodes a stored JPEG directly, skipping the full size decode PDFBox
     * would otherwise do.
     *
     * Only plain 8 bit grey or RGB images with no mask and no Decode array
     * qualify. Anything else needs the colour handling in PDFBox to come out
     * looking right, so this returns null and the caller falls back to it.
     *
     * The sample size is a whole number chosen to stay at or above maxEdge, so
     * the caller still scales to exactly the size it asked for and the page
     * that gets written is the same as before.
     */
    private fun decodeJpegDownsampled(image: PDImageXObject, maxEdge: Int): Bitmap? {
        try {
            if (maxEdge <= 0) return null

            val cos = image.cosObject ?: return null

            val stream = image.stream ?: return null
            val filters = stream.filters ?: return null
            if (filters.size != 1 || filters[0] != COSName.DCT_DECODE) return null

            if (image.bitsPerComponent != 8) return null
            if (image.isStencil) return null

            if (cos.getDictionaryObject(COSName.SMASK) != null) return null
            if (cos.getDictionaryObject(COSName.MASK) != null) return null
            if (cos.getDictionaryObject(COSName.DECODE) != null) return null

            // Only the two device spaces. This build of PDFBox does not
            // expose an ICC colour space class, and anything else needs
            // its own colour handling to come out right.
            val cs = image.colorSpace ?: return null
            if (cs !is PDDeviceRGB && cs !is PDDeviceGray) return null

            // The undecoded DCT bytes, straight off the stream.
            val bytes = cos.createRawInputStream().use { it.readBytes() }
            if (bytes.isEmpty()) return null

            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            val longest = maxOf(bounds.outWidth, bounds.outHeight)
            if (longest <= 0) return null

            // Largest power of two step that still leaves us at or above the cap.
            var sample = 1
            while (longest / (sample * 2) >= maxEdge) sample *= 2

            val opts = BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        } catch (e: Throwable) {
            // Any surprise here just means PDFBox decodes it the slow way.
            return null
        }
    }

    /**
     * Turns a photo of a signature on paper into transparent PNG ink.
     * Pixels brighter than `threshold` become fully transparent; darker ones
     * keep their colour at full alpha. A soft band just above the threshold
     * fades out gradually so the edges do not look cut with scissors.
     * The result is cropped to the ink, so there is no dead space around it
     * when the signature is placed on a page.
     */
    @ReactMethod
    fun signatureFromImage(srcPath: String, destPath: String, threshold: Int, promise: Promise) {
        var src: Bitmap? = null
        var out: Bitmap? = null
        try {
            val path = clean(srcPath)

            // Read the header first and decode at a whole number sample size.
            // Decoding the whole photo and then walking it as an int array cost
            // eight bytes a pixel, which is where this used to run out.
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path, bounds)
            val longest = maxOf(bounds.outWidth, bounds.outHeight)
            if (longest <= 0) {
                promise.reject("E_IO", "Could not read that image.")
                return
            }

            var sample = 1
            while (longest / (sample * 2) >= signatureMaxEdge) sample *= 2

            src = BitmapFactory.decodeFile(
                path,
                BitmapFactory.Options().apply {
                    inSampleSize = sample
                    inMutable = true
                    inPreferredConfig = Bitmap.Config.ARGB_8888
                }
            )
            if (src == null) {
                promise.reject("E_IO", "Could not read that image.")
                return
            }

            val w = src.width
            val h = src.height
            val soft = 25f
            var minX = w
            var minY = h
            var maxX = -1
            var maxY = -1

            // One row at a time, rewritten in place. The whole image int array
            // this replaces was as large again as the bitmap itself.
            val row = IntArray(w)
            for (y in 0 until h) {
                src.getPixels(row, 0, w, 0, y, w, 1)
                var rowTouched = false

                for (x in 0 until w) {
                    val p = row[x]
                    val r = (p shr 16) and 0xFF
                    val g = (p shr 8) and 0xFF
                    val b = p and 0xFF
                    val lum = 0.299f * r + 0.587f * g + 0.114f * b

                    val alpha = when {
                        lum >= threshold -> 0
                        lum >= threshold - soft ->
                            (((threshold - lum) / soft) * 255f).toInt().coerceIn(0, 255)
                        else -> 255
                    }

                    if (alpha == 0) {
                        row[x] = 0
                    } else {
                        row[x] = (alpha shl 24) or (p and 0x00FFFFFF)
                        rowTouched = true
                        if (x < minX) minX = x
                        if (x > maxX) maxX = x
                    }
                }

                src.setPixels(row, 0, w, 0, y, w, 1)
                if (rowTouched) {
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                }
            }

            if (maxX < 0) {
                promise.reject("E_EMPTY", "No ink found. Try a lower threshold or a clearer photo.")
                return
            }

            val margin = 8
            minX = (minX - margin).coerceAtLeast(0)
            minY = (minY - margin).coerceAtLeast(0)
            maxX = (maxX + margin).coerceAtMost(w - 1)
            maxY = (maxY + margin).coerceAtMost(h - 1)

            val cw = maxX - minX + 1
            val ch = maxY - minY + 1
            out = Bitmap.createBitmap(src, minX, minY, cw, ch)
            src.recycle()
            src = null

            // PNG only — JPEG has no alpha and would bring the paper back.
            FileOutputStream(File(clean(destPath))).use {
                out.compress(Bitmap.CompressFormat.PNG, 100, it)
            }

            promise.resolve(
                Arguments.createMap().apply {
                    putString("path", destPath)
                    putInt("width", cw)
                    putInt("height", ch)
                }
            )
        } catch (e: OutOfMemoryError) {
            promise.reject("E_MEMORY", "That photo is too large. Try a smaller one.")
        } catch (e: Exception) {
            promise.reject("E_IO", e.message ?: "Could not process that image.", e)
        } finally {
            src?.recycle()
            out?.recycle()
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
