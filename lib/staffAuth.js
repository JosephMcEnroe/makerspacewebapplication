import { parse } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { loginRedirect } from "@/lib/session";

// Resolves the session user and their staff/admin flags. Returns null when
// nobody is signed in.
// Session and role flags come back in a single query since every staff page
// and API call runs this before anything else.
export async function getStaffSession(req) {
  const sessionId = parse(req.headers.cookie || "").session_id;
  if (!sessionId) return null;

  const sessionUser = await new UserRepository().findStaffSessionByCookie(sessionId);
  if (!sessionUser) return null;

  const { is_staff: isStaff, is_admin: isAdmin } = sessionUser;
  return { user: sessionUser, isStaff, isAdmin, canManage: isStaff || isAdmin };
}

// getServerSideProps guard for staff pages. Returns { deny } (a redirect to
// return from getServerSideProps as-is) or { session, navRole }.
export async function requireStaffPage(req, resolvedUrl) {
  const session = await getStaffSession(req);
  if (!session) return { deny: loginRedirect(resolvedUrl) };
  if (!session.canManage) {
    return { deny: { redirect: { destination: "/dashboard", permanent: false } } };
  }
  // Admins get the admin navbar (admin dashboard + reports links)
  return { session, navRole: session.isAdmin ? "admin" : "staff" };
}

// API guard: sends the error response and returns null if the caller is not staff
export async function requireStaffApi(req, res) {
  const session = await getStaffSession(req);
  if (!session) {
    res.status(401).json({ error: "Sign in to continue." });
    return null;
  }
  if (!session.canManage) {
    res.status(403).json({ error: "Staff access required." });
    return null;
  }
  return session;
}
