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

/** True when an IPv4 address is private, local, shared, documentation, benchmarking or reserved. */
function privateV4(a: number, b: number, c: number): boolean {
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c <= 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** True when an address is private, local or reserved (the server must never connect to those). */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number) as [number, number, number];
    return privateV4(a, b, c);
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return true;
  // IPv4 inside IPv6, written with dots (::ffff:127.0.0.1) or in hexadecimal (::ffff:7f00:1, ::127.0.0.1).
  const dotted = /^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (dotted) return isPrivateAddress(dotted[1]!);
  const hex = /^(?:::ffff:|::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (hex) {
    const high = parseInt(hex[1]!, 16);
    const low = parseInt(hex[2]!, 16);
    return privateV4(high >> 8, high & 255, low >> 8);
  }
  return (
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('fec') ||
    v6.startsWith('ff') ||
    v6.startsWith('64:ff9b:') ||
    v6.startsWith('2002:') ||
    v6.startsWith('2001:db8') ||
    v6.startsWith('2001::')
  );
}

/**
 * Name resolution that runs right when connecting: a private real address is refused.
 * That way a name that changes its address between the check and the connection does not work either.
 */
function safeLookup(host: string, opciones: unknown, callback: (...args: unknown[]) => void): void {
  const todas =
    typeof opciones === 'object' &&
    opciones !== null &&
    (opciones as { all?: boolean }).all === true;
  dnsLookup(host, { all: true }, function (error, direcciones) {
    if (error) return callback(error);
    const buenas = direcciones.filter(function (d) {
      return !isPrivateAddress(d.address);
    });
    if (!buenas.length) return callback(new Error('direccion_no_permitida'));
    if (todas) return callback(null, buenas);
    return callback(null, buenas[0]!.address, buenas[0]!.family);
  });
}

interface Reply {
  status: number;
  tipo: string;
  cuerpo: Buffer;
  ubicacion: string;
}

/** Downloads an https URL with limits on size and time and a safe name resolution. It does not follow redirects. */
function download(url: URL, maxBytes: number): Promise<Reply> {
  return new Promise(function (resolve, reject) {
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
      function (res) {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', function (trozo: Buffer) {
          total += trozo.length;
          if (total > maxBytes) {
            // When the limit is reached the download stops: for HTML the beginning is enough, an image is discarded.
            res.destroy();
            resolve({
              status: res.statusCode ?? 0,
              tipo: String(res.headers['content-type'] ?? ''),
              cuerpo: Buffer.concat(chunks),
              ubicacion: '',
            });
            return;
          }
          chunks.push(trozo);
        });
        res.on('end', function () {
          resolve({
            status: res.statusCode ?? 0,
            tipo: String(res.headers['content-type'] ?? ''),
            cuerpo: Buffer.concat(chunks),
            ubicacion: String(res.headers['location'] ?? ''),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', function () {
      req.destroy(new Error('tiempo_agotado'));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Sigue to 3 redirecciones, comprobando cada target (solo https). */
async function fetchFollowing(inicial: URL, maxBytes: number): Promise<Reply> {
  let url = inicial;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('url_no_permitida');
    if (net.isIP(url.hostname) && isPrivateAddress(url.hostname))
      throw new Error('direccion_no_permitida');
    const r = await download(url, maxBytes);
    if (r.status >= 300 && r.status < 400 && r.ubicacion) {
      url = new URL(r.ubicacion, url);
      continue;
    }
    return r;
  }
  throw new Error('demasiadas_redirecciones');
}

/** Turns the HTML entities of a title or a description into plain text. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_m, n: string) {
      return String.fromCodePoint(Math.min(Number(n), 0x10ffff));
    })
    .trim();
}

/** Finds the content of a <meta> tag by its name or property. */
function meta(html: string, clave: string): string {
  const patron = new RegExp(`<meta[^>]+(?:property|name)=["']${clave}["'][^>]*>`, 'i');
  const etiqueta = patron.exec(html)?.[0];
  if (!etiqueta) return '';
  const contenido = /content=["']([^"']*)["']/i.exec(etiqueta)?.[1];
  return contenido ? decodeEntities(contenido) : '';
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
      /^image\/(png|jpeg|webp|gif)/i.test(img.tipo) &&
      img.cuerpo.length > 0 &&
      img.cuerpo.length < MAX_IMAGE
    ) {
      return `data:${img.tipo.split(';')[0]};base64,${img.cuerpo.toString('base64')}`;
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
          const r = await fetchFollowing(oembed, 64 * 1024).catch(function () {
            return null;
          });
          if (r && r.status < 400) {
            try {
              const data = JSON.parse(r.cuerpo.toString('utf8')) as {
                title?: string;
                author_name?: string;
                provider_name?: string;
                thumbnail_url?: string;
              };
              if (data.title) {
                const miniatura = data.thumbnail_url
                  ? await imageAsDataUrl(new URL(data.thumbnail_url))
                  : '';
                return {
                  url: target.toString(),
                  title: data.title.slice(0, 160),
                  description: (data.author_name ?? '').slice(0, 280),
                  site: (data.provider_name ?? target.hostname).slice(0, 60),
                  image: miniatura,
                };
              }
            } catch {
              /* if the JSON is not usable the HTML is tried */
            }
          }
        }
        const pagina = await fetchFollowing(target, MAX_HTML);
        if (pagina.status >= 400 || !/text\/html|application\/xhtml/i.test(pagina.tipo))
          return reply.code(422).send({ error: 'no_preview' });
        const html = pagina.cuerpo.toString('utf8');
        const titulo =
          meta(html, 'og:title') ||
          meta(html, 'twitter:title') ||
          decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '');
        const descripcion =
          meta(html, 'og:description') ||
          meta(html, 'twitter:description') ||
          meta(html, 'description');
        const sitio = meta(html, 'og:site_name') || target.hostname.replace(/^www\./, '');
        if (!titulo && !descripcion) return reply.code(422).send({ error: 'no_preview' });
        let image = '';
        const urlImagen = meta(html, 'og:image') || meta(html, 'twitter:image');
        if (urlImagen) {
          try {
            const img = await fetchFollowing(new URL(urlImagen, target), MAX_IMAGE);
            if (
              img.status < 400 &&
              /^image\/(png|jpeg|webp|gif)/i.test(img.tipo) &&
              img.cuerpo.length > 0 &&
              img.cuerpo.length < MAX_IMAGE
            ) {
              image = `data:${img.tipo.split(';')[0]};base64,${img.cuerpo.toString('base64')}`;
            }
          } catch {
            /* without an image the card is still shown */
          }
        }
        return {
          url: target.toString(),
          title: titulo.slice(0, 160),
          description: descripcion.slice(0, 280),
          site: sitio.slice(0, 60),
          image: image,
        };
      } catch {
        return reply.code(502).send({ error: 'preview_failed' });
      }
    },
  );
}
