# Station business model review (2026-10-05)

Nick wants genuinely different routes to low-touch income, with a store or small business built in one pass and managed by Station afterward. Olympus is a desktop app; customer-facing storefronts still need to work at phone width. Claude is running and repairing real builds. This review extends only the business-model data and leaves the live build alone.

## The distinction Station must keep

One pass can complete and verify a **business system**: a useful product or publication, a deployed site, working test payment and delivery, analytics, a traffic experiment, and a management log. It cannot create buyers, newsletter readers, ad approvals, a sponsor agreement, or guaranteed income in one pass. Report those as separate states. Never call an audience business monetized when it has only a signup form or an empty ad slot.

The eight existing models cover digital goods, tools, content, a directory, and POD. Four more routes were added to `storeModels.ts`: repeatable reports/data, paid alerts, lead generation, and a niche job board. These are real variety in **how they get paid**, but their launch gates differ:

| Route | First thing Station can genuinely finish | Revenue gate | Unattended-operation gate |
| --- | --- | --- | --- |
| Digital file or report | Original sample, full paid file, checkout and delivery test | A buyer with the exact problem | Proven source rights and update process for recurring reports |
| Small tool | Working free utility and paid export/unlock | Users who need that output | Error monitoring and support path for failed purchases |
| Paid alerts | Source checks, deduplication, sample alerts, opt-in list | Repeated accuracy and a buyer willing to pay | Scheduled runs, unsubscribe, and alert failure detection |
| POD | Real catalog and test purchase | Visitors and adequate margin | Supplier billing, live order handoff, tracking and refund path |
| Newsletter | Archive, signup, first issues, delivery tests | Real engaged readers and either paid subscriptions or eligible sponsors | A sender that permits API or scheduled publishing on the available plan |
| Lead generation | Useful matching pages and consented enquiry form | Signed buyer agreement and qualified enquiries | Verified recipient, consent records, spam controls, delivery monitoring |
| Job board | Real, current listings and search | Relevant job seekers and paying employers | Listing rights, expiry checks, employer validation, refund/support path |

For the next independent test after Claude's digital-download build, a **narrow paid report or data product** is the strongest change of route: it can sell to a small high-intent audience, and the agent can test the whole payment and file-delivery chain. A small utility with a paid export is next. An alerts product comes after scheduled runs are proven. Newsletter ads, lead-gen sales, and job-board postings belong later because they depend on a second party and real audience activity. These are prioritization hypotheses, not demand findings.

## Selection rule for an open-ended request

1. Generate at least one candidate from each revenue mechanism: one-time digital sale, recurring information, software utility, physical POD, and audience/lead business. Do not default to another sticker store merely because it is easy to render.
2. Reject a candidate if the agent cannot identify the source of value, a lawful/allowed input, the buyer, a credible acquisition channel, and a way to deliver without the owner operating it.
3. For each surviving candidate, gather dated evidence of buyer demand and alternatives. Record the links and what is *inferred* from them. A keyword or competitor page alone does not prove demand.
4. Prefer a model that can be tested end to end with current connections. An account approval, sponsor, or supplier card is an explicit launch gate, not something a polished website can substitute for.
5. Record an initial hypothesis and a measure: qualified enquiries, subscriber retention, report purchases, paid exports, product purchases, or repeat visits. With no visitors, the verdict is **no traffic yet**, not a failed product or a successful store.

## Model-specific acceptance examples

- **Report/data:** Show one original sample and exact methodology; trace every field to a source with reuse rights; verify a buyer can pay in test mode and receive the correct file; test the next update and a source failure.
- **Paid alerts:** Run the scheduler at least twice against a controlled source; prove no duplicate alerts, an unsubscribed address receives nothing, and failed delivery is visible.
- **Lead generation:** Do not monetize until a real partner has agreed to buy leads. Verify consent language, spam rejection, a test enquiry, and delivery/receipt with that partner. Avoid sensitive personal data.
- **Job board:** Link each job to a verified employer application page; record source permission and expiry; test a paid posting and automatic removal. Do not invent jobs or employers.
- **Newsletter ads:** Test signup, consent, unsubscribe, an actual send, archive, and analytics. Do not show an ad revenue estimate until offers and readers exist.
- **POD:** Check supplier cost and shipping from the connected account, then test checkout, webhook, supplier order creation in a safe environment, tracking, and margins. The supplier needs a billing method before fulfillment.

## Current external constraints checked

- [beehiiv's Ad Network FAQ](https://www.beehiiv.com/support/article/17507491038231-Ad-Network-FAQ) says the network requires a paid plan and active sending; direct sponsorship tooling is on higher plans. [The Create post API](https://developers.beehiiv.com/api-reference/posts/create) is also plan gated. A free newsletter stack must prove its own automated sending route before Station calls it autonomous.
- [Google AdSense eligibility](https://support.google.com/adsense/answer/9724/eligibility-requirements-for-adsense?hl=en-uk) requires original content and an audience; an empty ad slot is not a revenue stream. [Google's search guidance](https://developers.google.com/search/docs/essentials/spam-policies) also warns against scaled unoriginal pages and thin affiliate content. This is a reason to build fewer useful publications and tools, with source-backed original value.
- [Printful's API documentation](https://developers.printful.com/docs/) supports programmatic order creation and confirmation, but fulfillment requires billing. [Printful's payment guide](https://www.printful.com/payments-guide) explains the payment method/wallet requirement. A local test checkout alone does not prove a POD business can fulfill.

The Stripe Directory CLI was unavailable in this Windows workspace, and its public directory page did not load through the browsing tool. Vendor-specific claims above were checked against the vendors' primary documentation instead. No provider was provisioned or paid for during this review.
