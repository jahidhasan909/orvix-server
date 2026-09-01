const { MongoClient } = require('mongodb');

const express = require('express');
const app = express()
let cors = require('cors');
const port = process.env.PORT || 8000
require('dotenv').config()

app.use(cors());
app.use(express.json())




const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongoDB() {
  try {
    
    await client.connect();
    console.log("Successfully connected to MongoDB!");





    return client;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, async () => {
  await connectToMongoDB();
  console.log(`Server is running on port ${port}`);
});