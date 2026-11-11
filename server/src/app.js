import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sanitizeInput } from './middleware/sanitize.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import categoryRoutes from './routes/category.routes.js';
import itemRoutes from './routes/item.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import borrowRoutes from './routes/borrow.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/report.routes.js';
import activityRoutes from './routes/activity.routes.js';
import settingsRoutes from './routes/settings.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

const contentSecurityPolicy = helmet.contentSecurityPolicy.getDefaultDirectives();
if (process.env.NODE_ENV !== 'production') contentSecurityPolicy['upgrade-insecure-requests'] = null;
app.use(
  helmet({
    contentSecurityPolicy: { directives: contentSecurityPolicy },
    crossOriginEmbedderPolicy: false,
  })
);
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localOrigins = process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4000', 'http://127.0.0.1:4000'];
const allowedOrigins = new Set([...configuredOrigins, ...localOrigins]);
function isSameRequestOrigin(req, origin) {
  try {
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0].trim();
    const requestHost = forwardedHost || req.get('host');
    const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0].trim();
    const requestProtocol = forwardedProtocol || req.protocol;
    if (!requestHost || !requestProtocol) return false;
    return new URL(origin).origin === new URL(`${requestProtocol}://${requestHost}`).origin;
  } catch {
    return false;
  }
}
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin) && !isSameRequestOrigin(req, origin)) {
    return res.status(403).json({ message: 'This origin is not allowed to access the API.' });
  }
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      // Requests without Origin are non-browser clients or same-origin tools.
      callback(null, !origin || allowedOrigins.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(sanitizeInput);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api', apiLimiter);

// Public minimal liveness endpoint for load balancers; it exposes no database data.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'school-inventory-api', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity-logs', activityRoutes);
app.use('/api/settings', settingsRoutes);

// Serve the built React application when it exists.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).json({
      message: 'School Inventory API is running. Build the React client to serve the UI.',
      docs: '/api/health',
    });
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
