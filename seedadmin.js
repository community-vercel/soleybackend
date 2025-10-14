// scripts/migrateToMultilingual.js
// Run this script once to migrate existing data to multilingual format

const mongoose = require('mongoose');
require('dotenv').config();

// Import models (make sure they use the OLD schema first)
const { FoodItem, Category } = require('./models/Category');

const migrateData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Migrate Categories
    console.log('\n📁 Migrating Categories...');
    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories to migrate`);

    for (const category of categories) {
      // Check if already migrated
      if (typeof category.name === 'object' && category.name.en) {
        console.log(`⏭️  Category "${category.name.en}" already migrated, skipping...`);
        continue;
      }

      const oldName = category.name;
      const oldDescription = category.description;

      await Category.updateOne(
        { _id: category._id },
        {
          $set: {
            name: {
              en: oldName || 'Untitled',
              es: '', // Empty, to be filled by admin
              ca: '',
              ar: ''
            },
            description: oldDescription ? {
              en: oldDescription,
              es: '',
              ca: '',
              ar: ''
            } : undefined
          }
        }
      );

      console.log(`✅ Migrated category: ${oldName}`);
    }

    // Migrate Food Items
    console.log('\n🍔 Migrating Food Items...');
    const foodItems = await FoodItem.find({});
    console.log(`Found ${foodItems.length} food items to migrate`);

    for (const item of foodItems) {
      // Check if already migrated
      if (typeof item.name === 'object' && item.name.en) {
        console.log(`⏭️  Food item "${item.name.en}" already migrated, skipping...`);
        continue;
      }

      const updateData = {
        name: {
          en: item.name || 'Untitled',
          es: '',
          ca: '',
          ar: ''
        },
        description: {
          en: item.description || '',
          es: '',
          ca: '',
          ar: ''
        }
      };

      // Migrate meal sizes if they exist
      if (item.mealSizes && item.mealSizes.length > 0) {
        updateData.mealSizes = item.mealSizes.map(size => ({
          name: typeof size.name === 'string' ? {
            en: size.name,
            es: '',
            ca: '',
            ar: ''
          } : size.name,
          additionalPrice: size.additionalPrice || 0
        }));
      }

      // Migrate extras if they exist
      if (item.extras && item.extras.length > 0) {
        updateData.extras = item.extras.map(extra => ({
          name: typeof extra.name === 'string' ? {
            en: extra.name,
            es: '',
            ca: '',
            ar: ''
          } : extra.name,
          price: extra.price || 0
        }));
      }

      // Migrate addons if they exist
      if (item.addons && item.addons.length > 0) {
        updateData.addons = item.addons.map(addon => ({
          name: typeof addon.name === 'string' ? {
            en: addon.name,
            es: '',
            ca: '',
            ar: ''
          } : addon.name,
          price: addon.price || 0,
          imageUrl: addon.imageUrl || ''
        }));
      }

      // Migrate ingredients if they exist
      if (item.ingredients && item.ingredients.length > 0) {
        updateData.ingredients = item.ingredients.map(ingredient => ({
          name: typeof ingredient.name === 'string' ? {
            en: ingredient.name,
            es: '',
            ca: '',
            ar: ''
          } : ingredient.name,
          optional: ingredient.optional || false
        }));
      }

      // Migrate tags if they exist
      if (item.tags && item.tags.length > 0) {
        updateData.tags = item.tags.map(tag => 
          typeof tag === 'string' ? {
            en: tag,
            es: '',
            ca: '',
            ar: ''
          } : tag
        );
      }

      // Migrate SEO data if exists
      if (item.seoData) {
        updateData.seoData = {
          metaTitle: item.seoData.metaTitle ? {
            en: item.seoData.metaTitle,
            es: '',
            ca: '',
            ar: ''
          } : undefined,
          metaDescription: item.seoData.metaDescription ? {
            en: item.seoData.metaDescription,
            es: '',
            ca: '',
            ar: ''
          } : undefined,
          keywords: item.seoData.keywords?.map(kw => 
            typeof kw === 'string' ? {
              en: kw,
              es: '',
              ca: '',
              ar: ''
            } : kw
          )
        };
      }

      await FoodItem.updateOne(
        { _id: item._id },
        { $set: updateData }
      );

      console.log(`✅ Migrated food item: ${item.name}`);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your Category and FoodItem models with the new multilingual schema');
    console.log('2. Use the admin panel to fill in Spanish, Catalan, and Arabic translations');
    console.log('3. Test the API with different language parameters (?lang=es, ?lang=ca, ?lang=ar)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  }
};

// Run migration
migrateData();