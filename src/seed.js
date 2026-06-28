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

function pickRandom(list) {
  return list[randInt(0, list.length - 1)];
}

function randomPrice() {
  // Price between 5.00 and 4999.99.
  return Math.round((Math.random() * 4995 + 5) * 100) / 100;
}

function randomPastDate(daysBack) {
  const maxAgeMs = daysBack * 24 * 60 * 60 * 1000;
  const offsetMs = randInt(0, maxAgeMs);
  return new Date(Date.now() - offsetMs);
}

function buildProduct(index) {
  const category = pickRandom(CATEGORIES);
  const noun = pickRandom(NOUNS_BY_CATEGORY[category]);
  const adjective = pickRandom(ADJECTIVES);
  const modelNumber = randInt(100, 9999);

  // Spread products across the last 2 years.
  const createdAt = randomPastDate(730);

  // Most products stay unchanged, but some get a newer updated_at value.
  const wasUpdated = Math.random() < 0.15;
  let updatedAt = createdAt;
  if (wasUpdated) {
    const extraMs = randInt(0, 730 * 24 * 60 * 60 * 1000);
    updatedAt = new Date(createdAt.getTime() + extraMs);
  }

  if (updatedAt > new Date()) {
    updatedAt = new Date();
  }

  return {
    // seq is only for reference. The app does not use it for sorting.
    seq: index,
    name: `${adjective} ${noun} #${modelNumber}`,
    category,
    price: randomPrice(),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

async function seed() {
  const db = await getDb();
  const collection = db.collection("products");

  console.log(`Seeding ${SEED_COUNT} products into "${db.databaseName}.products"...`);

  // Start clean so re-running the script gives the same data shape.
  await collection.deleteMany({});

  const startedAt = Date.now();
  let inserted = 0;

  // Insert in batches so the script stays simple and does not build one giant array.
  for (let startIndex = 0; startIndex < SEED_COUNT; startIndex += BATCH_SIZE) {
    const endIndex = Math.min(startIndex + BATCH_SIZE, SEED_COUNT);
    const batch = [];
    for (let i = startIndex; i < endIndex; i++) {
      batch.push(buildProduct(i));
    }
    await collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\r  inserted ${inserted}/${SEED_COUNT}`);
  }
  console.log(`\nBulk insert done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  console.log("Building indexes...");
  const indexesStartedAt = Date.now();

  // These indexes help the newest-first list and the category filter.
  await collection.createIndex({ created_at: -1, _id: -1 }, { name: "by_created_at" });
  await collection.createIndex(
    { category: 1, created_at: -1, _id: -1 },
    { name: "by_category_created_at" }
  );

  console.log(`Indexes built in ${((Date.now() - indexesStartedAt) / 1000).toFixed(1)}s`);

  const count = await collection.countDocuments();
  console.log(`Done. Collection now has ${count} documents.`);

  await closeDb();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
