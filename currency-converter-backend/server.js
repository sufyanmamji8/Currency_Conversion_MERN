// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const conversionRoutes = require('./routes/conversionRoutes');

const mongoose = require('mongoose'); // DB ke liye

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// ========== ROUTES ==========
app.use('/api', conversionRoutes);

// ========== START SERVER ==========
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));