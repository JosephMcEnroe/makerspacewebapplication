// Browser helper for staff API calls: fetches a CSRF token, sends JSON, and
// throws an Error with the server's message when the request fails.
export async function staffRequest(url, method, body) {
  let csrfToken;
  try {
    const csrfResponse = await fetch("/api/auth/csrf");
    csrfToken = (await csrfResponse.json()).csrfToken;
  } catch {
    throw new Error("Could not connect to the server. Please try again.");
  }
  if (!csrfToken) throw new Error("Could not verify the request. Please refresh and try again.");

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not connect to the server. Please try again.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
