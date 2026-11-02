This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Studio reservation checkout

Monthly studios use Stripe hosted Checkout with a single upfront payment for
the selected calendar months (up to twelve). The booking screen calls
`POST /api/reservations/create` and redirects to the returned checkout URL.
Creating a session does not confirm a reservation; the existing signed Stripe
webhook confirms it after payment.

Configure these server-side environment variables in `.env.local` for local
development, or in your deployment's environment settings:

- `STRIPE_SECRET_KEY`: your Stripe test secret key during development.
- `APP_URL`: the application's public origin, such as `http://localhost:3000`
  locally or `https://studio.example` in production. Required in production;
  development defaults to `http://localhost:3000`. Checkout return URLs never
  use the request's Origin header for studio bookings.
- `STRIPE_WEBHOOK_SECRET`: signing secret for `/api/stripe-webhook`, required
  for payment fulfillment. Use the secret for the specific endpoint or local
  Stripe CLI forwarding session.
- `DATABASE_URL`: PostgreSQL connection string used for accounts and rooms.

For each studio, set the database room's `stripe_room_id` to a stable key.
In the same Stripe account and test/live mode as the secret key, configure
exactly one active product whose metadata `room_id` matches that key exactly.
Give it an active, fixed, per-unit default price representing **one
calendar month**. Studios support one-time prices or licensed recurring prices
with a one-month interval. A recurring studio price supplies the monthly rate
for a one-time upfront charge; checkout does not create a subscription.
Metered prices, other recurring intervals, and quantity transformations are unsupported.
Checkout uses the price's currency and a quantity equal to the selected month
count; prices and totals are never accepted from the browser.

For a manual test, sign in, select a studio and future available months, then
choose **Continue to payment**. Check the studio, quantity, and total in Stripe
test Checkout. Cancel to return to the selected studio, or complete a test
payment with webhook forwarding enabled and verify confirmation. The webhook
handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Never commit secret keys or signing secrets.

Refunds and temporary checkout holds are not implemented here. Availability is
checked before checkout, but concurrent checkouts can select the same months.

## Getting Started

First, run the development server:

```bash
npm install # install Node dependencies
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
