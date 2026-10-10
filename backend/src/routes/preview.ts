/**
 * src/routes/preview.ts
 * Link previews (title, description and image) on request, with protection against SSRF.
 */
import type { FastifyInstance } from 'fastify';
import { lookup as dnsLookup } from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import type { AppContext } from '../context';

const MAX_HTML = 400 * 1024;
const MAX_IMAGE = 300 * 1024;
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
/** The longest `<meta>` tag read. Bounding it keeps the scan linear even on hostile pages. */
const MAX_TAG = 2000;

/** ! Ranges the server must never connect to: private, loopback, link-local, shared, documentation, multicast, reserved. */
const BLOCKED = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(address, prefix, 'ipv6');
}

/**
 * True when an address is private, local or reserved (the server must never connect to those). IPv4 addresses
 * written inside IPv6 (`::ffff:127.0.0.1`, `::ffff:7f00:1`) are judged by their IPv4 rules.
 *
 * @param ip An IPv4 or IPv6 literal, with or without the brackets of a URL.
 */
export function isPrivateAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '');
  const family = net.isIP(bare);
  if (family === 0) return true;
  return BLOCKED.check(bare, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * ! Checks that a URL may be fetched by the server: https only, no credentials, the standard port, and (when the host is
 * an IP literal, which skips name resolution) a public address. Throws with a short reason otherwise.
 *
 * Names are not resolved here: that is done when connecting (see `safeLookup`), so a name that changes its address
 * between the check and the connection does not work either.
 */
export function assertFetchable(url: URL): void {
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('url_not_allowed');
  if (url.port && url.port !== '443') throw new Error('port_not_allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateAddress(host)) throw new Error('address_not_allowed');
}

/**
 * Name resolution that runs right when connecting: a private real address is refused.
 * That way a name that changes its address between the check and the connection does not work either.
 */
function safeLookup(host: string, options: unknown, callback: (...args: unknown[]) => void): void {
  const wantsAll =
    typeof options === 'object' && options !== null && (options as { all?: boolean }).all === true;
  dnsLookup(host, { all: true }, function onResolved(error, addresses) {
    if (error) return callback(error);
    const allowed = addresses.filter(function isPublic(entry) {
      return !isPrivateAddress(entry.address);
    });
    if (!allowed.length) return callback(new Error('address_not_allowed'));
    if (wantsAll) return callback(null, allowed);
    return callback(null, allowed[0]!.address, allowed[0]!.family);
  });
}

interface Reply {
  status: number;
  type: string;
  body: Buffer;
  location: string;
}

/** Downloads an https URL with limits on size and time and a safe name resolution. It does not follow redirects. */
function download(url: URL, maxBytes: number): Promise<Reply> {
  return new Promise(function executor(resolve, reject) {
    const req = https.request(
      url,
      {
        method: 'GET',
        timeout: TIMEOUT_MS,
        lookup: safeLookup as never,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; ChatterlyPreview/1.2; +link preview)',
          accept: 'text/html,image/*;q=0.8',
          'accept-language': 'en,es;q=0.8',
        },
      },
      function onResponse(res) {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', function onData(chunk: Buffer) {
          total += chunk.length;
          if (total > maxBytes) {
            // When the limit is reached the download stops: for HTML the beginning is enough, an image is discarded.
            res.destroy();
            resolve({
              status: res.statusCode ?? 0,
              type: String(res.headers['content-type'] ?? ''),
              body: Buffer.concat(chunks),
              location: '',
            });
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', function onEnd() {
          resolve({
            status: res.statusCode ?? 0,
            type: String(res.headers['content-type'] ?? ''),
            body: Buffer.concat(chunks),
            location: String(res.headers['location'] ?? ''),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', function onTimeout() {
      req.destroy(new Error('timed_out'));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Follows up to 3 redirects, checking every target (https only, public addresses). */
async function fetchFollowing(first: URL, maxBytes: number): Promise<Reply> {
  let url = first;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    assertFetchable(url);
    const reply = await download(url, maxBytes);
    if (reply.status >= 300 && reply.status < 400 && reply.location) {
      url = new URL(reply.location, url);
      continue;
    }
    return reply;
  }
  throw new Error('too_many_redirects');
}

/** Turns the HTML entities of a title or a description into plain text. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function fromCode(_match, digits: string) {
      return String.fromCodePoint(Math.min(Number(digits), 0x10ffff));
    })
    .trim();
}

/**
 * ! Reads the `<meta>` tags of a page in one pass: name (or property) to content, first one wins. The pattern cannot
 * cross a `<`, so every attempt ends at the next tag: the cost grows with the size of the page, never with its square
 * (a page made of thousands of unclosed `<meta` could otherwise block the whole server).
 */
export function metaTags(html: string): Map<string, string> {
  const found = new Map<string, string>();
  const tags = html.matchAll(new RegExp(`<meta\\s[^<>]{1,${MAX_TAG}}>`, 'gi'));
  for (const match of tags) {
    const key = /(?:property|name)=["']([^"']{1,100})["']/i.exec(match[0])?.[1];
    const content = /content=["']([^"']*)["']/i.exec(match[0])?.[1];
    if (key && content && !found.has(key.toLowerCase()))
      found.set(key.toLowerCase(), decodeEntities(content));
  }
  return found;
}

/** oEmbed address of the sites that give no good metadata in their HTML (YouTube and Spotify ask for consent). */
function oembedUrl(target: URL): URL | null {
  const host = target.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  if (host === 'youtube.com' || host === 'youtu.be')
    return new URL(
      'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(target.toString()),
    );
  if (host === 'open.spotify.com')
    return new URL('https://open.spotify.com/oembed?url=' + encodeURIComponent(target.toString()));
  return null;
}

/** Downloads an image and returns it as a data URL, or '' when it is not valid or too big. */
async function imageAsDataUrl(url: URL): Promise<string> {
  try {
    const img = await fetchFollowing(url, MAX_IMAGE);
    if (
      img.status < 400 &&
      /^image\/(png|jpeg|webp|gif)/i.test(img.type) &&
      img.body.length > 0 &&
      img.body.length < MAX_IMAGE
    ) {
      return `data:${img.type.split(';')[0]};base64,${img.body.toString('base64')}`;
    }
  } catch {
    /* without an image the card is still shown */
  }
  return '';
}

/**
 * Link previews. It is only called when the person asks for it for one message: the server sees that
 * link (nothing else) and returns title, description and image, which the client puts encrypted in the message.
 */
export function registerPreviewRoutes(app: FastifyInstance, _ctx: AppContext): void {
  const auth = { onRequest: [app.authenticate] };

  app.get(
    '/api/preview',
    {
      ...auth,
      config: { rateLimit: { max: 20, timeWindow: 60_000 } },
      schema: {
        querystring: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string', maxLength: 600 } },
        },
      },
    },
    /**
     * GET /api/preview: title, description and picture of an https link, fetched with every protection against reaching the server's own network.
     */
    async function (req, reply) {
      const { url } = req.query as { url: string };
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        return reply.code(400).send({ error: 'invalid_url' });
      }
      if (target.protocol !== 'https:') return reply.code(400).send({ error: 'https_only' });
      try {
        const oembed = oembedUrl(target);
        if (oembed) {
          const r = await fetchFollowing(oembed, 64 * 1024).catch(function failed() {
            return null;
          });
          if (r && r.status < 400) {
            try {
              const data = JSON.parse(r.body.toString('utf8')) as {
                title?: string;
                author_name?: string;
                provider_name?: string;
                thumbnail_url?: string;
              };
              if (data.title) {
                const thumbnail = data.thumbnail_url
                  ? await imageAsDataUrl(new URL(data.thumbnail_url))
                  : '';
                return {
                  url: target.toString(),
                  title: data.title.slice(0, 160),
                  description: (data.author_name ?? '').slice(0, 280),
                  site: (data.provider_name ?? target.hostname).slice(0, 60),
                  image: thumbnail,
                };
              }
            } catch {
              /* if the JSON is not usable the HTML is tried */
            }
          }
        }
        const page = await fetchFollowing(target, MAX_HTML);
        if (page.status >= 400 || !/text\/html|application\/xhtml/i.test(page.type))
          return reply.code(422).send({ error: 'no_preview' });
        const html = page.body.toString('utf8');
        const tags = metaTags(html);
        const title =
          tags.get('og:title') ||
          tags.get('twitter:title') ||
          decodeEntities(/<title[^<>]{0,200}>([^<]{0,2000})<\/title>/i.exec(html)?.[1] ?? '');
        const description =
          tags.get('og:description') ||
          tags.get('twitter:description') ||
          tags.get('description') ||
          '';
        const site = tags.get('og:site_name') || target.hostname.replace(/^www\./, '');
        if (!title && !description) return reply.code(422).send({ error: 'no_preview' });
        let image = '';
        const imageUrl = tags.get('og:image') || tags.get('twitter:image');
        if (imageUrl) {
          try {
            image = await imageAsDataUrl(new URL(imageUrl, target));
          } catch {
            /* without an image the card is still shown */
          }
        }
        return {
          url: target.toString(),
          title: title.slice(0, 160),
          description: description.slice(0, 280),
          site: site.slice(0, 60),
          image: image,
        };
      } catch {
        return reply.code(502).send({ error: 'preview_failed' });
      }
    },
  );
}
