import { addonBuilder } from '@stremio/stremio-addon-sdk';

export const manifest = {
  id: 'me.pepitobailao.pepitostream',
  version: '0.1.0',
  name: 'PepitoStream',
  description: 'Addon communautaire pour Stremio et Nuvio',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series'],
  catalogs: [
    { type: 'movie', id: 'pepito-movies', name: 'PepitoStream — Films' },
    { type: 'series', id: 'pepito-series', name: 'PepitoStream — Séries' }
  ],
  idPrefixes: ['tt']
} as const;

// Aucun contenu ni flux tiers n'est fourni par ce squelette.
// Les fournisseurs doivent être autorisés et ajoutés explicitement.
export const builder = new addonBuilder(manifest);
builder.defineCatalogHandler(async () => ({ metas: [] }));
builder.defineMetaHandler(async () => ({ meta: undefined }));
builder.defineStreamHandler(async () => ({ streams: [] }));
