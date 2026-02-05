import Product from "../models/product.js";
import Order from "../models/order.js";
import User from "../models/user.js";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function sanitizeFileNameHint(fileNameHint) {
  const lowered = (fileNameHint || "image").toString().toLowerCase();
  return (
    lowered
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

async function uploadToCloudinary(base64Data, fileNameHint = "image") {
  // If we already have a URL, return it
  if (typeof base64Data === 'string' && (base64Data.startsWith('http') || base64Data.startsWith('/uploads'))) {
      return base64Data;
  }

  const safeHint = sanitizeFileNameHint(fileNameHint);
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: "products",
      public_id: `${safeHint}-${Date.now()}`,
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Image upload failed");
  }
}

function makeAbsoluteUrl(req, urlPath) {
  if (!urlPath) return urlPath;
  if (urlPath.startsWith("http://") || urlPath.startsWith("https://"))
    return urlPath;
  const origin = `${req.protocol}://${req.get("host")}`;
  return `${origin}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;
}

// Get dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const userCount = await User.countDocuments({ role: "buyer" });
    const productCount = await Product.countDocuments({ status: "active" });
    const totalOrders = await Order.countDocuments();

    // Calculate total revenue and sales trend
    const orders = await Order.find();
    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.price * order.quantity,
      0
    );

    // Build daily sales trend for all orders
    const trendMap = new Map();
    orders.forEach((order) => {
      const d = new Date(order.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const amount = order.price * order.quantity;
      trendMap.set(key, (trendMap.get(key) || 0) + amount);
    });
    const salesTrend = Array.from(trendMap.entries())
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    res.json({
      userCount,
      productCount,
      totalOrders,
      totalRevenue,
      salesTrend,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching stats", error: error.message });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "buyer" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

// Create a new product (Admin)
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      images,
      price,
      quantity,
      category,
      brand,
      specifications,
    } = req.body;

    if (!name || !description || !price || !quantity || !category) {
      return res.status(400).json({
        message:
          "Missing required fields: name, description, price, quantity, category",
      });
    }

    let imageUrls = [];
    if (Array.isArray(images) && images.length > 0) {
      try {
        const uploadPromises = images.map((img, idx) =>
          uploadToCloudinary(img, name || `product-${idx}`)
        );
        imageUrls = await Promise.all(uploadPromises);
      } catch (error) {
        return res.status(500).json({ message: "Image upload failed", error: error.message });
      }
    }

    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      images: imageUrls,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      category: category.trim(),
      brand: brand ? brand.trim() : "",
      specifications: specifications || [],
      managedBy: req.user.id,
    });

    await product.save();

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating product",
      error: error.message,
    });
  }
};

// Update a product (Admin)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      images,
      price,
      quantity,
      category,
      brand,
      specifications,
    } = req.body;

    let nextImages = [];
    if (Array.isArray(images)) {
      try {
        const imagePromises = images.map(async (img, idx) => {
          if (typeof img === "string") {
            if (img.startsWith("/uploads/")) return makeAbsoluteUrl(req, img);
            if (img.startsWith("http://") || img.startsWith("https://"))
              return img;
          }
          return await uploadToCloudinary(img, name || `product-${idx}`);
        });
        nextImages = await Promise.all(imagePromises);
      } catch (error) {
        return res.status(500).json({ message: "Image upload failed", error: error.message });
      }
    }

    const product = await Product.findByIdAndUpdate(
      id,
      {
        name: name?.trim(),
        description: description?.trim(),
        images: nextImages,
        price: price ? parseFloat(price) : undefined,
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        category: category?.trim(),
        brand: brand ? brand.trim() : "",
        specifications: specifications || [],
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating product",
      error: error.message,
    });
  }
};

// Delete a product (Admin)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting product",
      error: error.message,
    });
  }
};

// Get supply and purchase details
export const getSupplyPurchaseDetails = async (req, res) => {
  try {
    // Get all products with admin info
    const products = await Product.find()
      .populate("managedBy", "username email")
      .sort({ createdAt: -1 });

    // Get all orders with user info and product info
    const rawOrders = await Order.find()
      .populate("user", "username email")
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Flatten orders for the frontend (one row per item sold)
    const orders = [];
    rawOrders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          orders.push({
            _id: order._id,
            user: order.user || { username: "Guest" },
            product: item.product,
            quantity: item.quantity,
            price: item.price,
            date: order.createdAt
          });
        });
      }
    });

    res.json({
      products,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching supply/purchase details",
      error: error.message,
    });
  }
};

// Revoke a product (admin only)
export const revokeProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { status: "revoked" },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product revoked successfully", product });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error revoking product", error: error.message });
  }
};

// Reactivate a product
export const reactivateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { status: "active" },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product reactivated successfully", product });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error reactivating product", error: error.message });
  }
};

// Get all products for moderation
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("managedBy", "username email")
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, status } = req.body;

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({
      message: "Error updating user",
      error: error.message,
    });
  }
};

// Suspend user
export const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { status: "suspended" },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User suspended successfully", user });
  } catch (error) {
    res.status(500).json({
      message: "Error suspending user",
      error: error.message,
    });
  }
};

// Activate user
export const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { status: "active" },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User activated successfully", user });
  } catch (error) {
    res.status(500).json({
      message: "Error activating user",
      error: error.message,
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting user",
      error: error.message,
    });
  }
};


