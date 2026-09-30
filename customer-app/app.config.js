const baseConfig = require("./app.json").expo;

module.exports = {
  ...baseConfig,
  plugins: [
    ["react-native-maps", {
      androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY
    }]
  ]
};
