import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    createOrder,
    getUserOrders,
    getOrder,
    cancelOrder,
    getOrderStatusOptions,
    getOrderStats
} from '../controllers/orderController.js';

const router = express.Router();

// All order routes require authentication
router.use(protect);

// Order statistics
router.get('/stats', getOrderStats);

// Order status options
router.get('/status-options', getOrderStatusOptions);

// Get user's orders
router.get('/', getUserOrders);

// Get single order
router.get('/:id', getOrder);

// Create new order
router.post('/', createOrder);

// Cancel order
router.patch('/:id/cancel', cancelOrder);

export default router;
