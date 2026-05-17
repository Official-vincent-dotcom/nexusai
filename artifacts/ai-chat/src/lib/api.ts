/**
 * Returns the API base URL from the environment variable.
 * In development (Replit), leave VITE_API_BASE_URL unset so relative URLs
 * are used and the shared proxy routes /api to the API server.
 * In production or when the API is hosted separately, set:
 *   VITE_API_BASE_URL=https://your-api-server.example.com
 */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
}
