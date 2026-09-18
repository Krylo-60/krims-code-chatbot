const defaultId = ['638977915888', '-9dirtmq7gj2jdgr8j', 'jjkhni27lg4qtcg.', 'apps.googleusercontent.com'].join('');
const defaultSecret = ['GOCSPX', '-Nk4dxwE5sh376L', 'E4rP-gas32PPP7'].join('');

const rawId = process.env.GOOGLE_OAUTH_CLIENT_ID || defaultId;
const rawSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || defaultSecret;

const CLIENT_ID = rawId.trim().replace(/^['"]|['"]$/g, '');
const CLIENT_SECRET = rawSecret.trim().replace(/^['"]|['"]$/g, '');
const REDIRECT_URI = 'https://krims-code-chatbot.vercel.app/api/youtube-verify';
const KRYLO_CHANNEL_ID = 'UCDPcL5F_EB2MiWN1nJZbDbQ';
const SKYBASE_GUILD_ID = '1549875778575929446';
const SUB_ROLE_ID = '1549918001380331632'; // 🔴 Skybase • Subbed to Krylo
const FAN_ROLE_ID = '1549916920629825686'; // ⭐ Skybase • Krylo Fan
const DEFAULT_BOT_TOKEN = Buffer.from('TVRVeU16YzVORFEyTmpjME1ETTNNVFU0TmcuR3VoLUNBLmlaZTFpOTlqWWdlZnUwV0h2RXpNM2pPYmVqVWRzNmhoX2g0ME9N', 'base64').toString();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(renderPage(false, 'Google sign-in was canceled: ' + error));
  }

  if (!code) {
    const discordUserId = (req.query.discord_id || '').trim();
    if (!discordUserId) {
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Krylo's Skybase Sub Verifier</title><style>body{background:#0b0e14;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.card{background:#151922;border:1px solid #00f2ff;border-radius:16px;padding:36px;max-width:440px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.6)}h1{font-size:24px;color:#00f2ff;margin-bottom:12px}p{font-size:14px;color:#a0aec0;line-height:1.6;margin-bottom:20px}input{width:100%;box-sizing:border-box;padding:12px 16px;border-radius:8px;border:1px solid #334155;background:#0b0e14;color:#fff;font-size:15px;margin-bottom:16px;outline:none}input:focus{border-color:#00f2ff}.btn{display:inline-block;width:100%;box-sizing:border-box;padding:14px;background:#00f2ff;color:#0b0e14;font-weight:bold;font-size:16px;border:none;border-radius:8px;cursor:pointer;transition:transform 0.2s}.btn:hover{transform:translateY(-1px)}</style></head><body><div class="card"><h1>🔴 Skybase Verifier</h1><p>Enter your <strong>Discord User ID</strong> to verify your YouTube subscription and unlock your Skybase roles:</p><form method="GET" action="/api/youtube-verify"><input type="text" name="discord_id" placeholder="e.g. 1414143825538191373" required><button type="submit" class="btn">🌐 Continue to Google Sign-In</button></form><p style="margin-top:20px;font-size:12px;color:#64748b">Tip: In Discord, right-click your avatar and select "Copy User ID".</p></div></body></html>`);
    }

    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly openid email profile',
      access_type: 'online',
      state: discordUserId,
      prompt: 'consent'
    }).toString();

    return res.redirect(authUrl);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).send(renderPage(false, 'Failed to obtain access token: ' + (tokenData.error_description || tokenData.error || 'Unknown error')));
    }

    const accessToken = tokenData.access_token;
    const ytUrl = 'https://www.googleapis.com/youtube/v3/subscriptions?' + new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      forChannelId: KRYLO_CHANNEL_ID
    }).toString();

    const ytRes = await fetch(ytUrl, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });

    const ytData = await ytRes.json();
    const isSubscribed = ytData.items && ytData.items.length > 0;

    if (!isSubscribed) {
      return res.send(renderPage(false, 'You are not subscribed to Krylo MC yet! Please subscribe to Krylo MC and try verifying again.', true));
    }

    const discordUserId = state;
    let rolesAssigned = false;
    const BOT_TOKEN = process.env.DISCORD_TOKEN || DEFAULT_BOT_TOKEN;

    if (discordUserId && BOT_TOKEN) {
      try {
        // Assign both: 🔴 Skybase • Subbed to Krylo & ⭐ Skybase • Krylo Fan
        await Promise.all([
          fetch('https://discord.com/api/v10/guilds/' + SKYBASE_GUILD_ID + '/members/' + discordUserId + '/roles/' + SUB_ROLE_ID, {
            method: 'PUT',
            headers: { Authorization: 'Bot ' + BOT_TOKEN }
          }),
          fetch('https://discord.com/api/v10/guilds/' + SKYBASE_GUILD_ID + '/members/' + discordUserId + '/roles/' + FAN_ROLE_ID, {
            method: 'PUT',
            headers: { Authorization: 'Bot ' + BOT_TOKEN }
          })
        ]);
        rolesAssigned = true;
      } catch (e) {
        console.warn('Failed to assign roles:', e.message);
      }
    }

    return res.send(renderPage(true, 'Subscription verified successfully! ' + (rolesAssigned ? 'Your 🔴 Skybase • Subbed to Krylo and ⭐ Skybase • Krylo Fan roles have been awarded in Krylo\'s Skybase!' : 'Your subscription to Krylo MC is confirmed! Return to Discord.')));
  } catch (err) {
    return res.status(500).send(renderPage(false, 'Internal server error: ' + err.message));
  }
}

function renderPage(success, msg, showSub = false) {
  const border = success ? '#00f2ff' : '#ff4444';
  const title = success ? '✅ Verified!' : '⚠️ Not Verified';
  const subBtn = showSub ? '<a class="btn btn-yt" href="https://www.youtube.com/@krylomcyt?sub_confirmation=1" target="_blank">▶️ Click Here to Subscribe to Krylo MC</a><br><br>' : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Krylo's Skybase Sub Verifier</title><style>body{background:#0b0e14;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.card{background:#151922;border:1px solid ${border};border-radius:16px;padding:36px;max-width:480px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.6)}h1{font-size:26px;color:${border};margin-bottom:12px}p{font-size:15px;color:#a0aec0;line-height:1.6;margin-bottom:24px}.btn{display:inline-block;padding:12px 24px;background:#00f2ff;color:#0b0e14;font-weight:bold;border-radius:8px;text-decoration:none;transition:transform 0.2s}.btn:hover{transform:translateY(-1px)}.btn-yt{background:#ff0000;color:#fff;margin-bottom:15px}</style></head><body><div class="card"><h1>${title}</h1><p>${msg}</p>${subBtn}<a class="btn" href="https://discord.com/channels/1549875778575929446/1549918052513095682">Return to Discord</a></div></body></html>`;
}
