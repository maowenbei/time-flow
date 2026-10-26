const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;

// Keep app.json as the source of product settings. No credentials => console mode.
module.exports = ({ config }) => {
  const configuredPath = process.env.GOOGLE_SERVICES_PLIST;
  const firebaseEnabled = Boolean(configuredPath);
  const result = {
    ...config,
    extra: { ...config.extra, analytics: { firebaseEnabled } },
  };
  if (!configuredPath) return result;

  const file = path.resolve(__dirname, configuredPath);
  if (!fs.existsSync(file)) {
    throw new Error('GOOGLE_SERVICES_PLIST must point to an existing GoogleService-Info.plist file.');
  }
  let settings;
  try {
    settings = plist.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('GOOGLE_SERVICES_PLIST must be a valid XML GoogleService-Info.plist.');
  }
  if (settings.BUNDLE_ID !== config.ios.bundleIdentifier) {
    throw new Error(`Firebase BUNDLE_ID must match ${config.ios.bundleIdentifier}.`);
  }
  if (!settings.GOOGLE_APP_ID || !settings.API_KEY || !settings.PROJECT_ID) {
    throw new Error('Firebase plist is missing GOOGLE_APP_ID, API_KEY or PROJECT_ID.');
  }
  result.ios = { ...config.ios, googleServicesFile: file };
  result.plugins = [
    ...(config.plugins ?? []),
    '@react-native-firebase/app',
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
  ];
  return result;
};
