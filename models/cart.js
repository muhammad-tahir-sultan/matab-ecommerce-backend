import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [100, 'Quantity cannot exceed 100']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true,
    index: true
  },
  items: [CartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total items count
CartSchema.virtual('totalItems').get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for total price
CartSchema.virtual('totalPrice').get(async function () {
  await this.populate('items.product', 'price');
  return this.items.reduce((total, item) => {
    return total + (item.product.price * item.quantity);
  }, 0);
});

// Instance method to add item to cart
CartSchema.methods.addItem = async function (productId, quantity = 1) {
  const existingItem = this.items.find(item =>
    item.product.toString() === productId.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({ product: productId, quantity });
  }

  this.updatedAt = new Date();
  return this.save();
};

// Instance method to remove item from cart
CartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(item =>
    item.product.toString() !== productId.toString()
  );
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to update item quantity
CartSchema.methods.updateItemQuantity = function (productId, quantity) {
  const item = this.items.find(item =>
    item.product.toString() === productId.toString()
  );

  if (item) {
    if (quantity <= 0) {
      return this.removeItem(productId);
    }
    item.quantity = quantity;
    this.updatedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Item not found in cart'));
};

// Instance method to clear cart
CartSchema.methods.clear = function () {
  this.items = [];
  this.updatedAt = new Date();
  return this.save();
};

// Static method to get or create cart for user
CartSchema.statics.getOrCreate = async function (userId) {
  let cart = await this.findOne({ user: userId }).populate('items.product');

  if (!cart) {
    cart = new this({ user: userId, items: [] });
    await cart.save();
  }

  return cart;
};

// Pre-save middleware to update timestamps
CartSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Cart', CartSchema);