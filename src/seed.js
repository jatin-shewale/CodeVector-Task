require("dotenv").config();
const { getDb, closeDb } = require("./db");

const SEED_COUNT = parseInt(process.env.SEED_COUNT || "200000", 10);
const BATCH_SIZE = 5000;

const CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Beauty & Personal Care",
  "Clothing",
  "Footwear",
  "Automotive",
  "Office Supplies",
  "Garden & Tools",
  "Pet Supplies",
  "Health & Wellness",
  "Music & Instruments",
  "Groceries",
];

const ADJECTIVES = [
  "Premium",
  "Compact",
  "Wireless",
  "Eco-Friendly",
  "Heavy-Duty",
  "Portable",
  "Smart",
  "Classic",
  "Ultra",
  "Professional",
  "Lightweight",
  "Rechargeable",
  "All-Purpose",
  "Deluxe",
  "Everyday",
];

const NOUNS_BY_CATEGORY = {
  Electronics: ["Headphones", "Speaker", "Charger", "Webcam", "Router", "Power Bank", "Smartwatch"],
  "Home & Kitchen": ["Blender", "Toaster", "Cookware Set", "Kettle", "Vacuum", "Air Fryer", "Cutting Board"],
  "Sports & Outdoors": ["Yoga Mat", "Water Bottle", "Tent", "Backpack", "Dumbbell Set", "Bike Helmet"],
  Books: ["Notebook", "Planner", "Journal", "Cookbook", "Novel", "Sketchbook"],
  "Toys & Games": ["Puzzle", "Board Game", "Action Figure", "Building Blocks", "RC Car"],
  "Beauty & Personal Care": ["Face Cream", "Shampoo", "Hair Dryer", "Trimmer", "Lip Balm"],
  Clothing: ["T-Shirt", "Jacket", "Hoodie", "Jeans", "Cap"],
  Footwear: ["Running Shoes", "Sandals", "Boots", "Sneakers"],
  Automotive: ["Phone Mount", "Seat Cover", "Tire Inflator", "Dash Cam"],
  "Office Supplies": ["Desk Organizer", "Stapler", "Pen Set", "Monitor Stand"],
  "Garden & Tools": ["Pruning Shears", "Hose Reel", "Tool Kit", "Watering Can"],
  "Pet Supplies": ["Dog Leash", "Cat Tree", "Pet Bed", "Feeding Bowl"],
  "Health & Wellness": ["Massager", "Thermometer", "Resistance Band", "Heating Pad"],
  "Music & Instruments": ["Guitar Strings", "Microphone", "Keyboard", "Drumsticks"],
  Groceries: ["Coffee Beans", "Olive Oil", "Granola Bar", "Tea Set"],
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice() {
  // Between 5.00 and 4999.99
  return Math.round((Math.random() * 4995 + 5) * 100) / 100;
}

function randomPastDate(daysBack) {
  const now = Date.now();
  const offsetMs = randInt(0, daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs);
}

function buildProduct(i) {
  const category = CATEGORIES[randInt(0, CATEGORIES.length - 1)];
  const nouns = NOUNS_BY_CATEGORY[category];
  const noun = nouns[randInt(0, nouns.length - 1)];
  const adjective = ADJECTIVES[randInt(0, ADJECTIVES.length - 1)];
  const modelNumber = randInt(100, 9999);

  const createdAt = randomPastDate(730); // spread across the last 2 years
  // Most products were never updated after creation; a slice were touched later.
  const wasUpdated = Math.random() < 0.15;
  const updatedAt = wasUpdated
    ? new Date(createdAt.getTime() + randInt(0, 730 * 24 * 60 * 60 * 1000))
    : createdAt;

  return {
    seq: i, // purely informational, not used for sorting/pagination
    name: `${adjective} ${noun} #${modelNumber}`,
    category,
    price: randomPrice(),
    created_at: createdAt,
    updated_at: updatedAt > new Date() ? new Date() : updatedAt,
  };
}

async function seed() {
  const db = await getDb();
  const collection = db.collection("products");

  console.log(`Seeding ${SEED_COUNT} products into "${db.databaseName}.products"...`);

  // Start clean so re-running the script is idempotent.
  await collection.deleteMany({});

  const start = Date.now();
  let inserted = 0;

  for (let batchStart = 0; batchStart < SEED_COUNT; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, SEED_COUNT);
    const batch = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batch.push(buildProduct(i));
    }
    await collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\r  inserted ${inserted}/${SEED_COUNT}`);
  }
  console.log(`\nBulk insert done in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  console.log("Building indexes...");
  const idxStart = Date.now();

  // Powers: newest-first browsing + keyset pagination, with and without
  // a category filter. created_at is rarely unique on its own (many docs
  // can share a timestamp at this volume), so _id is included as a
  // tie-breaker to give every document a strictly unique sort position.
  await collection.createIndex({ created_at: -1, _id: -1 }, { name: "by_created_at" });
  await collection.createIndex(
    { category: 1, created_at: -1, _id: -1 },
    { name: "by_category_created_at" }
  );

  console.log(`Indexes built in ${((Date.now() - idxStart) / 1000).toFixed(1)}s`);

  const count = await collection.countDocuments();
  console.log(`Done. Collection now has ${count} documents.`);

  await closeDb();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
