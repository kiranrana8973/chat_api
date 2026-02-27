const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload.email_verified) {
    throw new Error('Google email is not verified.');
  }

  return {
    oauthId: payload.sub,
    email: payload.email,
    fname: payload.given_name || '',
    lname: payload.family_name || '',
    avatar: payload.picture || '',
  };
}

async function verifyAppleToken(identityToken) {
  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: process.env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });

  if (!payload.sub) {
    throw new Error('Invalid Apple token: missing subject.');
  }

  return {
    oauthId: payload.sub,
    email: payload.email || null,
  };
}

module.exports = { verifyGoogleToken, verifyAppleToken };
