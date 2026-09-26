import { issueCsrfToken } from "@/lib/csrf";

// Issues a CSRF token (as a readable cookie + JSON body). The frontend calls
// this before login/signup/logout and sends the token back in the
// x-csrf-token header.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }

    const token = issueCsrfToken(res);

    return res.status(200).json({
        ok: true,
        csrfToken: token,
    });
}
