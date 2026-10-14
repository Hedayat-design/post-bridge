/**
 * Link removal for X captions.
 *
 * X charges significantly more for — and demotes — posts that carry an
 * outbound link, so a caption written once for every platform should not drag
 * an X post down. Links are stripped from the tweet body; the recommended
 * place for the URL is a reply (see `first_comment`) or the account bio.
 *
 * Only X gets this treatment. Every other platform keeps its links.
 */

/**
 * Bare domains are matched against an explicit TLD list rather than a generic
 * "dot something" pattern, because prose is full of things that look like
 * domains to a loose regex ("Node.js", "e.g.", "P.S. Come in"). A missed
 * exotic TLD leaves a link in a tweet; an over-eager pattern silently eats
 * words out of the caption, which is much worse.
 */
const TLDS = [
  // generic
  'com', 'org', 'net', 'int', 'edu', 'gov', 'mil', 'info', 'biz', 'pro',
  // common new gTLDs
  'io', 'co', 'dev', 'app', 'ai', 'xyz', 'tech', 'cloud', 'store', 'online',
  'site', 'website', 'space', 'blog', 'design', 'studio', 'agency', 'media',
  'news', 'live', 'life', 'world', 'shop', 'page', 'link', 'fyi', 'wiki',
  'tv', 'gg', 'sh', 'ly', 'me', 'cc', 'so', 'to', 'at', 'be',
  // country codes seen on product sites
  'us', 'uk', 'ca', 'de', 'fr', 'es', 'it', 'nl', 'eu', 'au', 'nz', 'in',
  'jp', 'kr', 'cn', 'br', 'mx', 'ru', 'ch', 'se', 'no', 'fi', 'dk', 'pl',
  'cz', 'pt', 'gr', 'tr', 'za', 'ie', 'il', 'sg', 'hk', 'ae',
]

const SCHEME_URL = /\bhttps?:\/\/\S+/gi
const WWW_URL = /\bwww\.\S+/gi

/**
 * A bare domain, optionally with a path. The lookbehind keeps us out of email
 * addresses (`support@post-bridge.com`) and out of the middle of a longer
 * token, either of which would be mangled rather than cleanly removed. The
 * hyphen in that lookbehind matters: without it a match could start at the
 * `bridge.com` inside `support@post-bridge.com`, leaving `support@post-`.
 */
const BARE_DOMAIN = new RegExp(
  String.raw`(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${TLDS.join('|')})\b(?:\/\S*)?`,
  'gi'
)

/**
 * Removes links from a caption and tidies the whitespace they leave behind.
 * Returns the cleaned caption; a caption that was nothing but a link comes
 * back empty, and the caller's own validation then rejects it rather than
 * posting a blank tweet.
 */
export function stripLinks(caption: string): string {
  const withoutLinks = caption
    .replace(SCHEME_URL, '')
    .replace(WWW_URL, '')
    .replace(BARE_DOMAIN, '')

  return (
    withoutLinks
      // collapse runs of spaces/tabs a removed link left mid-line
      .replace(/[ \t]{2,}/g, ' ')
      // drop spaces that now sit just before punctuation
      .replace(/[ \t]+([,.!?;:])/g, '$1')
      // tidy trailing spaces on each line, and runs of blank lines
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/** True when the caption contains something stripLinks would remove. */
export function containsLink(caption: string): boolean {
  return stripLinks(caption) !== caption.trim()
}
