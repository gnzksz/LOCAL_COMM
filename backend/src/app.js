import cors from 'cors';
import express from 'express';
import { config, ISSUE_TYPES, STATUS } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import notificationRoutes from './routes/notifications.js';
import residentRoutes from './routes/resident.js';
import staffRoutes from './routes/staff.js';

export const corsOrigin = config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',');

export const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
// Express 5 leaves req.body undefined for requests without a body.
app.use((req, _res, next) => {
  req.body ??= {};
  next();
});
app.use('/uploads', express.static(config.uploadDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/meta', (_req, res) =>
  res.json({ issueTypes: ISSUE_TYPES, statuses: Object.values(STATUS) })
);

app.use('/api/auth', authRoutes);
app.use('/api/requests', residentRoutes); // Resident (mobile app)
app.use('/api/admin', adminRoutes); // Admin (web dashboard)
app.use('/api/staff', staffRoutes); // Staff / field personnel (web)
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);
