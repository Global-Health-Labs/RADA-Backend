import express from 'express';
import cors from 'cors';
import config from './config';
import { db } from './db';

// Import route handlers
import authRouter from './routes/auth.routes';
import experimentsRouter from './routes/experiments.routes';
import mastermixesRouter from './routes/mastermixes.routes';
import documentsRouter from './routes/documents.routes';
import usersRouter from './routes/users.routes';

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

// Routes
app.use('/auth', authRouter);
app.use('/experiments', experimentsRouter);
app.use('/mastermixes', mastermixesRouter);
app.use('/documents', documentsRouter);
app.use('/users', usersRouter);

console.log('Port: ', config.PORT, 'NODE_ENV: ', config.NODE_ENV);

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}, NODE_ENV: ${config.NODE_ENV}`);
});
