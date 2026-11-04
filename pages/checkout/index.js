export async function getServerSideProps({ query }) {
  const cancelled = [query.cancelled, query.canceled].some(
    (value) => String(value || "").toLowerCase() === "true"
  );

  return {
    redirect: {
      destination: cancelled ? "/membership?cancelled=True" : "/membership",
      permanent: false,
    },
  };
}

export default function CheckoutRedirect() {
  return null;
}
