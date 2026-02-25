import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import registerGenerate from './routes/generate';
import registerProgress from './routes/progress';
import registerContent from './routes/content';
import registerRegenerate from './routes/regenerate';
import registerEditSection from './routes/edit-section';
import registerUndo from './routes/undo';
import registerApprove from './routes/approve';
import registerDownload from './routes/download';
import registerAuth from './routes/auth';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const router = express.Router();

registerGenerate(router);
registerProgress(router);
registerContent(router);
registerRegenerate(router);
registerEditSection(router);
registerUndo(router);
registerApprove(router);
registerDownload(router);
registerAuth(router);

app.use(router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[API] Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});

server.timeout = 600_000;
