import { Redirect } from 'expo-router'

/**
 * Android also delivers the sign-in return link (technova://auth?code=…) to the
 * router. The session provider has already handled the code, so just go home.
 */
export default function AuthReturn() {
  return <Redirect href="/" />
}
