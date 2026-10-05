// Test builds pointed at a laptop over the USB cable (EXPO_PUBLIC_API_URL=http://localhost:3000)
// need plain HTTP to localhost; normal builds talk HTTPS to the live site and don't allow it.
module.exports = ({ config }) => {
  const insecureDev = /^http:\/\//.test(process.env.EXPO_PUBLIC_API_URL ?? '')
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: insecureDev } }]],
  }
}
