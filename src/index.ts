import express from 'express';
import cors from 'cors';
import config from './config';
import { db } from './db';
import router from './routes';

const app = express();

// Middleware
app.use(cors({
  origin: config.NODE_ENV === 'production'
    ? [
        `https://${config.CLOUDFRONT_DOMAIN_NAME}`,
        `http://${config.CLOUDFRONT_DOMAIN_NAME}`,
        'http://localhost:3000',
        'https://localhost:3000',
        `https://${config.FRONTEND_SUBDOMAIN}.${config.DOMAIN_NAME}`,
        `http://${config.DOMAIN_NAME}`
      ]
    : true,
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Use centralized routes
app.use('/', router);

console.log('Port: ', config.PORT, 'NODE_ENV: ', config.NODE_ENV);

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}, NODE_ENV: ${config.NODE_ENV}`);
});
