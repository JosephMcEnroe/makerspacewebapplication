import { parse } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { loginRedirect } from "@/lib/session";
import { getPostLoginDestination } from "@/lib/authRedirect";

// Resolves the session user and whether they teach at the studio. Returns null
// when nobody is signed in.
export async function getInstructorSession(req) {
  const sessionId = parse(req.headers.cookie || "").session_id;
  if (!sessionId) return null;

  const sessionUser = await new UserRepository().findStaffSessionByCookie(sessionId);
  if (!sessionUser) return null;

  return { user: sessionUser, isInstructor: sessionUser.is_instructor === true };
}

// getServerSideProps guard for the instructor dashboard. Returns { deny } (a
// redirect to return from getServerSideProps as-is) or { session }.
export async function requireInstructorPage(req, resolvedUrl) {
  const session = await getInstructorSession(req);
  if (!session) return { deny: loginRedirect(resolvedUrl) };
  if (!session.isInstructor) {
    // Everyone else goes to the landing page for their own role
    const destination = getPostLoginDestination(null, session.user.role_of_membership);
    return { deny: { redirect: { destination, permanent: false } } };
  }
  return { session };
}
