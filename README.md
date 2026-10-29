This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
# Financial PDF reports

Administrators can click Export Reports on `/admin` to open the dashboard-styled financial report modal and download a PDF. There is no separate `/reports` page. The dashboard and `/api/reports/financial` endpoint independently require an administrator session. The native dialog traps focus, supports Escape/backdrop closing, restores focus, and aborts pending downloads on close. Reports use the existing server-only `STRIPE_SECRET_KEY` and `DATABASE_URL`; no additional service or database migration is needed.

Periods include Today, Week to date, Month to date (default), Last 7 days, Previous month, and Custom range. All boundaries use `America/New_York`. Weeks run Sunday through Saturday. Custom dates include both calendar dates, are capped at generation time, and may span at most 366 days. The dashboard's weekly revenue also starts Sunday; its gross-sales metric differs from the export's net activity metric.

`GET /api/reports/financial?preset=week_to_date` or `?start=2026-10-01&end=2026-10-28` returns a PDF attachment. Financial amounts come exclusively from paginated Stripe balance transactions by creation date. Charges, Checkout line items, and Invoice Payments/invoice lines enrich the ledger with product details, including subscription renewals. A refund or dispute appears in the period of its financial adjustment, even when the purchase is older. Amounts are calculated in integer minor currency units; currencies have separate sections.

Product `equipment_id` metadata maps to `machine.stripe_machine_id`; product `room_id` maps to `room.stripe_room_id`. These database columns contain keys such as `small_cnc`, not Stripe product IDs. Existing reservation metadata provides a fallback; membership metadata and established membership/day-pass product names identify memberships. Grouping uses Stripe product IDs and database type labels. Unknown products remain in Uncategorized, and missing purchase detail is flagged. Current database prices are never used to reconstruct historic sales. Historical type labels reflect current mappings.

Purchased units represent billed hours/months or membership quantities, not booking counts. Mixed-product amounts use proportional cent allocation. Taxes and discounts are informational where line details exist, not extra financial movements. Actual captured amounts determine collected totals. Currency conversion or unavailable line allocation leaves amounts in Uncategorized. Required upstream failures abort the export. Financial totals are based on unique ledger transaction IDs, so multiple booking rows cannot multiply a payment.

Fees include attached fees and standalone fee transactions once. The PDF displays fee expenses as negative amounts; negative financial values, including refunds, are red. Actual positive refund/fee reversals retain their signs. Net activity excludes payout movements; total balance change includes them. Payouts are transfers to/from the bank, not additional sales. Net activity is not business profit. Other non-payout balance movements are included as separately labeled adjustments.

The PDF uses Crafty Studio's brown, amber, and cream palette. Product rows display simple type names, such as Small CNC, without category prefixes. A machine activity table replaces the transaction appendix: machine type, reservations (distinct linked paid Stripe Checkout Sessions per type), hours booked (purchased billing hours), fee, and net. All distinct machine types in the database appear, including unavailable or unmapped types, with zero values when inactive. Multiple products of the same machine type share a row, and multiple financial transactions for one checkout do not increase its count. Refunds and disputes do not reduce historical purchased hours or checkout counts. Refund-only periods can therefore show zero checkouts with negative net. Machine net includes linked sales, refunds, disputes, and their transaction fees. Mixed-purchase fees are allocated in integer minor units using the same product weights as amounts; standalone account fees remain in the overall summary and are not arbitrarily assigned to machines. Payments without linked Checkout Sessions do not contribute to checkout counts and generate a warning. Total revenue equals payments collected minus recorded sales tax, before refunds and fees; collected amounts and cash net retain tax for Stripe reconciliation. The normalized ledger remains available internally but is not printed in the PDF.

PDFKit runs only on the Node.js server. It draws paginated US Letter tables, buffers the completed document, and sends `application/pdf` with attachment and no-store headers. The browser downloads the resulting Blob and releases its object URL. No PDFs are persisted. Next.js externalizes PDFKit and traces its font data for deployment.

Verification: `npx vitest run lib/reports`, `npm run lint`, and `npm run build`. Inspect empty, typical, and long sample PDFs for wrapping, repeated headings, and page numbers. Before deployment, open Export Reports on `/admin` with the intended Stripe account, compare a known period against Stripe balance activity using identical timezone/currency/date boundaries, and time a representative annual export on the target host. Live-account reconciliation and deployment timeout verification require the deployment's session and credentials; mock tests do not establish those properties. Generation is synchronous and has no queue or persistent cache.
