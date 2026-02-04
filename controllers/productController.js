import Product from "../models/product.js";
import { AppError, catchAsync } from "../middleware/errorHandler.js";

// Get all products (public)
export const getAllProducts = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, category, minPrice, maxPrice, sort = 'newest' } = req.query;

  // Build filter object
  const filter = { status: "active" };

  if (category) {
    filter.category = { $regex: new RegExp(category, "i") };
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  // Build sort object
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-low': { price: 1 },
    'price-high': { price: -1 },
    'name-asc': { name: 1 },
    'name-desc': { name: -1 }
  };

  const sortBy = sortOptions[sort] || sortOptions.newest;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const products = await Product.find(filter)
    .populate("vendor", "username email")
    .sort(sortBy)
    .skip(skip)
    .limit(parseInt(limit));

  const totalProducts = await Product.countDocuments(filter);
  const totalPages = Math.ceil(totalProducts / parseInt(limit));

  res.status(200).json({
    success: true,
    products,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    }
  });
});

// Get product by ID (public)
export const getProductById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError('Invalid product ID format', 400));
  }

  const product = await Product.findById(id).populate(
    "vendor",
    "username email"
  );

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  if (product.status !== 'active') {
    return next(new AppError('Product is not available', 404));
  }

  res.status(200).json({
    success: true,
    product,
  });
});

// Get products by category (public)
export const getProductsByCategory = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const { page = 1, limit = 20, sort = 'newest' } = req.query;

  // Convert category from URL format to readable format
  const categoryName = category.replace(/-/g, " ");

  // Build sort object
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-low': { price: 1 },
    'price-high': { price: -1 },
    'name-asc': { name: 1 },
    'name-desc': { name: -1 }
  };

  const sortBy = sortOptions[sort] || sortOptions.newest;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const products = await Product.find({
    category: { $regex: new RegExp(categoryName, "i") },
    status: "active",
  })
    .populate("vendor", "username email")
    .sort(sortBy)
    .skip(skip)
    .limit(parseInt(limit));

  const totalProducts = await Product.countDocuments({
    category: { $regex: new RegExp(categoryName, "i") },
    status: "active",
  });

  const totalPages = Math.ceil(totalProducts / parseInt(limit));

  res.status(200).json({
    success: true,
    products,
    category: categoryName,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    }
  });
});

// Search products (public)
export const searchProductsForCompare = catchAsync(async (req, res, next) => {
  const { q, category, brand, minPrice, maxPrice, limit = 20 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      success: true,
      products: [],
      count: 0,
      message: "Search query too short"
    });
  }

  // Build search query
  const searchQuery = {
    $or: [
      { name: { $regex: new RegExp(q, "i") } },
      { description: { $regex: new RegExp(q, "i") } },
      { category: { $regex: new RegExp(q, "i") } },
      { brand: { $regex: new RegExp(q, "i") } }
    ],
    status: "active"
  };

  // Add optional filters
  if (category) {
    searchQuery.category = { $regex: new RegExp(category, "i") };
  }

  if (brand) {
    searchQuery.brand = { $regex: new RegExp(brand, "i") };
  }

  if (minPrice || maxPrice) {
    searchQuery.price = {};
    if (minPrice) searchQuery.price.$gte = parseFloat(minPrice);
    if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice);
  }

  const products = await Product.find(searchQuery)
    .populate("vendor", "username email businessName")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    products,
    count: products.length,
    query: q
  });
});

// Get products by IDs (for loading comparison from saved state)
export const getProductsByIds = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new AppError("Product IDs array is required", 400));
  }

  // Validate all IDs are valid MongoDB ObjectIds
  const invalidIds = ids.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
  if (invalidIds.length > 0) {
    return next(new AppError("Invalid product ID format", 400));
  }

  // Limit to 4 products for comparison
  const limitedIds = ids.slice(0, 4);

  const products = await Product.find({
    _id: { $in: limitedIds },
    status: "active"
  }).populate("vendor", "username email businessName");

  res.status(200).json({
    success: true,
    products,
    count: products.length
  });
});

// Get similar products for comparison suggestions
export const getSimilarProducts = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError('Invalid product ID format', 400));
  }

  const product = await Product.findById(id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Find similar products by category and price range
  const priceRange = product.price * 0.3; // 30% price range

  const similarProducts = await Product.find({
    _id: { $ne: id },
    category: product.category,
    price: {
      $gte: product.price - priceRange,
      $lte: product.price + priceRange
    },
    status: "active"
  })
    .populate("vendor", "username email businessName")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    products: similarProducts,
    count: similarProducts.length,
    baseProduct: {
      id: product._id,
      name: product.name,
      category: product.category,
      price: product.price
    }
  });
});

// New: Get new arrivals (public) - return array for client compatibility
export const getNewArrivals = catchAsync(async (req, res, next) => {
  // Last 30 days, newest first, cap to 24
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const products = await Product.find({
    status: "active",
    createdAt: { $gte: thirtyDaysAgo },
  })
    .sort({ createdAt: -1 })
    .limit(24);

  // Return raw array (client expects array)
  res.json(products);
});

// New: Get today's deals (public) - return array for client compatibility
export const getDeals = catchAsync(async (req, res, next) => {
  // Products where originalPrice exists and is greater than current price
  const products = await Product.find({
    status: "active",
    originalPrice: { $exists: true, $gt: 0 },
    $expr: { $gt: ["$originalPrice", "$price"] },
  })
    .sort({ updatedAt: -1 })
    .limit(24);

  // Return raw array (client expects array)
  res.json(products);
});
