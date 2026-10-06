# PixelTrim: organic search work, 2026-10-06

Goal requested by Nick: working public image converter and real organic search visitors. Codex owns independent functional/search checks and indexing work while Claude supervises the build in `C:/Users/Nick/Downloads/Stores/build-me-a-muw576gx`.

## What the research establishes

Searching `compress png to 200kb` and `webp to png transparent batch browser no upload` returns many dedicated, recently crawled converter pages. Examples include [LocalResizer](https://localresizer.com/compress-png-to-200kb/), [BrowserPix](https://browserpix.com/webp-to-png/), and [LimkaKit](https://limkakit.com/webp-to-png). These results establish existing competition and matching offers. They do not establish search volume, low keyword difficulty, or a likely overnight ranking. PixelTrim's STORE-LOG must label its demand assumptions accordingly.

Make the result visibly dependable: show the actual output format, measured dimensions and bytes, preserve transparency when the format supports it, and make the next step obvious. A working tool and a specific explanation of its limitations add value beyond repeating "free, private, no signup".

## Public launch checks

1. One crawlable page per distinct implemented workflow, with the usable tool at the top. Do not publish empty HEIC pages or many near-identical keyword variations.
2. Real production URL in canonical tags, sitemap, structured data and social metadata. Internal links must point to that same canonical structure.
3. Crawl with `node audit/2026-10-05/converter-search-check.cjs <production-url>`. This uses `audit=1` and an explicit audit user agent. Extend its functional assertions to match the actual UI once available.
4. Robots and sitemap must return correct content, not a generic HTML fallback. Confirm no accidental `noindex` or site-wide robots block.
5. Publish an IndexNow key file on the actual hostname, verify its content, then submit the real canonical URL list once. Log the response. [IndexNow's documentation](https://www.indexnow.org/documentation) says HTTP 200 means received, not indexed; 202 means key validation is pending.
6. Google discovery: add the sitemap to robots.txt. Use Search Console submission/URL inspection if authorized account access exists. Do not use the old sitemap ping URL: [Google retired it](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping). Google says [crawling can take days to weeks](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl); repeat requests do not buy faster indexing.

## Functional failures to catch before indexing

- **HEIC:** the official libheif sample fails native decoding in our installed Chromium. A tested browser decoder is required for that route; FileReader/Canvas alone does not establish HEIC support.
- **PNG size:** the PNG quality argument does not change the encoded bytes in our test. [Canvas quality applies to lossy encoders](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob). A 200KB claim must measure the result and disclose any resize or format switch.
- **Transparent PNG/WebP to JPEG:** flatten against the user's chosen background instead of silently producing black regions.
- **400x400 and passport:** use an explicit crop/pad choice, preserve proportions, and do not imply official passport acceptance from dimensions alone.
- **Corrupt or unsupported input:** show a useful error and permit another file, without a stuck loading state.
- **Privacy:** capture network requests while converting and confirm file bytes and filenames are never sent. A visitor counter may receive only the minimal documented metadata.

Test fixtures and their provenance: `converter-fixtures/manifest.json`. Compatibility evidence: `converter-native-capabilities.json`. These are audit inputs, not website artwork.

## Traffic measurements

Track total page views, likely human visits, search-referred visits, and conversions as separate counters. Search referral classification alone is not bot-proof; report that limit. Strip referrer paths/query strings and never store image contents, file names or full IP addresses. Exclude `audit=1`, known automation user agents, and local development from the main totals.

Demonstrate that the counter survives separate function invocations and deployment, rejects malformed events, and has a protected reporting endpoint. Mark all our verification events as tests. Keep crawler requests and IndexNow receipts separate from search visitors. Do not buy or simulate traffic or repeatedly search/click our own result to make the goal look achieved.

Current state at 04:06 UTC: no public URL yet; no actual visitors verified. Netlify connector asks for reauthentication, but the store agent has the saved Olympus Netlify connection. Search Console credentials are not present in Codex's environment. These facts may change during the build.
