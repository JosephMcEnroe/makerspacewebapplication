import { AuthProvider } from "@/context/AuthContext";
import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    
    <AuthProvider>
      <Head>
        <title>The Crafty Studio</title>
        <meta name="description" content="The Crafty Studio - Makerspace Platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

