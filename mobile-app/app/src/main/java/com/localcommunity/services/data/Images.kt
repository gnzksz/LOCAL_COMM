package com.localcommunity.services.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Photos are stored in Firestore as small JPEG data URLs (there is no Cloud Storage on the free plan).
 * The limits are the ones in firestore.rules: full photo <= 800 000 characters, thumbnail <= 60 000,
 * avatar <= 40 000.
 */
object Images {
    class ReportPhoto(val photo: String, val thumb: String, val preview: Bitmap)

    /** Photo + thumbnail + a preview for the screen. Call from a background thread. */
    fun reportPhoto(context: Context, uri: Uri): ReportPhoto {
        val source = load(context, uri, 1280)
        var photo = ""
        for ((side, quality) in listOf(1024 to 70, 900 to 60, 768 to 50, 640 to 45)) {
            photo = toDataUrl(scaleTo(source, side), quality)
            if (photo.length <= 700_000) break
        }
        if (photo.length > 800_000) error("The photo is too large even after compressing. Try another one.")
        return ReportPhoto(photo, toDataUrl(scaleTo(source, 96), 60), scaleTo(source, 480))
    }

    /** A centred square crop of 192 px as a JPEG data URL of at most about 38 000 characters. */
    fun avatar(context: Context, uri: Uri): String {
        val source = load(context, uri, 768)
        val side = min(source.width, source.height)
        val square = Bitmap.createBitmap(source, (source.width - side) / 2, (source.height - side) / 2, side, side)
        val small = Bitmap.createScaledBitmap(square, 192, 192, true)
        for (quality in listOf(85, 75, 65, 50)) {
            val url = toDataUrl(small, quality)
            if (url.length <= 38_000) return url
        }
        error("That picture is too detailed to use. Try another one.")
    }

    /** Turns "data:image/jpeg;base64,..." back into a bitmap (null if it cannot be read). */
    fun decodeDataUrl(url: String): Bitmap? = runCatching {
        val bytes = Base64.decode(url.substringAfter("base64,"), Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }.getOrNull()

    private fun toDataUrl(bitmap: Bitmap, quality: Int): String {
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    private fun scaleTo(bitmap: Bitmap, maxSide: Int): Bitmap {
        val longest = max(bitmap.width, bitmap.height)
        if (longest <= maxSide) return bitmap
        val scale = maxSide.toFloat() / longest
        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true)
    }

    /** Reads the picture, keeps memory low and turns it the right way up (camera photos carry a rotation flag). */
    private fun load(context: Context, uri: Uri, maxSide: Int): Bitmap {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0) error("That file is not a readable image.")

        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: error("That file is not a readable image.")

        val orientation = runCatching {
            resolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
        }.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val upright = if (degrees == 0f) decoded else {
            Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, Matrix().apply { postRotate(degrees) }, true)
        }
        return scaleTo(upright, maxSide)
    }
}
