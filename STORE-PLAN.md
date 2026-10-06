# Store plan: what Station should launch

Written 2026-10-05. Constraints: Shopify and Stripe only, no Etsy or Pinterest, the owner does no
shipping, support, or disputes. Everything here is a hypothesis the agent must validate with research
before committing (see the brief); none of it is a promise of income.

## Free route (decided 2026-10-05: no monthly fee)

Shopify cannot be free and sell for real (a development store only takes test orders), so the launch stack is:
free host (Netlify, Cloudflare Pages or Vercel) + Stripe Checkout through a serverless function + a webhook
that orders from the Printful API (or emails a download link for digital). Fixed cost $0. Per sale: Stripe's fee
and Printful's price for that order. One-time owner steps: a free host account and token, Printful card on file
(an order is charged when it is placed), and Stripe account activation (identity and bank). Shopify below only
applies if the owner ever chooses to pay for a plan.

## Business models Station can choose from (2026-10-05)

The data lives in `lantern/src/services/storeModels.ts` and is injected into the brief. Twelve routes now cover
digital printables, templates and spreadsheets, paid guides, small paid web tools, newsletters, review sites,
directories, print on demand, original reports/data, paid alerts, lead generation, and niche job boards. Each
route has different launch gates; see `audit/2026-10-05/business-model-review.md` before calling one complete.

Newsletters and content sites make money from sponsors, affiliate links and ads, but ad networks and affiliate
programs want a real audience and may require approval or a paid plan. The agent builds the audience first
(pages worth finding by search plus an email signup), tests an owned paid product or tier when payments are
connected, and lists each unavailable approval or advertiser agreement as a launch gate. Do not depend on the
owner selling sponsor slots: that is ongoing owner work. Expect many months before any income.

## Design themes

Twelve distinct themes (paper editorial, Swiss grid, soft pastel, dark luxe, retro seventies, botanical studio,
hand drawn notebook, brutalist mono, Nordic minimal, Y2K gloss, field guide, newsprint), each with a real
palette, type, layout and motion. The agent picks one that fits the niche and must not reuse a theme another
store already has.

## What each tool actually does

| Need | Answer | One-time owner step |
|---|---|---|
| Hosting, checkout, payments, disputes | Shopify itself (Shopify Payments is Stripe-powered and available in Canada). A separate Stripe key is not needed. | Paid Shopify plan (about US$29/month). A free dev store cannot take real orders. |
| Catalogue, pages, theme, pricing | Agent, through the Admin API | Create a custom app, grant products/orders/themes, paste the token into Connections |
| Physical products (stickers, posters, mugs) | Print on demand through Printful or Printify; they print and ship each order | Install the app on the Shopify store, add a card |
| Digital products | Shopify's free Digital Downloads app; file delivered by link after payment | Install the app |
| Visitors | Google free product listings (Shopify's Google and YouTube channel), search-friendly pages and guides, email capture | Connect the Google channel |

Each Shopify store is a separate monthly bill, so start with **one store**, not five.

## Store types, ranked for "autonomous, no shipping, no disputes"

1. **Digital printables (best fit).** Planners, trackers, worksheets, wall art, templates. The agent can
   create the entire product itself as code (SVG to PDF), delivery is automatic, margin is near 100%, there
   is nothing to ship, and refunds and disputes are rare. Weakness: crowded, and needs search traffic.
2. **Print-on-demand in one tight niche.** Stickers, posters, tote bags, mugs. Fulfilment is automatic but
   margins are thin (a sticker sells for about $4 and costs about $2 to make and ship) and it is crowded.
3. **Hybrid in one niche.** Printable plus matching stickers and a poster, so one visitor buys several
   things. Best long-term shape, built after the first two work.
4. **Avoid: classic dropshipping from marketplaces.** Slow shipping, quality problems, refunds, and
   chargebacks all land on you, which is the opposite of hands-off.

## Starting niches to validate (the agent must test demand before choosing)

- ADHD-friendly planners and routines (steady search demand, evergreen)
- Budget, debt and savings trackers
- Teacher classroom printables
- Habit and mood trackers, journaling prompts
- Cozy reading sets: reading log, bookmarks, stickers
- Wedding and event stationery templates

## Recommended first store

One Shopify store, one niche, digital first. Open with 12 to 20 printables and a bundle, add a matching
sticker or poster line through print on demand only once the digital side has visitors. Pick the niche from
real research, not from this list.

## Honest economics

- A new store with no visitors earns nothing, whatever else is perfect. Traffic is the hard part and is slow
  without paid ads or social. Free paths: Google listings, pages and guides that rank, email list.
- Illustration only: 1,000 visits a month at about 1% conversion is about 10 orders. At $8 a printable that
  is around $80, minus the Shopify subscription. It takes months to reach even that.
- "Passive" here means low effort, not guaranteed income.

## What Station does once connected

Research and choose the niche, log the evidence in STORE-LOG.md, build products, price above cost, publish
on Shopify, verify the live pages, then each 24/7 pass: add or test one thing, record the result, drop what
fails, and expand what works.

## Owner checklist (one time)

1. Paid Shopify plan, plus a custom app with an Admin API token saved in Connections.
2. Install Digital Downloads (and Printful or Printify if physical products are wanted).
3. Connect Shopify's Google and YouTube channel.
4. Confirm payouts and identity in Shopify Payments.
