const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "codevector";

let client;
let db;

async function getDb() {
  if (db) return db;
  client = new MongoClient(uri, {
    maxPoolSize: 20,
  });
  await client.connect();
  db = client.db(dbName);
  return db;
}

async function closeDb() {
  if (client) await client.close();
}

module.exports = { getDb, closeDb };
