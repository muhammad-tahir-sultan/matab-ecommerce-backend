import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    processPayment,
    getPaymentMethods,
    getPaymentStatus,
    processRefund
} from '../controllers/paymentController.js';

const router = express.Router();

// All payment routes require authentication
router.use(protect);

// Get available payment methods
router.get('/methods', getPaymentMethods);

// Get payment status for an order
router.get('/:orderId/status', getPaymentStatus);

// Process payment for an order
router.post('/', processPayment);

// Process refund for an order
router.post('/:orderId/refund', processRefund);

export default router;
