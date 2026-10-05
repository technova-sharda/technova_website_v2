/**
 * Where the app talks to. Production by default; for local testing put
 * EXPO_PUBLIC_API_URL=http://<your-laptop-ip>:3000 in mobile/.env.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://technovashardauniversity.in').replace(/\/$/, '')
