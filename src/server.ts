import 'dotenv/config';
import express from 'express';
import { getRouter } from '@stremio/stremio-addon-sdk';
import { builder } from './addon.js';

const app = express();
const port = Number(process.env.PORT ?? 7000);
const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${port}`;

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'PepitoStream' }));
app.use(getRouter(builder.getInterface(), { prefix: '/stremio' }));
app.get('/', (_req, res) => res.type('html').send(`<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>PepitoStream</title><main><h1>PepitoStream</h1>
<p>Squelette de développement — aucun catalogue ou flux tiers n'est encore configuré.</p>
<p><a href="${publicUrl}/stremio/manifest.json">Manifest Stremio</a></p>
</main></html>`));

app.listen(port, () => console.log(`PepitoStream prêt sur ${publicUrl}`));
