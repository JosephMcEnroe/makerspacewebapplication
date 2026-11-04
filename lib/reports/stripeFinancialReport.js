// Balance transactions are the sole ledger. Checkout/invoice objects only enrich it.
const id = value => typeof value === "string" ? value : value?.id;
async function collect(list) {
  const result = [];
  for await (const item of list) result.push(item);
  return result;
}
export function allocateCents(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map((_, i) => i === 0 ? total : 0);
  const sign = Math.sign(total), absolute = Math.abs(total);
  const raw = weights.map(w => absolute * w / sum);
  const values = raw.map(Math.floor);
  let remainder = absolute - values.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, fraction: v - values[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of order) { if (!remainder) break; values[i]++; remainder--; }
  return values.map(v => sign * v);
}

export async function buildFinancialReport({ stripe, period, mappings, mode }) {
  const cache = new Map();
  const cached = (key, fn) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(fn));
    return cache.get(key);
  };
  const warnings = new Set();
  const product = value => typeof value === "object" && value ? value
    : cached(`product:${value}`, () => stripe.products.retrieve(value));
  async function purchase(chargeId) {
    return cached(`purchase:${chargeId}`, async () => {
      const charge = await stripe.charges.retrieve(chargeId);
      const pi = id(charge.payment_intent);
      if (!pi) return { lines: [], metadata: charge.metadata || {} };
      const sessions = await collect(stripe.checkout.sessions.list({ payment_intent: pi, limit: 100 }));
      if (sessions.length) {
        const session = sessions[0];
        const lines = await collect(stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price.product"] }));
        return { lines, metadata: session.metadata || {}, checkoutId: session.id };
      }
      const payments = await collect(stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: pi }, status: "paid", limit: 100 }));
      const invoiceIds = [...new Set(payments.map(p => id(p.invoice)))];
      const lines = [];
      for (const invoiceId of invoiceIds) {
        lines.push(...await collect(stripe.invoices.listLineItems(invoiceId, { limit: 100 })));
      }
      return { lines, metadata: charge.metadata || {} };
    });
  }
  async function classify(line, metadata) {
    const productRef = line.price?.product || line.pricing?.price_details?.product;
    const p = productRef ? await product(productRef) : null;
    const m = p?.metadata || {};
    let group = "Uncategorized", type = p?.name || "Unknown purchase", unit = "units";
    const machine = mappings.machines.find(row => m.equipment_id && row.stripe_machine_id === m.equipment_id)
      || (metadata.reservation_type === "equipment" && mappings.machines.find(row => String(row.machine_id) === metadata.resource_id));
    const room = mappings.rooms.find(row => m.room_id && row.stripe_room_id === m.room_id)
      || (metadata.reservation_type === "rooms" && mappings.rooms.find(row => String(row.room_id) === metadata.resource_id));
    if (machine) { group = "Machine reservations"; type = machine.type; unit = "hours"; }
    else if (room) { group = "Studios"; type = room.type; unit = "months"; }
    else if (m.membership_type || metadata.membership_type || /membership|day pass/i.test(p?.name || "")) {
      group = "Memberships"; type = p?.name || metadata.membership_type; unit = "purchases";
    }
    if (group === "Uncategorized") warnings.add("Some purchases could not be mapped to a reporting category; their amounts remain included.");
    return { productId: id(p) || "unknown", group, type, unit };
  }
  const all = await collect(stripe.balanceTransactions.list({ limit: 100,
    created: { gte: period.startSeconds, lt: period.endSeconds } }));
  const ledger = [...new Map(all.map(t => [t.id, t])).values()];
  const currencies = new Map();
  function section(currency) {
    if (!currencies.has(currency)) currencies.set(currency, { currency, sales: [],
      machines: [...new Set(mappings.machines.map(machine => machine.type).filter(Boolean))]
        .map(type => ({ type, reservations: 0, hours: 0, fee: 0, net: 0 })), transactions: [],
      totals: { collected: 0, refunds: 0, disputes: 0, fees: 0, other: 0, netPaymentActivity: 0, payouts: 0, balanceChange: 0 }, discounts: 0, taxes: 0 });
    return currencies.get(currency);
  }
  async function enrich(t) {
    const category = t.reporting_category || t.type;
    let kind = "other", chargeId;
    if (["charge", "payment"].includes(category) || ["charge", "payment"].includes(t.type)) { kind = "collected"; chargeId = id(t.source); }
    else if (["refund", "refund_failure", "failed_refund", "partial_capture_reversal"].includes(category)
      || ["refund", "payment_refund", "refund_failure"].includes(t.type)) kind = "refunds";
    else if (/dispute/.test(category) || /dispute/.test(t.type)) kind = "disputes";
    else if (/^payout/.test(t.type)) kind = "payouts";
    else if (category === "fee" || ["stripe_fee", "stripe_fx_fee", "tax_fee"].includes(t.type)) kind = "fees";
    if (["refunds", "disputes"].includes(kind) && t.source) {
      const sourceId = id(t.source);
      if (sourceId.startsWith("re_")) {
        const refund = await cached(sourceId, () => stripe.refunds.retrieve(sourceId)); chargeId = id(refund.charge);
      } else if (sourceId.startsWith("dp_")) {
        const dispute = await cached(sourceId, () => stripe.disputes.retrieve(sourceId)); chargeId = id(dispute.charge);
      } else if (sourceId.startsWith("ch_")) chargeId = sourceId;
    }
    const details = chargeId ? await purchase(chargeId) : { lines: [], metadata: {} };
    const lines = [];
    for (const line of details.lines) {
      const discount = line.amount_discount ?? (line.discount_amounts || []).reduce((s, d) => s + d.amount, 0);
      const tax = line.amount_tax ?? (line.taxes || []).reduce((s, d) => s + (d.amount || 0), 0);
      const exclusiveTax = (line.taxes || []).filter(tax => tax.tax_behavior !== "inclusive").reduce((s, d) => s + (d.amount || 0), 0);
      const amount = line.amount_total ?? (line.subtotal != null ? line.subtotal - discount + exclusiveTax : line.amount ?? 0);
      lines.push({ ...await classify(line, details.metadata), quantity: Number(line.quantity_decimal ?? line.quantity ?? 0),
        weight: Math.max(0, amount), discount, tax, currency: line.currency });
    }
    return { t, kind, lines, checkoutId: details.checkoutId };
  }
  // Five workers bound concurrent enrichment; processing remains ledger ordered.
  const enriched = new Array(ledger.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(5, ledger.length) }, async () => {
    while (cursor < ledger.length) { const index = cursor++; enriched[index] = await enrich(ledger[index]); }
  }));
  const machineCheckouts = new Map();
  for (const { t, kind, lines, checkoutId } of enriched) {
    const s = section(t.currency), totals = s.totals;
    totals.balanceChange += t.net;
    totals.fees += t.fee;
    if (kind === "fees") totals.fees -= t.amount;
    else totals[kind] += t.amount;
    if (kind !== "payouts") totals.netPaymentActivity += t.net;
    const usable = lines.length && lines.every(l => l.currency === t.currency) && lines.some(l => l.weight > 0);
    const unknown = { productId: "unknown", group: "Uncategorized", type: "Unresolved payment", unit: "units", quantity: 0, weight: 1, discount: 0, tax: 0 };
    const lineTotal = lines.reduce((sum, line) => sum + line.weight, 0);
    const entries = usable ? [...lines] : [unknown];
    // Do not inflate billed units or silently spread amounts absent from line details.
    if (usable && kind === "collected" && t.amount > lineTotal) {
      entries.push({ ...unknown, type: "Unresolved difference", weight: t.amount - lineTotal });
      warnings.add("Some payments exceed their recorded product totals; the difference appears in Uncategorized.");
    }
    if (["collected", "refunds", "disputes"].includes(kind)) {
      if (!usable) warnings.add("Some financial amounts have no usable product details, including possible currency conversions; see Uncategorized.");
      const allocations = allocateCents(t.amount, entries.map(l => l.weight));
      const feeAllocations = allocateCents(t.fee, entries.map(l => l.weight));
      entries.forEach((line, index) => {
        let row = s.sales.find(r => r.productId === line.productId && r.group === line.group && r.type === line.type);
        if (!row) { row = { productId: line.productId, group: line.group, type: line.type, unit: line.unit, quantity: 0, collected: 0, refunds: 0, disputes: 0 }; s.sales.push(row); }
        row[kind] += allocations[index];
        if (kind === "collected") {
          // Partial invoice payments contribute a proportional quantity/discount/tax.
          const factor = usable ? Math.min(1, t.amount / lineTotal) : 0;
          row.quantity += line.quantity * factor;
        }
        if (line.group === "Machine reservations") {
          let machine = s.machines.find(row => row.type === line.type);
          if (!machine) {
            machine = { type: line.type, reservations: 0, hours: 0, fee: 0, net: 0 };
            s.machines.push(machine);
          }
          machine.fee -= feeAllocations[index];
          machine.net += allocations[index] - feeAllocations[index];
          if (kind === "collected") {
            machine.hours += line.quantity * (usable ? Math.min(1, t.amount / lineTotal) : 0);
            const key = `${t.currency}:${line.type}`;
            if (!machineCheckouts.has(key)) machineCheckouts.set(key, new Set());
            if (checkoutId) machineCheckouts.get(key).add(checkoutId);
            else warnings.add("Machine checkout counts exclude payments without a linked Checkout Session.");
            machine.reservations = machineCheckouts.get(key).size;
          }
        }
      });
      if (kind === "collected" && usable) {
        const factor = Math.min(1, t.amount / lineTotal);
        s.discounts += Math.round(entries.reduce((sum, l) => sum + l.discount, 0) * factor);
        s.taxes += Math.round(entries.reduce((sum, l) => sum + l.tax, 0) * factor);
      }
    }
    s.transactions.push({ id: t.id, source: id(t.source) || "", created: t.created, category: t.reporting_category || t.type,
      description: ["collected", "refunds", "disputes"].includes(kind)
        ? entries.map(l => `${l.group}: ${l.type}`).filter((v, i, a) => a.indexOf(v) === i).join("; ") : "",
      amount: t.amount, fee: t.fee, net: t.net });
  }
  if (!currencies.size) section("usd");
  for (const s of currencies.values()) {
    s.totals.revenue = s.totals.collected - s.taxes;
    s.sales.sort((a, b) => `${a.group}:${a.type}`.localeCompare(`${b.group}:${b.type}`));
    s.machines.sort((a, b) => a.type.localeCompare(b.type));
  }
  return { period, mode, currencies: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)), warnings: [...warnings] };
}
