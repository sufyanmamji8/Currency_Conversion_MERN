const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const conversionRoutes = require('./routes/conversionRoutes');

const app = express();
const PORT = process.env.PORT || 7000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== DATABASE CONNECTION WITH DEBUG ==========
console.log('\n🔌 Connecting to MongoDB...');
console.log('📀 Database URL:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully!');
        console.log('📀 Database Name:', mongoose.connection.db.databaseName);
        
        // List all collections
        mongoose.connection.db.listCollections().toArray((err, collections) => {
            if (err) {
                console.error('Error listing collections:', err);
            } else {
                console.log('📁 Existing Collections:', collections.map(c => c.name));
            }
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Error:', err.message);
        console.error('💡 Please check your MONGODB_URI in .env file');
    });

// ========== DEBUG ROUTES ==========

// Check database status
app.get('/api/check-db', async (req, res) => {
    try {
        const User = require('./models/User');
        const users = await User.find({}).select('-password');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        res.json({
            success: true,
            databaseConnected: mongoose.connection.readyState === 1,
            databaseName: mongoose.connection.db?.databaseName,
            collections: collections.map(c => c.name),
            userCount: users.length,
            users: users,
            conversionCount: await require('./models/conversionModel').countDocuments()
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

// Create test user directly (bypass auth)
app.post('/api/create-test-user', async (req, res) => {
    try {
        const User = require('./models/User');
        const { name, email, password } = req.body;
        
        const user = new User({ name, email, password });
        const savedUser = await user.save();
        
        res.json({
            success: true,
            message: 'Test user created',
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api', conversionRoutes);

// ========== ROOT ROUTE ==========
app.get('/', (req, res) => {
    res.json({
        message: 'Currency Converter API',
        version: '1.0.0',
        endpoints: {
            debug: {
                checkDB: 'GET /api/check-db',
                createTestUser: 'POST /api/create-test-user'
            },
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                profile: 'GET /api/auth/me'
            },
            conversion: {
                convert: 'GET /api/convert?from=USD&to=PKR&amount=100',
                history: 'GET /api/history',
                stats: 'GET /api/statistics',
                popularRates: 'GET /api/popular-rates'
            }
        }
    });
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 JWT Auth: Active`);
    console.log(`💾 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`\n🔍 Debug Routes:`);
    console.log(`   GET  http://localhost:${PORT}/api/check-db`);
    console.log(`   POST http://localhost:${PORT}/api/create-test-user`);
    console.log(`\n📝 Auth Routes:`);
    console.log(`   POST http://localhost:${PORT}/api/auth/register`);
    console.log(`   POST http://localhost:${PORT}/api/auth/login\n`);
});git