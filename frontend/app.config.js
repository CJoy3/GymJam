const appJson = require('./app.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = {
  expo: {
    ...appJson.expo,
    scheme: 'gymjam',
    ios: {
      ...appJson.expo.ios,
      config: {
        googleMapsApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  },
};
