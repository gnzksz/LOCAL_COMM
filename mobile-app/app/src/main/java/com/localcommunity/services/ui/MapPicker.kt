package com.localcommunity.services.ui

import android.annotation.SuppressLint
import android.view.MotionEvent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker

/**
 * An OpenStreetMap map with one pin.
 *  - interactive = true: tap the map to drop the pin, drag the pin to fine-tune ([onPick] gets the new place);
 *  - interactive = false: only shows the pin (used on the report detail screen).
 */
@SuppressLint("ClickableViewAccessibility")
@Composable
fun MapPicker(
    latitude: Double?,
    longitude: Double?,
    modifier: Modifier = Modifier,
    interactive: Boolean = true,
    onPick: (Double, Double) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val pick = rememberUpdatedState(onPick)

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            minZoomLevel = 3.0
            controller.setZoom(5.5)
            controller.setCenter(GeoPoint(12.8797, 121.774)) // the Philippines, until a pin is set
            // The map sits inside a scrolling screen: let the map take the touch while a finger is on it.
            setOnTouchListener { view, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> view.parent?.requestDisallowInterceptTouchEvent(true)
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> view.parent?.requestDisallowInterceptTouchEvent(false)
                }
                false
            }
        }
    }

    val marker = remember {
        Marker(mapView).apply {
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            setOnMarkerClickListener { _, _ -> true } // no balloon
            isDraggable = interactive
            if (interactive) {
                setOnMarkerDragListener(object : Marker.OnMarkerDragListener {
                    override fun onMarkerDrag(marker: Marker?) {}
                    override fun onMarkerDragStart(marker: Marker?) {}
                    override fun onMarkerDragEnd(marker: Marker?) {
                        marker?.position?.let { pick.value(it.latitude, it.longitude) }
                    }
                })
            }
        }
    }

    // tap on the map -> pin
    LaunchedEffect(interactive) {
        if (interactive) {
            mapView.overlays.add(
                0,
                MapEventsOverlay(object : MapEventsReceiver {
                    override fun singleTapConfirmedHelper(p: GeoPoint?): Boolean {
                        if (p == null) return false
                        pick.value(p.latitude, p.longitude)
                        return true
                    }

                    override fun longPressHelper(p: GeoPoint?): Boolean = false
                })
            )
        }
    }

    // keep the pin where the state says it is
    LaunchedEffect(latitude, longitude) {
        if (latitude != null && longitude != null) {
            val point = GeoPoint(latitude, longitude)
            marker.position = point
            if (!mapView.overlays.contains(marker)) mapView.overlays.add(marker)
            mapView.controller.setZoom(maxOf(mapView.zoomLevelDouble, 17.0))
            mapView.controller.animateTo(point)
            mapView.invalidate()
        }
    }

    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            mapView.onDetach()
        }
    }

    AndroidView(factory = { mapView }, modifier = modifier)
}
