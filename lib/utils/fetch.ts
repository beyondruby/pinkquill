/**
 * Safely parse a fetch Response as JSON.
 * Returns the parsed data, or throws an Error with a useful message
 * when the response body is empty or not valid JSON (e.g. 502 HTML pages).
 */
export async function safeResponseJson<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";

  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new Error(`Failed to read response body (status ${res.status})`);
  }

  if (!text) {
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    return {} as T;
  }

  // If content-type isn't JSON, try parsing anyway but give a clear error on failure
  try {
    return JSON.parse(text) as T;
  } catch {
    // Truncate HTML/text for the error message
    const preview = text.length > 120 ? text.slice(0, 120) + "..." : text;
    if (contentType.includes("text/html")) {
      throw new Error(`Server returned HTML instead of JSON (status ${res.status})`);
    }
    throw new Error(
      `Invalid JSON response (status ${res.status}): ${preview}`
    );
  }
}
