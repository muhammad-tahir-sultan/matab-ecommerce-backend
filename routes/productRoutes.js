import express from "express";
import {
    getAllProducts,
    getProductById,
    getProductsByCategory,
    getNewArrivals,
    getDeals,
    searchProductsForCompare,
    getProductsByIds,
    getSimilarProducts
} from "../controllers/productController.js";

const router = express.Router();

// Get all products (public)
router.get("/", getAllProducts);

// Search products (public)
router.get("/compare/search", searchProductsForCompare);
// Add to your routes file (e.g., routes/productRoutes.js)
router.get('/search-compare', searchProductsForCompare);
// Get products by IDs for comparison (public)
router.post("/compare/by-ids", getProductsByIds);

// Get similar products for comparison suggestions (public)
router.get("/compare/similar/:id", getSimilarProducts);
// New arrivals and deals (must come before /:id)
router.get("/new-arrivals", getNewArrivals);
router.get("/deals", getDeals);

// Get products by category (public) - must come before /:id route
router.get("/category/:category", getProductsByCategory);

// Get product by ID (public) - must come after more specific routes
router.get("/:id", getProductById);

export default router; 