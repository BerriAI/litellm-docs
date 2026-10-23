# Workshop signup relay

The workshop form posts to `/api/workshop/signup`, a Vercel Node function. The function validates the answers and sends a JSON event to the workshop's Zapier Catch Hook. The shared sales form is unchanged.

Set `WORKSHOP_ZAPIER_WEBHOOK_URL` in the Vercel project for the environments that should accept signups, then redeploy. Use the HTTPS Catch Hook URL copied from Zapier. Keep it server-only; do not place it in client code, Docusaurus `customFields`, or committed files. Preview deployments can use a separate test Zap.

Publish the Zap and map the flat event fields to the destination: `event`, `name`, `email`, `company`, `linkedin`, `workflow`, `onsiteInterest`, `submissionId`, `workshop`, `dates`, `format`, and `source`. For Slack, map the derived `slackMessage` field as the message text and set “Link usernames” to No. The message escapes `&`, `<`, and `>` in user answers; individual answer fields remain unchanged. Use `submissionId` as the downstream deduplication key. Retries retain that ID; the relay does not retry automatically or provide durable deduplication. Verify a labeled test signup in the final destination before launch. A webhook HTTP success confirms receipt, not completion of later Zap steps.

The production origin is `https://docs.litellm.ai`. Vercel's deployment, branch, and production URL environment variables allow exact preview origins. `DOCS_ORIGIN` can configure another HTTPS origin. Plain HTTP is accepted only from a local loopback connection outside Vercel. Source URLs must match the request origin; query strings and fragments are removed before forwarding.

The handler limits JSON bodies to 16 KiB and allows eight active submissions, 60 requests per minute, and five attempts per email per minute in each function instance. These are best-effort limits, not a distributed rate limiter. The upstream timeout is eight seconds. No submission data or webhook values are logged.

Use `vercel dev` for local form integration; Docusaurus's static dev server does not run `api/` functions. The unit tests mock the webhook and send no real submissions:

```sh
npm run test:workshop
```
