import { bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';

bootstrapWorker(config)
  .then(() => {
    console.log('Vendure worker started');
  })
  .catch((err: any) => {
    console.error('Failed to start Vendure worker:', err);
    process.exit(1);
  });
