# Kern marketing agent

An agent that runs Kern's Instagram account for free: it plans a week of posts, schedules and publishes the
ones you approve, hides spam, and answers comments. There are no dependencies, nothing to pay for, and it runs
on GitHub Actions (or on your own computer).

## What it does, and what it will not do

| It does | It will never |
| --- | --- |
| Draft posts from `config/brand.md` and `config/facts.json` | State anything outside the facts list |
| Schedule them into your posting slots | Publish a post you did not approve |
| Publish images, carousels and reels you approved, on time | Claim Kern is available, downloadable, priced or launched (while `publicLaunch` is false) |
| Reply to thanks and to questions the facts answer, within limits | Reply to hostile comments, or send links |
| Hide spam on your own posts | Like, follow, DM, or comment on other people's accounts (the API forbids it, and bots get accounts banned) |
| Read insights weekly and learn what works | Spend money. There are no ads here, only organic posting |

Everything is a **dry run** unless `LIVE=1`. A dry run reads from Instagram if you give it a token, and sends nothing.

## Setup (about 30 minutes, free)

1. **Instagram account.** Switch it to a Professional (Business or Creator) account in the Instagram app.
2. **Meta developer app.** At developers.facebook.com create an app, add the *Instagram API with Instagram Login*
   product, and add your account as an Instagram tester. Your own account can stay in development mode, so no
   app review is needed. Generate a long lived access token with the content publishing, comment management and
   insights permissions. Meta renames things now and then, so follow their current docs.
3. **A model.** Anything that speaks the OpenAI chat API works, so use whatever is free for you: a model on your
   own computer (Ollama or LM Studio, which is what Kern connects to), or a free hosted tier.
4. **Public repo.** Instagram downloads your images from a public URL. The images in `assets/` are served from this
   repository's raw URLs, so the repository must be public (or point `ASSET_BASE_URL` at any free public host).
5. **GitHub settings** (Settings, Secrets and variables, Actions):
   - Secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN`, and `LLM_API_KEY` if your model server needs one.
   - Variables: `IG_USERNAME`, `LLM_BASE_URL`, `LLM_MODEL`, and `MARKETING_ENABLED=true`.
   - Leave `MARKETING_LIVE` unset at first. Set it to `true` only after a dry run looks right.
   - Settings, Actions, General: allow GitHub Actions to create pull requests (the weekly plan arrives as one).
6. **Edit** `config/brand.md` (voice and rules), `config/facts.json` (the only things it may claim) and
   `config/policy.json` (time zone, posting slots, limits).

## How a week works

- **Sunday:** the agent reads last week's results (`state/insights.json`), drafts the week's posts, and opens a pull
  request. **Merging it approves every post in it.** Edit a caption in the files, delete a file to drop a post, or
  close the pull request to approve nothing.
- **Every hour:** it publishes approved posts whose time has come (never more than `maxPostsPerDay`, never a post
  more than `staleAfterHours` late), then looks at new comments on your recent posts.
- **Comments:** thanks and questions the facts answer are replied to automatically, up to the limits in
  `policy.json`. Spam is hidden. Hostile comments are left alone. Anything uncertain becomes a draft in
  `queue/replies/` that you approve or edit (`npm run approve`) and the next run sends.

## Commands

```bash
cd marketing
npm test                         # 24 tests with a mocked Instagram and a mocked model
npm run capture                  # makes the post images from the real website (needs website deps installed)
npm run plan                     # drafts posts as pending (needs LLM_BASE_URL and LLM_MODEL)
npm run approve                  # lists what is waiting
npm run approve -- post <id>     # approve a post
npm run approve -- reply <id> --text "Edited reply"
npm run publish                  # dry run unless LIVE=1
npm run engage                   # dry run unless LIVE=1
npm run report                   # weekly insights
npm run status
```

Environment: `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IG_USERNAME`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LIVE`,
`ASSET_BASE_URL`. Use `IG_API_HOST=graph.facebook.com` only if you use the Facebook Login flavour of the API.

## Limits to know about

- **Token expiry.** A long lived Instagram token lasts 60 days. When it expires the agent stops with an
  authentication error. Refresh it (the client has `refreshToken()`) and update the `IG_ACCESS_TOKEN` secret.
- **Hourly runs.** On a private repository GitHub gives 2,000 free Actions minutes a month; an hourly one minute
  run is well inside that. Public repositories are free without a limit.
- **No native scheduling.** Instagram's API cannot schedule posts, so this agent does the scheduling itself.
- **Reels need an MP4.** Add your own videos to `assets/` and list them in `assets/catalog.json` with
  `"type": "video"`. Images are generated for you by `npm run capture`.
- **Prompt injection.** A comment is untrusted text. It reaches the model as data, and the code, not the model,
  decides what may be sent: only the allowed intents, only replies that pass the rules, only answers grounded in
  `facts.json`, and only within the limits.
- **First live run.** Verified here against a mocked API, not a live account. Do the first live run on a test
  post and watch it; Meta's API versions and permission names change over time (set `IG_API_VERSION` to change the API version).
