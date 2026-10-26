// A build without a plist must not link Firebase or run its native setup.
const firebasePlatforms = {
  android: null, // This integration is iOS-only; Android remains a preview target.
  ...(process.env.GOOGLE_SERVICES_PLIST ? {} : { ios: null }),
};

module.exports = {
  dependencies: {
    '@react-native-firebase/app': { platforms: firebasePlatforms },
    '@react-native-firebase/analytics': { platforms: firebasePlatforms },
  },
};
