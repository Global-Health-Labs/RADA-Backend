import { Router } from 'express';
import authRoutes from './auth.routes';
import documentsRoutes from './documents.routes';
import experimentsRoutes from './experiments.routes';
import mastermixesRoutes from './mastermixes.routes';
import usersRoutes from './users.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/documents', documentsRoutes);
router.use('/experiments', experimentsRoutes);
router.use('/mastermixes', mastermixesRoutes);
router.use('/users', usersRoutes);

export default router;
