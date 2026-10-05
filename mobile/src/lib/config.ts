/**
 * Where the app talks to. Production by default. For a USB-cable test build
 * against the laptop, copy mobile/.env.usb.local to mobile/.env (it sets
 * EXPO_PUBLIC_API_URL=http://localhost:3000) and delete it again afterwards.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://www.technovashardauniversity.in').replace(/\/$/, '')
