const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_SECRET_ID || process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";
const RECENTLY_PLAYED_ENDPOINT = "https://api.spotify.com/v1/me/player/recently-played?limit=1";

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
    }
  });
}

function truncate(str, max = 28) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function getAccessToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
    }),
  });

  return response.json();
}

async function getPlayerData(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // 1. Try currently playing
  try {
    const nowPlayingRes = await fetch(NOW_PLAYING_ENDPOINT, { headers });
    if (nowPlayingRes.status === 200) {
      const data = await nowPlayingRes.json();
      if (data && data.item) {
        return {
          isPlaying: data.is_playing,
          title: data.item.name,
          artist: data.item.artists.map((a) => a.name).join(", "),
          albumArtUrl: data.item.album.images[0]?.url,
          statusText: data.is_playing ? "Now Playing" : "Paused",
        };
      }
    }
  } catch (e) {
    // continue to fallback
  }

  // 2. Fall back to recently played
  try {
    const recentRes = await fetch(RECENTLY_PLAYED_ENDPOINT, { headers });
    if (recentRes.status === 200) {
      const data = await recentRes.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0].track;
        return {
          isPlaying: false,
          title: item.name,
          artist: item.artists.map((a) => a.name).join(", "),
          albumArtUrl: item.album.images[0]?.url,
          statusText: "Recently Played",
        };
      }
    }
  } catch (e) {
    // handled below
  }

  return null;
}

function renderCard({ statusText, title, artist, imageBase64, isPlaying }) {
  const escapedTitle = escapeXml(truncate(title, 26));
  const escapedArtist = escapeXml(truncate(artist, 30));
  const escapedStatus = escapeXml(statusText);

  const imgElement = imageBase64
    ? `<image href="${imageBase64}" x="20" y="20" width="80" height="80" rx="12" preserveAspectRatio="xMidYMid slice" clip-path="url(#rounded-art)"/>`
    : `<rect x="20" y="20" width="80" height="80" rx="12" fill="#1f2937"/>
       <text x="60" y="66" text-anchor="middle" fill="#6b7280" font-size="28">🎧</text>`;

  const equalizerAnimation = isPlaying
    ? `
      @keyframes eq1 { 0%, 100% { height: 4px; y: 84px; } 50% { height: 16px; y: 72px; } }
      @keyframes eq2 { 0%, 100% { height: 16px; y: 72px; } 50% { height: 6px; y: 82px; } }
      @keyframes eq3 { 0%, 100% { height: 8px; y: 80px; } 50% { height: 18px; y: 70px; } }
      @keyframes eq4 { 0%, 100% { height: 14px; y: 74px; } 50% { height: 5px; y: 83px; } }
      .bar-1 { animation: eq1 1.0s ease-in-out infinite; }
      .bar-2 { animation: eq2 0.8s ease-in-out infinite; }
      .bar-3 { animation: eq3 1.1s ease-in-out infinite; }
      .bar-4 { animation: eq4 0.9s ease-in-out infinite; }
    `
    : `
      .bar-1 { height: 4px; y: 84px; }
      .bar-2 { height: 4px; y: 84px; }
      .bar-3 { height: 4px; y: 84px; }
      .bar-4 { height: 4px; y: 84px; }
    `;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120" fill="none">
    <style>
      .bg { fill: #0d1117; stroke: #4c1d95; stroke-width: 1.5; rx: 14px; }
      .heading { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; font-weight: 700; fill: #22d3ee; letter-spacing: 1.2px; text-transform: uppercase; }
      .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; font-weight: 600; fill: #9ca3af; }
      .artist { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; font-weight: 400; fill: #ffffff; }
      .bar { fill: #1db954; width: 3px; rx: 1.5px; }
      ${equalizerAnimation}
    </style>
    <clipPath id="rounded-art">
      <rect x="20" y="20" width="80" height="80" rx="12" />
    </clipPath>

    <!-- Background card -->
    <rect width="400" height="120" class="bg"/>

    <!-- Album Art -->
    ${imgElement}

    <!-- Content -->
    <text x="114" y="38" class="heading">${escapedStatus} 🎧</text>
    <text x="114" y="60" class="title">${escapedTitle}</text>
    <text x="114" y="79" class="artist">${escapedArtist}</text>

    <!-- Equalizer Bars -->
    <g transform="translate(114, 0)">
      <rect x="0" width="3" class="bar bar-1" />
      <rect x="6" width="3" class="bar bar-2" />
      <rect x="12" width="3" class="bar bar-3" />
      <rect x="18" width="3" class="bar bar-4" />
    </g>
  </svg>
  `.trim();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const tokenData = await getAccessToken();
    const access_token = tokenData.access_token;
    if (!access_token) {
      throw new Error("Could not acquire access token: " + JSON.stringify(tokenData));
    }

    const player = await getPlayerData(access_token);

    if (!player) {
      const svg = renderCard({
        statusText: "Offline",
        title: "Nothing playing right now",
        artist: "Spotify",
        imageBase64: null,
        isPlaying: false,
      });
      return res.status(200).send(svg);
    }

    let imageBase64 = null;
    if (player.albumArtUrl) {
      try {
        const imgRes = await fetch(player.albumArtUrl);
        const buffer = await imgRes.arrayBuffer();
        imageBase64 = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
      } catch {
        imageBase64 = null;
      }
    }

    const svg = renderCard({ ...player, imageBase64 });
    return res.status(200).send(svg);
  } catch (err) {
    const errorSvg = renderCard({
      statusText: "Offline",
      title: "Unable to reach Spotify",
      artist: "Check Vercel env vars",
      imageBase64: null,
      isPlaying: false,
    });
    return res.status(200).send(errorSvg);
  }
}
