export function getPostLoginDestination(requestedPath, role) {
  if (typeof requestedPath === "string") {
    try {
      const url = new URL(requestedPath, "http://localhost");
      const isLocalPath = url.origin === "http://localhost"
        && requestedPath.startsWith("/")
        && !requestedPath.startsWith("//");
      const isLoginPath = url.pathname === "/login" || url.pathname.startsWith("/login/");
      if (isLocalPath && !isLoginPath) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      // Fall back to the role-based landing page for malformed destinations.
    }
  }



  if (role.toLowerCase() === "admin") return "/admin";
  if (role.toLowerCase() === "staff") return "/staff";
  return "/dashboard";
}
