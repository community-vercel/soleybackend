// server/seeds/seedSuperAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path to your User model
const dotenv = require('dotenv');

dotenv.config();

// Connect to MongoDB
mongoose.connect('mongodb+srv://support_db_user:gcDSW2GGTI7WRLh1@sorely.cnixywk.mongodb.net/?retryWrites=true&w=majority&appName=sorely', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Superadmin user data
const superAdminData = {
  firstName: 'Super',
  lastName: 'Admin',
  email: 'soelyadmin@examplee.com',
  phone: '+9234234567870',
  password: 'admin778',
  role: 'admin',
  emailVerified: true,
  phoneVerified: true,
  isActive: true,
  addresses: [],
  preferences: {
    notifications: {
      email: true,
      sms: true,
      push: true,
    },
    dietary: {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      nutFree: false,
    },
  },
};

async function seedSuperAdmin() {
  try {
    // Check if superadmin already exists
    const existingUser = await User.findOne({
      $or: [{ email: superAdminData.email }, { phone: superAdminData.phone }],
    }).select('+password');

    if (existingUser) {
      console.log('Superadmin already exists:', existingUser.email);
      console.log('Existing password hash:', existingUser.password);
      const isMatch = await bcrypt.compare(superAdminData.password, existingUser.password);
      console.log('Password match test for existing user:', isMatch);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Explicitly hash password
    console.log('Generating password hash for:', superAdminData.password);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(superAdminData.password, salt);
    console.log('Generated hash:', hashedPassword);

    // Create new superadmin
    const superAdmin = new User({
      ...superAdminData,
      password: hashedPassword,
    });

    // Mark password as unmodified to prevent pre('save') hook
    superAdmin.set('password', hashedPassword, { strict: false });
    console.log('Saving user with password:', superAdmin.password);
    await superAdmin.save({ validateBeforeSave: true });

    // Verify the saved user
    const savedUser = await User.findOne({ email: superAdminData.email }).select('+password');
    console.log('Saved user password hash:', savedUser.password);
    console.log('Expected hash:', hashedPassword);
    const isMatch = await bcrypt.compare(superAdminData.password, savedUser.password);
    console.log('Password verification test for new user:', isMatch);

    if (!isMatch) {
      throw new Error('Password verification failed after creation');
    }

    console.log('Superadmin created successfully');
    console.log('Credentials:', {
      email: superAdminData.email,
      phone: superAdminData.phone,
      password: superAdminData.password,
      role: superAdminData.role,
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding superadmin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedSuperAdmin();