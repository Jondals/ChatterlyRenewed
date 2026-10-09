/**
 * src/app/shared/util/link-preview.ts
 * Types and helpers of the link preview that a person decides to attach to a message: finding the link in a
 * text, checking that it is safe to draw as a link, shrinking the preview picture, and recognizing the links
 * that are videos which can be played inside the chat.
 */

/** Data of a link card. It travels encrypted inside the message (the server only sees it when asked for it). */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  site: string;
  /** Small picture as a data URL (optional). */
  image?: string;
}

/** Biggest width (in pixels) of the picture kept in a link card. */
const PREVIEW_IMAGE_WIDTH = 240;
const HTTPS_LINK = /https:\/\/[^\s<>"')\]]+/i;
const VIDEO_FILE = /\.(mp4|webm|ogv|mov|m4v)$/i;
/** Player options shared by the YouTube embeds. */
const YOUTUBE_OPTIONS = '?rel=0&modestbranding=1&playsinline=1';

/** First https link of a text (previews are only offered for https). */
export function firstLink(text: string): string | null {
  const found = HTTPS_LINK.exec(text)?.[0];
  if (!found) {
    return null;
  }
  try {
    return new URL(found.replace(/[.,;:!?]+$/, '')).toString();
  } catch {
    return null;
  }
}

/** Checks that an address is https before it is drawn as a link (never javascript: or data:). */
export function isSafeLink(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Shrinks the picture of a card to a small JPEG (about 240 px wide) so the encrypted message stays light. */
export function shrinkImage(dataUrl: string): Promise<string> {
  return new Promise<string>(function load(resolve) {
    const image = new Image();
    image.onload = function loaded() {
      const width = Math.min(PREVIEW_IMAGE_WIDTH, image.width);
      const height = Math.max(1, Math.round((image.height * width) / Math.max(1, image.width)));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = function failed() {
      resolve('');
    };
    image.src = dataUrl;
  });
}

/** A video that can be played inside a chat message. */
export interface VideoEmbed {
  /** Human readable name of the site (YouTube, Instagram...). */
  provider: string;
  /** "frame" is an embedded player on another site, "file" is a direct video file. */
  kind: 'frame' | 'file';
  /** Address of the player (frame) or of the video file. Always https. */
  src: string;
  /** CSS aspect ratio of the player ("16 / 9", "9 / 16"...). */
  ratio: string;
}

/** Builds the description of an embedded player. */
function frame(provider: string, src: string, ratio: string): VideoEmbed {
  return { provider, kind: 'frame', src, ratio };
}

/** True for the path segments that identify an Instagram post, reel or IGTV video. */
function isInstagramKind(part: string): boolean {
  return part === 'p' || part === 'reel' || part === 'reels' || part === 'tv';
}

/**
 * Works out whether a link is a video that can be played in the chat and, if so, how. Only well known sites
 * are recognized and the player address is built from identifiers that were checked against a strict
 * pattern, never from free text, so a link cannot smuggle in another address.
 */
/** True for Nitter (and similar) mirrors of X: their addresses carry the same status id. */
function isNitterHost(host: string): boolean {
  return (
    /^nitter\./.test(host) ||
    host === 'xcancel.com' ||
    host === 'twiiit.com' ||
    host === 'lightbrd.com'
  );
}

/**
 * The player address of a link of a video or music site, built only from identifiers that were checked, so no link can inject anything.
 */
export function videoEmbed(link: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|mobile)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const named = parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live';
    const id = named ? parts[1] : url.searchParams.get('v');
    return id && /^[\w-]{11}$/.test(id)
      ? frame(
          'YouTube',
          'https://www.youtube-nocookie.com/embed/' + id + YOUTUBE_OPTIONS,
          parts[0] === 'shorts' ? '9 / 16' : '16 / 9',
        )
      : null;
  }
  if (host === 'youtu.be') {
    return parts[0] && /^[\w-]{11}$/.test(parts[0])
      ? frame(
          'YouTube',
          'https://www.youtube-nocookie.com/embed/' + parts[0] + YOUTUBE_OPTIONS,
          '16 / 9',
        )
      : null;
  }
  if (host === 'vimeo.com') {
    const id = parts[parts.length - 1];
    return id && /^\d{5,12}$/.test(id)
      ? frame('Vimeo', 'https://player.vimeo.com/video/' + id + '?dnt=1', '16 / 9')
      : null;
  }
  if (host === 'instagram.com') {
    const index = parts.findIndex(isInstagramKind);
    const code = index >= 0 ? parts[index + 1] : '';
    return code && /^[\w-]{5,20}$/.test(code)
      ? frame(
          'Instagram',
          'https://www.instagram.com/' + parts[index] + '/' + code + '/embed',
          '4 / 5',
        )
      : null;
  }
  if (host === 'open.spotify.com') {
    const index = parts.findIndex(function kind(part) {
      return ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(part);
    });
    const id = index >= 0 ? parts[index + 1] : '';
    return id && /^[A-Za-z0-9]{10,30}$/.test(id)
      ? frame(
          'Spotify',
          'https://open.spotify.com/embed/' + parts[index] + '/' + id + '?theme=0',
          parts[index] === 'track' || parts[index] === 'episode' ? '9 / 4' : '11 / 12',
        )
      : null;
  }
  if (host === 'soundcloud.com' && parts.length >= 2) {
    return frame(
      'SoundCloud',
      'https://w.soundcloud.com/player/?color=%23ff5500&url=' +
        encodeURIComponent(url.origin + url.pathname),
      '9 / 4',
    );
  }
  if (host === 'streamable.com' && /^[a-z0-9]{4,10}$/.test(parts[parts.length - 1] ?? '')) {
    return frame('Streamable', 'https://streamable.com/e/' + parts[parts.length - 1], '16 / 9');
  }
  if (host === 'dailymotion.com' || host === 'dai.ly') {
    const id = host === 'dai.ly' ? parts[0] : parts[parts.indexOf('video') + 1];
    return id && /^[a-z0-9]{5,12}$/i.test(id)
      ? frame('Dailymotion', 'https://geo.dailymotion.com/player.html?video=' + id, '16 / 9')
      : null;
  }
  if (host === 'clips.twitch.tv' || (host === 'twitch.tv' && parts.includes('clip'))) {
    const id = host === 'clips.twitch.tv' ? parts[0] : parts[parts.indexOf('clip') + 1];
    return id && /^[\w-]{5,80}$/.test(id)
      ? frame(
          'Twitch',
          'https://clips.twitch.tv/embed?clip=' + id + '&parent=' + location.hostname,
          '16 / 9',
        )
      : null;
  }
  if (host === 'twitch.tv' && parts.length === 1 && /^\w{3,25}$/.test(parts[0])) {
    return frame(
      'Twitch',
      'https://player.twitch.tv/?channel=' + parts[0] + '&parent=' + location.hostname,
      '16 / 9',
    );
  }
  if (
    host === 'reddit.com' &&
    parts[0] === 'r' &&
    parts[2] === 'comments' &&
    /^\w{4,10}$/.test(parts[3] ?? '')
  ) {
    return frame(
      'Reddit',
      'https://embed.reddit.com/r/' +
        parts[1].replace(/[^\w]/g, '') +
        '/comments/' +
        parts[3] +
        '/?embed=true&theme=dark',
      '4 / 5',
    );
  }
  if (
    host === 'bsky.app' &&
    parts[0] === 'profile' &&
    parts[2] === 'post' &&
    /^\w{10,20}$/.test(parts[3] ?? '')
  ) {
    return frame(
      'Bluesky',
      'https://embed.bsky.app/embed/' +
        encodeURIComponent(parts[1]) +
        '/app.bsky.feed.post/' +
        parts[3],
      '4 / 5',
    );
  }
  if (isNitterHost(host)) {
    const index = parts.indexOf('status');
    const id = index >= 0 ? parts[index + 1].replace(/[^0-9]/g, '') : '';
    return id && /^\d{5,25}$/.test(id)
      ? frame(
          'X',
          'https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=dark&id=' + id,
          '4 / 5',
        )
      : null;
  }
  if (
    host === 'x.com' ||
    host === 'twitter.com' ||
    host === 'fixupx.com' ||
    host === 'vxtwitter.com' ||
    host === 'fxtwitter.com'
  ) {
    const index = parts.indexOf('status');
    const id = index >= 0 ? parts[index + 1] : '';
    return id && /^\d{5,25}$/.test(id)
      ? frame(
          'X',
          'https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=dark&id=' + id,
          '4 / 5',
        )
      : null;
  }
  if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
    const index = parts.indexOf('video');
    const id = index >= 0 ? parts[index + 1] : '';
    return id && /^\d{8,25}$/.test(id)
      ? frame('TikTok', 'https://www.tiktok.com/embed/v2/' + id, '9 / 16')
      : null;
  }
  if (VIDEO_FILE.test(url.pathname)) {
    return { provider: url.hostname, kind: 'file', src: url.toString(), ratio: '16 / 9' };
  }
  return null;
}
