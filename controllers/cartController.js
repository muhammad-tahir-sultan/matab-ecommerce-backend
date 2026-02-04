import Cart from '../models/cart.js';
import Product from '../models/product.js';
import { AppError, catchAsync } from '../middleware/errorHandler.js';

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
export const getCart = catchAsync(async (req, res, next) => {
    // User ID comes from protect middleware (req.user)
    const cart = await Cart.getOrCreate(req.user._id);

    await cart.populate({
        path: 'items.product',
        select: 'name price images category brand status quantity',
        match: { status: 'active' }
    });

    cart.items = cart.items.filter(item => item.product && item.product.status === 'active');

    if (cart.isModified()) {
        await cart.save();
    }

    const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);

    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

    res.status(200).json({
        success: true,
        cart: {
            id: cart._id,
            items: cart.items,
            totalItems,
            totalPrice,
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
        }
    });
});

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
export const addToCart = catchAsync(async (req, res, next) => {
    console.log("in the cart controler");

    const { productId, quantity = 1 } = req.body;

    console.log('=== ADD TO CART ===');
    console.log('User ID:', req.user._id);
    console.log('Product ID:', productId);
    console.log('Quantity:', quantity);

    if (!productId) {
        return next(new AppError('Product ID is required', 400));
    }

    if (quantity < 1 || quantity > 100) {
        return next(new AppError('Quantity must be between 1 and 100', 400));
    }

    const product = await Product.findOne({
        _id: productId,
        status: 'active',
        quantity: { $gt: 0 }
    });

    if (!product) {
        return next(new AppError('Product not found or out of stock', 404));
    }

    // User ID comes from token via protect middleware
    const cart = await Cart.getOrCreate(req.user._id);

    const existingItem = cart.items.find(item =>
        item.product.toString() === productId.toString()
    );

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > product.quantity) {
        return next(new AppError(
            `Only ${product.quantity} items available. You have ${currentQuantity} in cart.`,
            400
        ));
    }

    await cart.addItem(productId, quantity);

    await cart.populate({
        path: 'items.product',
        select: 'name price images category brand status quantity'
    });

    const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);

    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

    console.log('Cart updated successfully');

    res.status(200).json({
        success: true,
        message: 'Item added to cart successfully',
        cart: {
            id: cart._id,
            items: cart.items,
            totalItems,
            totalPrice
        }
    });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/:productId
// @access  Private
export const updateCartItem = catchAsync(async (req, res, next) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity == null || quantity < 0 || quantity > 100) {
        return next(new AppError('Quantity must be between 0 and 100', 400));
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    if (quantity > 0) {
        const product = await Product.findOne({
            _id: productId,
            status: 'active'
        });

        if (!product) {
            return next(new AppError('Product not found', 404));
        }

        if (quantity > product.quantity) {
            return next(new AppError(
                `Only ${product.quantity} items available in stock`,
                400
            ));
        }
    }

    await cart.updateItemQuantity(productId, quantity);

    await cart.populate({
        path: 'items.product',
        select: 'name price images category brand status quantity'
    });

    const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);

    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

    res.status(200).json({
        success: true,
        message: 'Cart updated successfully',
        cart: {
            id: cart._id,
            items: cart.items,
            totalItems,
            totalPrice
        }
    });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
export const removeFromCart = catchAsync(async (req, res, next) => {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    await cart.removeItem(productId);

    await cart.populate({
        path: 'items.product',
        select: 'name price images category brand status quantity'
    });

    const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);

    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

    res.status(200).json({
        success: true,
        message: 'Item removed from cart successfully',
        cart: {
            id: cart._id,
            items: cart.items,
            totalItems,
            totalPrice
        }
    });
});

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
export const clearCart = catchAsync(async (req, res, next) => {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    await cart.clear();

    res.status(200).json({
        success: true,
        message: 'Cart cleared successfully',
        cart: {
            id: cart._id,
            items: [],
            totalItems: 0,
            totalPrice: 0
        }
    });
});

// @desc    Get cart summary (for header display)
// @route   GET /api/cart/summary
// @access  Private
export const getCartSummary = catchAsync(async (req, res, next) => {
    const cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name price images status quantity',
            match: { status: 'active' }
        });

    if (!cart) {
        return res.status(200).json({
            success: true,
            summary: {
                totalItems: 0,
                totalPrice: 0,
                itemCount: 0
            }
        });
    }

    cart.items = cart.items.filter(item => item.product && item.product.status === 'active');

    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);

    res.status(200).json({
        success: true,
        summary: {
            totalItems,
            totalPrice,
            itemCount: cart.items.length
        }
    });
});