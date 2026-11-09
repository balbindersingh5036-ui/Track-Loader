import React, { useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { colors } from "../theme/theme";

export default function RazorpayCheckoutModal({
  visible,
  order,
  onSuccess,
  onError,
  onDismiss
}) {
  const webViewRef = useRef(null);

  if (!visible || !order) return null;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>LoadBalbin Secure Payment</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .loader-box {
      text-align: center;
      padding: 24px;
    }
    .spinner {
      border: 3px solid #e2e8f0;
      border-top: 3px solid #0071AB;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .text-title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .text-desc {
      font-size: 13px;
      color: #64748b;
    }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div class="loader-box">
    <div class="spinner"></div>
    <div class="text-title">Connecting to Razorpay...</div>
    <div class="text-desc">Please do not press back or refresh.</div>
  </div>

  <script>
    function post(type, data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: data || {} }));
      }
    }

    // Intercept console logs to forward to React Native
    var _origLog = console.log;
    var _origWarn = console.warn;
    var _origError = console.error;
    console.log = function() {
      var msg = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      post('CONSOLE_LOG', { msg: msg });
      _origLog.apply(console, arguments);
    };
    console.warn = function() {
      var msg = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      post('CONSOLE_WARN', { msg: msg });
      _origWarn.apply(console, arguments);
    };
    console.error = function() {
      var msg = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      post('CONSOLE_ERROR', { msg: msg });
      _origError.apply(console, arguments);
    };

    window.onload = function() {
      try {
        var options = {
          key: "${order.keyId || ''}",
          amount: ${order.amount || 0},
          currency: "${order.currency || 'INR'}",
          name: "LoadBalbin Logistics",
          description: "Booking #${order.bookingRef || ''}",
          order_id: "${order.orderId || ''}",
          prefill: {
            name: "${order.customerName ? order.customerName.replace(/"/g, '\\"') : ''}",
            contact: "${order.customerPhone ? order.customerPhone.replace(/"/g, '\\"') : ''}"
          },
          theme: {
            color: "#0071AB"
          },
          handler: function(response) {
            post("SUCCESS", response);
          },
          modal: {
            ondismiss: function() {
              post("DISMISS", {});
            }
          }
        };

        var rzp = new Razorpay(options);
        rzp.on("payment.failed", function(response) {
          var errorObj = (response && response.error) || {};
          post("FAILED", {
            message: errorObj.description || errorObj.reason || "Payment failed",
            code: errorObj.code,
            description: errorObj.description,
            source: errorObj.source,
            step: errorObj.step,
            reason: errorObj.reason,
            metadata: errorObj.metadata,
            rawError: errorObj
          });
        });

        rzp.open();
      } catch (e) {
        post("FAILED", {
          message: e.message || "Failed to initialize payment gateway",
          code: "INITIALIZATION_ERROR"
        });
      }
    };
  </script>
</body>
</html>`;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "CONSOLE_LOG") {
        console.log("[Razorpay-WebView]", data.payload?.msg);
      } else if (data.type === "CONSOLE_WARN") {
        console.warn("[Razorpay-WebView-Warn]", data.payload?.msg);
      } else if (data.type === "CONSOLE_ERROR") {
        console.error("[Razorpay-WebView-Error]", data.payload?.msg);
      } else if (data.type === "SUCCESS") {
        onSuccess(data.payload);
      } else if (data.type === "FAILED") {
        console.log("=== RAZORPAY PAYMENT FAILED EVENT ===");
        console.log("Error Code:", data.payload?.code);
        console.log("Error Description:", data.payload?.description);
        console.log("Error Source:", data.payload?.source);
        console.log("Error Step:", data.payload?.step);
        console.log("Error Reason:", data.payload?.reason);
        console.log("Error Metadata:", JSON.stringify(data.payload?.metadata));
        console.log("=====================================");
        onError(data.payload);
      } else if (data.type === "DISMISS") {
        onDismiss();
      }
    } catch (e) {
      // ignore non-json messages
    }
  };

  const handleShouldStartLoad = (request) => {
    const url = request.url;
    console.log("[Razorpay-ShouldStartLoad]:", url);
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("about:") ||
      url.startsWith("data:")
    ) {
      return true;
    }

    // Handle UPI & 3rd party payment app intents (e.g. upi://, paytmmp://, etc.)
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url).catch(() => {});
        }
      })
      .catch(() => {});
    return false;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="shield-checkmark" size={18} color="#16a34a" />
            <Text style={styles.headerTitle}>LoadBalbin Secure Payment</Text>
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={onDismiss}
            accessibilityLabel="Close payment window"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: "https://track-loader.onrender.com" }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={true}
            originWhitelist={["*"]}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={(navState) => {
              console.log("[Razorpay-NavState]:", navState.url, "loading:", navState.loading);
            }}
            onHttpError={(e) => {
              console.warn("[Razorpay-HttpError]:", e.nativeEvent.statusCode, e.nativeEvent.url);
            }}
            renderLoading={() => (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Initializing secure checkout...</Text>
              </View>
            )}
            startInLoadingState={true}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff"
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  closeButton: {
    padding: 6,
    borderRadius: 8
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  webView: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  centerLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    gap: 12
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted
  }
});

