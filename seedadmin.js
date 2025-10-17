// scripts/migrateFoodItems.js

const mongoose = require('mongoose');
require('dotenv').config();

// Import models (make sure they use the OLD schema first)
const { FoodItem, Category } = require('./models/Category');


async function fixMealSizes() {
  try {
     await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

 const items = await FoodItem.find({
      "mealSizes.name.en": /Large \(36 cm$/
    });

    console.log(`Found ${items.length} items with corrupted data`);

    for (const item of items) {
      item.mealSizes = item.mealSizes.map(size => ({
        ...size.toObject(),
        name: {
          en: size.name.en === "Large (36 cm" ? "Large (36 cm)" : size.name.en,
          es: size.name.es || "",
          ca: size.name.ca || "",
          ar: size.name.ar || ""
        }
      }));
      
      await item.save();
      console.log(`Fixed: ${item.name.en}`);
    }

    console.log('✅ All meal sizes fixed!');
  } catch (error) {
    console.error('Error fixing meal sizes:', error);
  }
}

// Run the function
fixMealSizes();