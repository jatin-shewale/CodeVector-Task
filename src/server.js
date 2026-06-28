require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { getDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

app.get("/api/products", async (req, res) => {
  try {
    const db = await getDb();
    const collection = db.collection("products");

    // Page numbers are easier to read and explain.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    let limit = parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
    limit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Optional category filter.
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const total = await collection.countDocuments(filter);
    const docs = await collection
      .find(filter)
      .sort({ created_at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const items = docs.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      category: d.category,
      price: d.price,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/categories", async (req, res) => {
  try {
    const db = await getDb();
    const categories = await db.collection("products").distinct("category");
    res.json({ categories: categories.sort() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/stats", async (req, res) => {
  try {
    const db = await getDb();
    const count = await db.collection("products").estimatedDocumentCount();
    res.json({ totalProducts: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
