import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/** Redirect URI for OAuth (must match GCP Console). Default: http://localhost:4000/auth/callback */
export function getRedirectUri(): string {
  return (
    process.env.GDRIVE_REDIRECT_URI ||
    `http://localhost:${process.env.PORT || '4000'}/auth/callback`
  );
}

function getOAuth2Client() {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Google Drive credentials. Set GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, and GDRIVE_REFRESH_TOKEN in .env',
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri(),
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export function getDriveClient() {
  return google.drive({ version: 'v3', auth: getOAuth2Client() });
}

/**
 * Generates a URL the user should visit once to grant Drive access.
 * After granting, Google returns an authorization code that can be
 * exchanged for a refresh token via `exchangeCode()`.
 */
export function getAuthUrl(): string {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Set GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET first.');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri(),
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    redirect_uri: getRedirectUri(),
  });
}

/**
 * Exchange the one-time authorization code for tokens.
 * The refresh_token in the result should be saved to GDRIVE_REFRESH_TOKEN.
 */
export async function exchangeCode(code: string) {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri(),
  );

  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: getRedirectUri() });
  return tokens;
}
