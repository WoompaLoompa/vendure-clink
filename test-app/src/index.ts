import { bootstrap } from '@vendure/core';
import { config } from './vendure-config';

bootstrap(config)
  .then(() => {
    console.log('Vendure server started on http://localhost:3000/admin');
    console.log('CLINK plugin is active - Bitcoin Lightning payments enabled');
  })
  .catch(err => {
    console.error('Failed to start Vendure server:', err);
    process.exit(1);
  });
