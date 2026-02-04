import Order from '../models/order.js';
import { AppError, catchAsync } from '../middleware/errorHandler.js';

// @desc    Process payment
// @route   POST /api/user/payments
// @access  Private
export const processPayment = catchAsync(async (req, res, next) => {
    const { orderId, paymentMethod, paymentDetails } = req.body;

    if (!orderId || !paymentMethod) {
        return next(new AppError('Order ID and payment method are required', 400));
    }

    // Find the order
    const order = await Order.findOne({
        _id: orderId,
        user: req.user.id
    });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (order.paymentStatus === 'paid') {
        return next(new AppError('Order has already been paid', 400));
    }

    if (order.status === 'cancelled') {
        return next(new AppError('Cannot process payment for cancelled order', 400));
    }

    // Simulate payment processing based on method
    let paymentResult;

    switch (paymentMethod) {
        case 'cash_on_delivery':
            paymentResult = {
                success: true,
                transactionId: null,
                message: 'Payment will be collected on delivery'
            };
            break;

        case 'credit_card':
            // Simulate credit card processing
            if (!paymentDetails || !paymentDetails.cardNumber || !paymentDetails.cvv) {
                return next(new AppError('Credit card details are required', 400));
            }

            // Simulate processing (in real app, integrate with payment gateway)
            paymentResult = {
                success: Math.random() > 0.1, // 90% success rate for demo
                transactionId: paymentResult?.success ? `TXN_${Date.now()}` : null,
                message: paymentResult?.success ? 'Payment processed successfully' : 'Payment failed'
            };
            break;

        case 'bank_transfer':
            paymentResult = {
                success: true,
                transactionId: `BANK_${Date.now()}`,
                message: 'Bank transfer initiated. Please complete the transfer.'
            };
            break;

        case 'wallet':
            // Check if user has sufficient wallet balance (simulated)
            const walletBalance = 10000; // This would come from user's wallet
            if (walletBalance < order.total) {
                return next(new AppError('Insufficient wallet balance', 400));
            }

            paymentResult = {
                success: true,
                transactionId: `WALLET_${Date.now()}`,
                message: 'Payment processed from wallet'
            };
            break;

        default:
            return next(new AppError('Invalid payment method', 400));
    }

    // Update order based on payment result
    if (paymentResult.success) {
        order.paymentStatus = 'paid';
        order.paymentMethod = paymentMethod;
        order.paymentTransactionId = paymentResult.transactionId;

        // If order was pending, confirm it
        if (order.status === 'pending') {
            order.status = 'confirmed';
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: paymentResult.message,
            payment: {
                orderId: order._id,
                transactionId: paymentResult.transactionId,
                amount: order.total,
                status: 'paid',
                method: paymentMethod
            }
        });
    } else {
        res.status(400).json({
            success: false,
            message: paymentResult.message,
            payment: {
                orderId: order._id,
                status: 'failed',
                method: paymentMethod
            }
        });
    }
});

// @desc    Get payment methods
// @route   GET /api/user/payments/methods
// @access  Private
export const getPaymentMethods = catchAsync(async (req, res, next) => {
    const paymentMethods = [
        {
            id: 'cash_on_delivery',
            name: 'Cash on Delivery',
            description: 'Pay when your order is delivered',
            icon: '💵',
            available: true
        },
        {
            id: 'credit_card',
            name: 'Credit/Debit Card',
            description: 'Pay with Visa, MasterCard, or American Express',
            icon: '💳',
            available: true
        },
        {
            id: 'bank_transfer',
            name: 'Bank Transfer',
            description: 'Transfer money directly from your bank account',
            icon: '🏦',
            available: true
        },
        {
            id: 'wallet',
            name: 'Wallet',
            description: 'Pay using your MarketMatch wallet balance',
            icon: '👛',
            available: true
        }
    ];

    res.status(200).json({
        success: true,
        paymentMethods
    });
});

// @desc    Get payment status
// @route   GET /api/user/payments/:orderId/status
// @access  Private
export const getPaymentStatus = catchAsync(async (req, res, next) => {
    const order = await Order.findOne({
        _id: req.params.orderId,
        user: req.user.id
    }).select('paymentStatus paymentMethod paymentTransactionId total status');

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    res.status(200).json({
        success: true,
        payment: {
            orderId: order._id,
            status: order.paymentStatus,
            method: order.paymentMethod,
            transactionId: order.paymentTransactionId,
            amount: order.total,
            orderStatus: order.status
        }
    });
});

// @desc    Process refund
// @route   POST /api/user/payments/:orderId/refund
// @access  Private
export const processRefund = catchAsync(async (req, res, next) => {
    const { reason } = req.body;

    const order = await Order.findOne({
        _id: req.params.orderId,
        user: req.user.id
    });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (order.paymentStatus !== 'paid') {
        return next(new AppError('Order has not been paid yet', 400));
    }

    if (order.status === 'delivered') {
        // For delivered orders, check if within refund period (7 days)
        const deliveryDate = order.deliveredAt || order.createdAt;
        const refundDeadline = new Date(deliveryDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (new Date() > refundDeadline) {
            return next(new AppError('Refund period has expired (7 days from delivery)', 400));
        }
    }

    // Simulate refund processing
    order.paymentStatus = 'refunded';
    order.status = 'refunded';
    order.refundReason = reason;
    order.refundedAt = new Date();

    await order.save();

    res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        refund: {
            orderId: order._id,
            amount: order.total,
            transactionId: order.paymentTransactionId,
            refundedAt: order.refundedAt,
            reason: reason
        }
    });
});
