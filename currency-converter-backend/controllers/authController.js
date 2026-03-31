const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        console.log('\n========== REGISTER ==========');
        console.log('Name:', name);
        console.log('Email:', email);
        console.log('Password:', password ? 'provided' : 'missing');

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields required'
            });
        }

        // Check existing user
        const existingUser = await User.findOne({ email });
        console.log('Existing user:', existingUser ? 'YES' : 'NO');
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // HASH PASSWORD MANUALLY
        console.log('Hashing password...');
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        console.log('Password hashed successfully');

        // CREATE USER WITH HASHED PASSWORD
        const user = new User({
            name,
            email,
            password: hashedPassword
        });
        
        console.log('Saving user to DB...');
        const savedUser = await user.save();
        console.log('✅ SAVED! User ID:', savedUser._id);
        
        // Verify
        const verify = await User.findById(savedUser._id);
        console.log('Verify user in DB:', verify ? 'YES' : 'NO');
        
        const token = generateToken(savedUser._id);
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email,
                role: savedUser.role
            }
        });

    } catch (error) {
        console.error('REGISTER ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('\n========== LOGIN ==========');
        console.log('Email:', email);

        const user = await User.findOne({ email });
        console.log('User found:', user ? 'YES' : 'NO');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = user.comparePassword(password);
        console.log('Password match:', isMatch ? 'YES' : 'NO');
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = generateToken(user._id);
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('LOGIN ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET ME
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};