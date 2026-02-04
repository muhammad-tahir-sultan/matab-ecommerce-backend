// cartRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartSummary
} from '../controllers/cartController.js';

const router = express.Router();

// All cart routes require authentication
router.use(protect);

// Cart summary for header display (MUST be before '/' route)
router.get('/summary', getCartSummary);

// Get user's cart
router.get('/', getCart);

// Add item to cart
router.post('/', addToCart);

// Clear entire cart (MUST be before '/:productId')
router.delete('/clear', clearCart);

// Update cart item quantity
router.put('/:productId', updateCartItem);

// Remove item from cart
router.delete('/:productId', removeFromCart);

export default router;