import "@/styles/globals.css";
import Head from "next/head";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";

// Pages that use their own full-page layout (no shared sidebar)
const NO_SIDEBAR_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/admin",
  "/staff",
];

// Placeholder user — replace with real auth session when backend is wired up
const MOCK_USER = { name: "Alex Chen", memberSince: "2025" };

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const useSidebar = !NO_SIDEBAR_ROUTES.includes(router.pathname);

  return (
    <>
      <Head>
        <title>The Crafty Studio</title>
        <meta name="description" content="The Crafty Studio - Makerspace Platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@700&display=swap"
          rel="stylesheet"
        />
      </Head>

      {useSidebar ? (
        <DashboardLayout user={MOCK_USER}>
          <Component {...pageProps} />
        </DashboardLayout>
      ) : (
        <Component {...pageProps} />
      )}
    </>
  );
}
