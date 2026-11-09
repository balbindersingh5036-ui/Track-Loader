import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

export default function RouteMapWeb({
  pickup,
  drop,
  routeCoordinates = [],
  activeSelectionMode = 'pickup', // 'pickup' | 'drop'
  onLocationSelect,
  distanceKm,
  durationFormatted,
  height = 280
}) {
  const iframeRef = useRef(null);

  // Generate self-contained HTML for Leaflet OSM map
  const generateMapHtml = () => {
    const pickupLat = pickup?.latitude ?? 26.8467;
    const pickupLon = pickup?.longitude ?? 80.9462;
    const hasPickup = Boolean(pickup?.latitude && pickup?.longitude);

    const dropLat = drop?.latitude ?? 28.6139;
    const dropLon = drop?.longitude ?? 77.2090;
    const hasDrop = Boolean(drop?.latitude && drop?.longitude);

    const coordsJson = JSON.stringify(routeCoordinates || []);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .badge {
      position: absolute; top: 10px; right: 10px; z-index: 1000;
      background: rgba(15, 23, 42, 0.85); color: #fff; padding: 6px 12px;
      border-radius: 8px; font-size: 12px; font-weight: 600;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    .custom-icon {
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; color: white; font-weight: bold; font-size: 11px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid #ffffff;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${pickupLat}, ${pickupLon}], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var pickupIcon = L.divIcon({
      className: 'custom-icon',
      html: '<div style="background-color:#16a34a;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;border:2px solid #fff;">P</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    var dropIcon = L.divIcon({
      className: 'custom-icon',
      html: '<div style="background-color:#dc2626;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;border:2px solid #fff;">D</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    var pickupMarker = null;
    var dropMarker = null;
    var polyline = null;
    var activeMode = "${activeSelectionMode}";

    ${hasPickup ? `
    pickupMarker = L.marker([${pickupLat}, ${pickupLon}], { icon: pickupIcon, draggable: true }).addTo(map);
    pickupMarker.bindPopup("<b>Pickup:</b> ${pickup?.address || 'Pickup Point'}");
    pickupMarker.on('dragend', function(e) {
      var latlng = e.target.getLatLng();
      window.parent.postMessage({ type: 'LB_LOCATION_SELECT', mode: 'pickup', latitude: latlng.lat, longitude: latlng.lng }, '*');
    });
    ` : ''}

    ${hasDrop ? `
    dropMarker = L.marker([${dropLat}, ${dropLon}], { icon: dropIcon, draggable: true }).addTo(map);
    dropMarker.bindPopup("<b>Drop-Off:</b> ${drop?.address || 'Drop-Off Destination'}");
    dropMarker.on('dragend', function(e) {
      var latlng = e.target.getLatLng();
      window.parent.postMessage({ type: 'LB_LOCATION_SELECT', mode: 'drop', latitude: latlng.lat, longitude: latlng.lng }, '*');
    });
    ` : ''}

    var routePts = ${coordsJson};
    if (routePts && routePts.length > 0) {
      polyline = L.polyline(routePts, { color: '#0284c7', weight: 5, opacity: 0.85 }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else if (pickupMarker && dropMarker) {
      var group = new L.featureGroup([pickupMarker, dropMarker]);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    } else if (pickupMarker) {
      map.setView([${pickupLat}, ${pickupLon}], 12);
    }

    map.on('click', function(e) {
      window.parent.postMessage({
        type: 'LB_LOCATION_SELECT',
        mode: activeMode,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }, '*');
    });

    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'LB_SET_MODE') {
        activeMode = event.data.mode;
      }
    });
  </script>
</body>
</html>`;
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'LB_LOCATION_SELECT') {
        if (typeof onLocationSelect === 'function') {
          onLocationSelect(event.data.mode, event.data.latitude, event.data.longitude);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLocationSelect]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'LB_SET_MODE', mode: activeSelectionMode },
        '*'
      );
    }
  }, [activeSelectionMode]);

  return (
    <View style={[styles.container, { height }]}>
      <iframe
        ref={iframeRef}
        title="OpenStreetMap Route"
        srcDoc={generateMapHtml()}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
      />

      {distanceKm != null && (
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceBadgeText}>
            {distanceKm} km {durationFormatted ? `· ${durationFormatted}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    position: 'relative',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.line || '#cbd5e1'
  },
  distanceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  distanceBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  }
});

