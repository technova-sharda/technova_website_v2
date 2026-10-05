import coreWebVitals from "eslint-config-next/core-web-vitals"

// mobile/ is the Expo app; it has its own lint setup (npx expo lint)
export default [{ ignores: ["mobile/**"] }, ...coreWebVitals]
