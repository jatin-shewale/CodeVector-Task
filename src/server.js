require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function encodeCursor(doc) {
  const payload = JSON.stringify({
    created_at: doc.created_at.toISOString(),
    id: doc._id.toString(),
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return {
      created_at: new Date(payload.created_at),
      id: new ObjectId(payload.id),
    };
  } catch (err) {
    return null;
  }
}

app.get("/api/products", async (req, res) => {
  try {
    const db = await getDb();
    const collection = db.collection("products");

    let limit = parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
    limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.cursor) {
      const decoded = decodeCursor(req.query.cursor);
      if (!decoded) {
        return res.status(400).json({ error: "Invalid cursor" });
      }
      
      filter.$or = [
        { created_at: { $lt: decoded.created_at } },
        { created_at: decoded.created_at, _id: { $lt: decoded.id } },
      ];
    }

    const docs = await collection
      .find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;

    const items = pageDocs.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      category: d.category,
      price: d.price,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    const nextCursor =
      hasMore && pageDocs.length > 0 ? encodeCursor(pageDocs[pageDocs.length - 1]) : null;

    res.json({
      items,
      nextCursor,
      hasMore,
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
