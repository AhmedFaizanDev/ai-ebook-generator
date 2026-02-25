import { Router, Request, Response } from 'express';
import { getAuthUrl, exchangeCode } from '@/drive/auth';

export default function registerAuth(router: Router): void {
  /**
   * Redirects to Google OAuth consent page.
   * User signs in and grants Drive access, then Google redirects to /auth/callback.
   */
  router.get('/auth/google', (_req: Request, res: Response) => {
    try {
      const url = getAuthUrl();
      res.redirect(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(`Failed to build auth URL: ${msg}`);
    }
  });

  /**
   * OAuth callback. Google redirects here with ?code=...
   * Exchanges code for tokens and shows the refresh token to copy into .env.
   */
  router.get('/auth/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).send('Missing code in query. Start from <a href="/auth/google">/auth/google</a>.');
      return;
    }
    try {
      const tokens = await exchangeCode(code);
      const refreshToken = tokens.refresh_token;
      if (!refreshToken) {
        res.status(500).send(
          'No refresh_token in response. Try revoking app access at <a href="https://myaccount.google.com/permissions">Google permissions</a> and run /auth/google again with prompt=consent.',
        );
        return;
      }
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Drive token</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem;">
  <h1>Refresh token</h1>
  <p>Add this to your <code>.env</code> as <code>GDRIVE_REFRESH_TOKEN</code>, then restart the API.</p>
  <textarea readonly style="width:100%; height: 80px; font-family: monospace;">${refreshToken}</textarea>
  <p><a href="/auth/google">Re-run OAuth</a></p>
</body>
</html>`;
      res.type('html').send(html);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(`Token exchange failed: ${msg}`);
    }
  });
}
