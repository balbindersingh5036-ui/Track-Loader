import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/theme';

export default function RouteMapNative({
  pickup,
  drop,
  routeCoordinates = [],
  activeSelectionMode = 'pickup', // 'pickup' | 'drop'
  onLocationSelect,
  distanceKm,
  durationFormatted,
  height = 280
}) {
  const webViewRef = useRef(null);

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
    * { -webkit-tap-highlight-color: transparent; }
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .custom-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      font-size: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      border: 2px solid #ffffff;
    }
    .pickup-icon {
      background-color: #16a34a;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: bold;
      font-size: 12px;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .drop-icon {
      background-color: #dc2626;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: bold;
      font-size: 12px;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${pickupLat}, ${pickupLon}], 7);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var pickupIcon = L.divIcon({
      className: '',
      html: '<div class="pickup-icon">P</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    var dropIcon = L.divIcon({
      className: '',
      html: '<div class="drop-icon">D</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    var pickupMarker = null;
    var dropMarker = null;
    var polyline = null;
    var activeMode = "${activeSelectionMode}";

    function notifyRN(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    ${hasPickup ? `
    pickupMarker = L.marker([${pickupLat}, ${pickupLon}], { icon: pickupIcon, draggable: true }).addTo(map);
    pickupMarker.bindPopup("<b>Pickup:</b> ${pickup?.address ? String(pickup.address).replace(/"/g, '&quot;') : 'Pickup Location'}");
    pickupMarker.on('dragend', function(e) {
      var latlng = e.target.getLatLng();
      notifyRN({ type: 'LB_LOCATION_SELECT', mode: 'pickup', latitude: latlng.lat, longitude: latlng.lng });
    });
    ` : ''}

    ${hasDrop ? `
    dropMarker = L.marker([${dropLat}, ${dropLon}], { icon: dropIcon, draggable: true }).addTo(map);
    dropMarker.bindPopup("<b>Drop-Off:</b> ${drop?.address ? String(drop.address).replace(/"/g, '&quot;') : 'Drop Destination'}");
    dropMarker.on('dragend', function(e) {
      var latlng = e.target.getLatLng();
      notifyRN({ type: 'LB_LOCATION_SELECT', mode: 'drop', latitude: latlng.lat, longitude: latlng.lng });
    });
    ` : ''}

    var routePts = ${coordsJson};
    if (routePts && routePts.length > 0) {
      polyline = L.polyline(routePts, { color: '#0284c7', weight: 5, opacity: 0.85 }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
    } else if (pickupMarker && dropMarker) {
      var group = new L.featureGroup([pickupMarker, dropMarker]);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    } else if (pickupMarker) {
      map.setView([${pickupLat}, ${pickupLon}], 12);
    }

    map.on('click', function(e) {
      notifyRN({
        type: 'LB_LOCATION_SELECT',
        mode: activeMode,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      });
    });

    document.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'LB_SET_MODE') {
          activeMode = data.mode;
        }
      } catch(e) {}
    });

    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'LB_SET_MODE') {
          activeMode = data.mode;
        }
      } catch(e) {}
    });
  </script>
</body>
</html>`;
  };

  useEffect(() => {
    if (webViewRef.current) {
      const msg = JSON.stringify({ type: 'LB_SET_MODE', mode: activeSelectionMode });
      webViewRef.current.postMessage(msg);
    }
  }, [activeSelectionMode]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.type === 'LB_LOCATION_SELECT' && typeof onLocationSelect === 'function') {
        onLocationSelect(data.mode, data.latitude, data.longitude);
      }
    } catch (e) {
      // non-json message ignored
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHtml() }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        originWhitelist={['*']}
        onMessage={handleMessage}
        nestedScrollEnabled={true}
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
  webView: {
    flex: 1,
    backgroundColor: 'transparent'
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
