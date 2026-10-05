const baseConfig = require("./app.json").expo;

module.exports = {
  ...baseConfig,
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://track-loader.onrender.com/api"
  }
};
