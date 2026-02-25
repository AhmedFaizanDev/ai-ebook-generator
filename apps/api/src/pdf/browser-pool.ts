import puppeteer, { Browser } from 'puppeteer';

let browser: Browser | null = null;
let launchPromise: Promise<Browser> | null = null;

const IS_DOCKER = process.env.PUPPETEER_DOCKER === 'true';

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--mute-audio',
      '--hide-scrollbars',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--font-render-hinting=none',
    ];
    if (IS_DOCKER) {
      args.push('--no-zygote', '--single-process');
    }
    console.log('[PDF] Launching browser...');
    browser = await puppeteer.launch({
      headless: 'shell',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args,
      protocolTimeout: 300_000,
    });
    console.log('[PDF] Browser launched successfully');
    return browser;
  })();

  try {
    return await launchPromise;
  } finally {
    launchPromise = null;
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

if (typeof process !== 'undefined') {
  const shutdown = () => {
    closeBrowser().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
