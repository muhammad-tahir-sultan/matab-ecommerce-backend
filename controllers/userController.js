import Order from '../models/order.js';
import Favorite from '../models/favorite.js';
import Cart from '../models/cart.js';
import Wishlist from '../models/wishlist.js';
import Product from '../models/product.js';

// Get user's order history
export const getOrderHistory = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('product')
      .populate('vendor', 'username email')
      .sort({ date: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order history', error: error.message });
  }
};

// Get user's favorites
export const getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.id })
      .populate('product')
      .sort({ createdAt: -1 });

    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching favorites', error: error.message });
  }
};

// Add product to favorites
export const addToFavorites = async (req, res) => {
  try {
    const { productId } = req.body;

    // Check if already in favorites
    const existing = await Favorite.findOne({ user: req.user.id, product: productId });
    if (existing) {
      return res.status(400).json({ message: 'Product already in favorites' });
    }

    const favorite = new Favorite({
      user: req.user.id,
      product: productId
    });

    await favorite.save();
    await favorite.populate('product');

    res.status(201).json(favorite);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to favorites', error: error.message });
  }
};

// Remove from favorites
export const removeFromFavorites = async (req, res) => {
  try {
    const { productId } = req.params;

    await Favorite.findOneAndDelete({ user: req.user.id, product: productId });

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from favorites', error: error.message });
  }
};

// ===== CART FUNCTIONS =====

// Get user's cart
export const getCart = async (req, res) => {
  try {
    const cartItems = await Cart.find({ userId: req.user.id })
      .populate('productId', 'name brand images price quantity')
      .sort({ addedAt: -1 });

    res.status(200).json({
      success: true,
      cartItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart items',
      error: error.message
    });
  }
};
// Add to cart

// Add to cart
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if already in cart
    const existing = await Cart.findOne({ userId: req.user.id, productId });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      await existing.populate('productId', 'name brand images price quantity');
      return res.json({
        success: true,
        message: 'Quantity updated',
        cartItem: existing
      });
    }

    // Add new item
    const newItem = new Cart({
      userId: req.user.id,
      productId,
      quantity,
      priceAtTimeOfAdding: product.price
    });

    await newItem.save();
    await newItem.populate('productId', 'name brand images price quantity');

    res.status(201).json({
      success: true,
      message: 'Product added to cart',
      cartItem: newItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding to cart',
      error: error.message
    });
  }
};



// Update cart item quantity
export const updateCartQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const cartItem = await Cart.findOneAndUpdate(
      { userId: req.user.id, productId },
      { quantity },
      { new: true }
    ).populate('productId', 'name brand images price quantity');

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    res.json({ success: true, message: 'Cart updated', cartItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating cart', error: error.message });
  }
};
// Remove from cart
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const deleted = await Cart.findOneAndDelete({ userId: req.user.id, productId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing item', error: error.message });
  }
};

// Clear cart
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    await Cart.deleteMany({ userId });

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

// Checkout cart - creates order and clears cart
export const checkoutCart = async (req, res) => {
  try {
    // Get user's cart items
    const cartItems = await Cart.find({ userId: req.user.id }).populate('productId');

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Create orders for each cart item
    const orders = [];
    for (const cartItem of cartItems) {
      const order = new Order({
        user: req.user.id,
        product: cartItem.productId._id,
        vendor: cartItem.productId.vendor,
        quantity: cartItem.quantity,
        price: cartItem.priceAtTimeOfAdding,
        totalAmount: cartItem.quantity * cartItem.priceAtTimeOfAdding,
        status: 'pending',
        date: new Date()
      });

      await order.save();
      orders.push(order);
    }

    // Clear the cart after successful order creation
    await Cart.deleteMany({ userId: req.user.id });

    res.status(201).json({
      message: 'Order placed successfully',
      orders: orders,
      totalItems: orders.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during checkout', error: error.message });
  }
};

// ===== WISHLIST FUNCTIONS =====

// Get user's wishlist
export const getWishlist = async (req, res) => {
  try {
    const wishlistItems = await Wishlist.find({ userId: req.user.id })
      .populate('productId', 'name description images price originalPrice quantity category brand status createdAt')
      .sort({ addedAt: -1 });

    res.json(wishlistItems);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist items'
    });
  }
};

// Add to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    console.log('====================================');
    console.log(productId, "thisis product id ");
    console.log('====================================');
    const userId = req.user.id;
    console.log('User ID:', userId);

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if item already exists in wishlist
    const existingWishlistItem = await Wishlist.findOne({ userId, productId });
    if (existingWishlistItem) {
      return res.status(400).json({
        success: false,
        message: 'Item already in wishlist'
      });
    }

    // Create new wishlist item
    const wishlistItem = new Wishlist({
      userId,
      productId
    });

    await wishlistItem.save();
    await wishlistItem.populate('productId', 'name description images price originalPrice quantity category brand status createdAt');

    res.status(201).json({
      success: true,
      message: 'Item added to wishlist successfully',
      wishlistItem
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item already exists in wishlist'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add item to wishlist'
    });
  }
};

// Remove from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const wishlistItem = await Wishlist.findOneAndDelete({ userId, productId });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully'
    });
  } catch (error) {
    console.error('Error removing wishlist item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove wishlist item'
    });
  }
};

// Check if product is in wishlist
export const checkWishlistStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlistItem = await Wishlist.findOne({ userId: req.user.id, productId });

    res.json({ isWishlisted: !!wishlistItem });
  } catch (error) {
    res.status(500).json({ message: 'Error checking wishlist status', error: error.message });
  }
}; 