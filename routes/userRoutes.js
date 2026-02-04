import express from 'express';
import {
  getOrderHistory,
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  checkoutCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// ===== ORDER HISTORY ROUTES =====
router.get('/orders', getOrderHistory);

// ===== FAVORITES ROUTES =====
router.get('/favorites', getFavorites);
router.post('/favorites', addToFavorites);
router.delete('/favorites/:productId', removeFromFavorites);

// ===== CART ROUTES =====

// Get user's cart
router.get('/cart', getCart);

// Add to cart
router.post('/cart', addToCart);

// Update cart item quantity
router.put('/cart/:productId', updateCartQuantity);

// Remove from cart
router.delete('/cart/:productId', removeFromCart);

// Clear cart
router.delete('/cart', clearCart);

// Checkout cart
router.post('/cart/checkout', checkoutCart);

// ===== WISHLIST ROUTES =====

// Get user's wishlist
router.get('/wishlist', getWishlist);

// Add to wishlist
router.post('/wishlist', addToWishlist);

// Remove from wishlist
router.delete('/wishlist/:productId', removeFromWishlist);

// Check if product is in wishlist
router.get('/wishlist/check/:productId', checkWishlistStatus);


export default router; 