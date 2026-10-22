import { parse } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";

// Resolves the session_id cookie on an incoming request to the logged-in
// user's session row (user_id, status, role, name). Returns null if there is
// no valid session.
export async function getSessionUser(req) {
  const cookies = parse(req.headers.cookie || "");
  const sessionId = cookies.session_id;

  if (!sessionId) {
    return null;
  }

  const userQuery = new UserRepository();
  return userQuery.findByCookie(sessionId);
}

// getServerSideProps redirect for pages that need a logged-in user
export function loginRedirect(resolvedUrl) {
  return {
    redirect: {
      destination: `/login?next=${encodeURIComponent(resolvedUrl)}`,
      permanent: false,
    },
  };
}
