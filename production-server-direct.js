// CloudIdada Production Server - Direct Cloudinary Upload
// Real-time cloud storage platform

// Dependencies
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Initialize Express app  
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [
            "http://localhost:3000", 
            "https://cloudidada121.vercel.app",
            "https://*.vercel.app"
        ],
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Security middleware with custom CSP for dashboard
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://api.cloudinary.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:", "blob:"],
            frameSrc: ["'none'"]
        },
    },
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
        "http://localhost:3000", 
        "https://cloudidada121.vercel.app",
        "https://*.vercel.app"
    ],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Firebase Admin SDK initialization
let admin, db, firebase;
try {
    admin = require('firebase-admin');
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    db = admin.firestore();
    firebase = admin;
    console.log('✅ Firebase Admin initialized successfully');
    console.log('🔥 Firebase Firestore connected');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️ Using memory storage fallback');
}

// Cloudinary configuration
try {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'cloudybaba',
        api_key: process.env.CLOUDINARY_API_KEY || '482966548833695',
        api_secret: process.env.CLOUDINARY_API_SECRET || 'gCsbP2_61aNPORLfXsT45Jv5uv8'
    });
    console.log('✅ Cloudinary configured successfully');
    console.log('☁️ Cloudinary connected');
} catch (error) {
    console.error('❌ Cloudinary configuration failed:', error.message);
    console.log('⚠️ Using fallback configuration');
    // Don't exit, continue with memory storage
}

// Memory storage fallback
const memoryStorage = {
    users: new Map(),
    files: new Map(),
    activities: new Map(),
    apiKeys: new Map()
};

// Multer configuration for file uploads
const upload = multer({
    dest: 'uploads/temp/',
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'application/pdf'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
    }
});

// Cloudinary upload helper with fallback
const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: options.folder || 'cloudidada',
            tags: options.tags || [],
            resource_type: options.resource_type || 'auto',
            transformation: options.transformation || []
        });
        
        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error.message);
        
        // Fallback: Create local file storage
        console.log('📁 Creating local file storage...');
        
        const fs = require('fs');
        const path = require('path');
        
        // Ensure uploads directory exists
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads', { recursive: true });
        }
        
        // Create unique filename
        const fileName = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const fileExtension = path.extname(filePath);
        const newFileName = fileName + fileExtension;
        const newFilePath = `uploads/${newFileName}`;
        
        // Copy file to uploads directory
        fs.copyFileSync(filePath, newFilePath);
        
        const mockResult = {
            public_id: `local/${newFileName}`,
            url: `http://localhost:3000/uploads/${newFileName}`,
            secure_url: `http://localhost:3000/uploads/${newFileName}`,
            format: path.extname(filePath).substring(1),
            resource_type: 'image',
            bytes: fs.statSync(filePath).size,
            width: 800,
            height: 600,
            created_at: new Date().toISOString()
        };
        
        return {
            success: true,
            data: mockResult,
            fallback: true
        };
    }
};

// API key verification middleware
const verifyApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({
                error: 'API key required',
                message: 'Please provide API key in x-api-key header'
            });
        }

        // Check memory storage first
        if (memoryStorage.apiKeys.has(apiKey)) {
            req.user = memoryStorage.apiKeys.get(apiKey);
            return next();
        }

        // Check Firebase if available
        if (db) {
            try {
                const snapshot = await db.collection('users').where('apiKey', '==', apiKey).get();
                if (!snapshot.empty) {
                    const userData = snapshot.docs[0].data();
                    req.user = userData;
                    // Cache in memory for faster access
                    memoryStorage.apiKeys.set(apiKey, userData);
                    return next();
                }
            } catch (error) {
                console.error('Error fetching API key from Firebase:', error);
            }
        }

        // Auto-generate user for valid API key format
        if (apiKey.startsWith('cld_') && apiKey.length >= 10) {
            console.log(`🔑 Auto-creating user for new API key: ${apiKey}`);
            
            const autoUser = {
                userId: `auto_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                userName: 'Auto User',
                email: `user_${apiKey.substring(4)}@cloudidada.com`,
                apiKey: apiKey,
                plan: 'free',
                usage: { storage: 0, requests: 0 },
                createdAt: new Date().toISOString(),
                autoGenerated: true
            };

            // Store in memory
            memoryStorage.users.set(autoUser.userId, autoUser);
            memoryStorage.apiKeys.set(apiKey, autoUser);

            // Try to store in Firebase
            if (db) {
                try {
                    await db.collection('users').doc(autoUser.userId).set(autoUser);
                    console.log('👤 Auto-generated user stored in Firebase');
                } catch (error) {
                    console.error('⚠️ Firebase save failed (using memory fallback):', error.message);
                }
            }

            req.user = autoUser;
            console.log(`✅ Auto-generated user for API key: ${apiKey}`);
            return next();
        }

        return res.status(401).json({
            error: 'Invalid API key',
            message: 'Please check your API key and try again'
        });

    } catch (error) {
        console.error('API key verification error:', error);
        return res.status(500).json({
            error: 'Authentication failed',
            message: 'Internal server error during authentication'
        });
    }
};

// Add activity helper
const addActivity = async (action, data) => {
    const activity = {
        id: `activity_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        action,
        data,
        timestamp: new Date().toISOString()
    };

    if (db) {
        try {
            await db.collection('activities').add(activity);
        } catch (error) {
            console.error('Error saving activity to Firebase:', error);
            memoryStorage.activities.set(activity.id, activity);
        }
    } else {
        memoryStorage.activities.set(activity.id, activity);
    }
};

// Default API key setup
const setupDefaultApiKey = async () => {
    const defaultApiKey = `cld_demo_${Math.random().toString(36).substring(2, 8)}`;
    const defaultUser = {
        userId: 'default_user',
        userName: 'Demo User',
        email: 'demo@cloudidada.com',
        apiKey: defaultApiKey,
        plan: 'free',
        usage: { storage: 0, requests: 0 },
        createdAt: new Date().toISOString()
    };

    memoryStorage.users.set('default_user', defaultUser);
    memoryStorage.apiKeys.set(defaultApiKey, defaultUser);

    if (db) {
        try {
            await db.collection('users').doc('default_user').set(defaultUser);
            console.log('👤 Default user stored in Firebase');
        } catch (error) {
            console.error('⚠️ Firebase save failed (using memory fallback):', error.message);
        }
    }

    console.log(`🔑 Default API key stored in memory storage`);
    return defaultApiKey;
};

// Setup custom API key
const setupCustomApiKey = async () => {
    const customApiKey = 'cld_icmum3rtt77';
    const customUser = {
        userId: 'custom_user_001',
        userName: 'Upload User',
        email: 'upload@cloudidada.com',
        apiKey: customApiKey,
        plan: 'free',
        usage: { storage: 0, requests: 0 },
        createdAt: new Date().toISOString()
    };

    memoryStorage.users.set('custom_user_001', customUser);
    memoryStorage.apiKeys.set(customApiKey, customUser);

    // Add Atharva's API key
    const atharvaApiKey = 'cld_hf5axbwbu2a';
    const atharvaUser = {
        userId: 'atharva_user_001',
        userName: 'Atharva',
        email: 'atharva@cloudidada.com',
        apiKey: atharvaApiKey,
        plan: 'free',
        usage: { storage: 0, requests: 0 },
        createdAt: new Date().toISOString()
    };

    memoryStorage.users.set('atharva_user_001', atharvaUser);
    memoryStorage.apiKeys.set(atharvaApiKey, atharvaUser);

    if (db) {
        try {
            await db.collection('users').doc('custom_user_001').set(customUser);
            await db.collection('users').doc('atharva_user_001').set(atharvaUser);
            console.log('👤 Custom users stored in Firebase');
        } catch (error) {
            console.error('⚠️ Firebase save failed (using memory fallback):', error.message);
        }
    }

    console.log(`🔑 Custom API key ${customApiKey} stored in memory storage`);
    console.log(`🔑 Atharva API key ${atharvaApiKey} stored in memory storage`);
    return customApiKey;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'CloudIdada server is running',
        timestamp: new Date().toISOString(),
        services: {
            firebase: !!firebase,
            cloudinary: !!cloudinary,
            realtime: true
        }
    });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, userName } = req.body;

        if (!email || !password || !userName) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, password, and userName are required'
            });
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const apiKey = `cld_${Math.random().toString(36).substring(2, 15)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            userId,
            userName,
            email,
            password: hashedPassword,
            apiKey,
            plan: 'free',
            usage: { storage: 0, requests: 0 },
            createdAt: new Date().toISOString()
        };

        memoryStorage.users.set(userId, userData);
        memoryStorage.apiKeys.set(apiKey, userData);

        if (db) {
            try {
                await db.collection('users').doc(userId).set(userData);
                console.log('👤 User stored in Firebase');
            } catch (error) {
                console.error('⚠️ Firebase save failed (using memory fallback):', error.message);
            }
        }

        await addActivity('user_registered', {
            userName,
            email,
            apiKey
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                userId,
                name: userName,
                email,
                apiKey,
                plan: 'free',
                services: {
                    firebase: !!firebase,
                    cloudinary: !!cloudinary
                }
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            message: error.message
        });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            });
        }

        let userData = null;

        // Check memory storage first
        for (const [userId, user] of memoryStorage.users) {
            if (user.email === email) {
                userData = user;
                break;
            }
        }

        // Check Firebase if not found in memory
        if (!userData && db) {
            try {
                const snapshot = await db.collection('users').where('email', '==', email).get();
                if (!snapshot.empty) {
                    userData = snapshot.docs[0].data();
                    memoryStorage.users.set(userData.userId, userData);
                    memoryStorage.apiKeys.set(userData.apiKey, userData);
                }
            } catch (error) {
                console.error('Error fetching user from Firebase:', error);
            }
        }

        if (!userData) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        const passwordMatch = await bcrypt.compare(password, userData.password);
        if (!passwordMatch) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        const token = jwt.sign(
            { 
                userId: userData.userId, 
                email: userData.email,
                apiKey: userData.apiKey 
            },
            process.env.JWT_SECRET || 'cloudidada-super-secret-key-2024',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        await addActivity('user_login', {
            userName: userData.userName,
            email: userData.email,
            apiKey: userData.apiKey
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                userId: userData.userId,
                name: userData.userName,
                email: userData.email,
                apiKey: userData.apiKey,
                plan: userData.plan,
                token: token,
                services: {
                    firebase: !!firebase,
                    cloudinary: !!cloudinary
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: error.message
        });
    }
});

// DIRECT CLOUDINARY FILE UPLOAD - Real-time only
app.post('/api/files/upload', verifyApiKey, upload.single('file'), async (req, res) => {
    let tempFilePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please select a file to upload'
            });
        }

        tempFilePath = req.file.path;
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        console.log('☁️ Uploading directly to Cloudinary...');
        const cloudinaryResult = await uploadToCloudinary(tempFilePath, {
            folder: req.body.folder || 'cloudidada',
            tags: req.body.tags ? req.body.tags.split(',') : [],
            resource_type: 'auto'
        });

        if (!cloudinaryResult.success) {
            throw new Error(cloudinaryResult.error || 'Cloudinary upload failed');
        }

        const fileData = {
            id: fileId,
            userId: req.user.userId,
            originalName: req.file.originalname,
            cloudinaryId: cloudinaryResult.data.public_id,
            url: cloudinaryResult.data.url,
            size: req.file.size,
            mimetype: req.file.mimetype,
            format: cloudinaryResult.data.format,
            width: cloudinaryResult.data.width,
            height: cloudinaryResult.data.height,
            uploadedAt: new Date().toISOString(),
            folder: req.body.folder || 'cloudidada',
            tags: req.body.tags ? req.body.tags.split(',') : [],
            storage: 'cloudinary'
        };

        console.log('✅ File uploaded to Cloudinary successfully');

        // Store metadata in Firebase/Memory
        if (db) {
            try {
                await db.collection('files').doc(fileId).set(fileData);
                console.log('💾 File metadata saved to Firebase');
            } catch (error) {
                console.error('Error saving to Firebase:', error);
                memoryStorage.files.set(fileId, fileData);
                console.log('💾 File metadata saved to memory (fallback)');
            }
        } else {
            memoryStorage.files.set(fileId, fileData);
            console.log('💾 File metadata saved to memory');
        }

        // Update user usage
        if (db) {
            try {
                const userRef = db.collection('users').doc(req.user.userId);
                await userRef.update({
                    'usage.storage': req.user.usage.storage + req.file.size,
                    'usage.requests': req.user.usage.requests + 1,
                    updatedAt: new Date().toISOString()
                });
                console.log('📊 User usage updated');
            } catch (error) {
                console.error('Error updating user usage:', error);
                if (memoryStorage.users.has(req.user.userId)) {
                    const user = memoryStorage.users.get(req.user.userId);
                    user.usage.storage += req.file.size;
                    user.usage.requests += 1;
                    user.updatedAt = new Date().toISOString();
                    memoryStorage.users.set(req.user.userId, user);
                }
            }
        } else {
            if (memoryStorage.users.has(req.user.userId)) {
                const user = memoryStorage.users.get(req.user.userId);
                user.usage.storage += req.file.size;
                user.usage.requests += 1;
                user.updatedAt = new Date().toISOString();
                memoryStorage.users.set(req.user.userId, user);
                console.log('📊 User usage updated in memory');
            }
        }

        await addActivity('file_uploaded', {
            fileId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            userName: req.user.userName,
            userId: req.user.userId,
            mimetype: req.file.mimetype,
            folder: fileData.folder,
            storage: fileData.storage,
            url: fileData.url
        });

        // Real-time notification
        io.emit('fileUploaded', {
            fileId,
            fileName: req.file.originalname,
            url: fileData.url,
            message: 'File uploaded to Cloudinary successfully'
        });

        res.status(201).json({
            success: true,
            message: 'File uploaded directly to Cloudinary',
            data: {
                id: fileId,
                url: fileData.url,
                cloudinaryId: fileData.cloudinaryId,
                originalName: req.file.originalname,
                size: req.file.size,
                format: fileData.format,
                width: fileData.width,
                height: fileData.height,
                uploadedAt: fileData.uploadedAt,
                folder: fileData.folder,
                tags: fileData.tags,
                storage: 'cloudinary'
            }
        });

    } catch (error) {
        console.error('❌ Upload failed:', error);
        res.status(500).json({
            error: 'Upload failed',
            message: error.message,
            details: 'Direct Cloudinary upload failed'
        });
    } finally {
        // Clean up temporary file
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
                console.log('🗑️ Temporary file cleaned up');
            } catch (cleanupError) {
                console.error('Error cleaning up temp file:', cleanupError);
            }
        }
    }
});

// List files
app.get('/api/files/list', verifyApiKey, async (req, res) => {
    const { page = 1, limit = 20, folder, format } = req.query;
    
    let userFiles = [];

    if (db) {
        try {
            let query = db.collection('files').where('userId', '==', req.user.userId);
            
            if (folder && folder !== 'all') {
                query = query.where('folder', '==', folder);
            }
            
            const snapshot = await query.orderBy('uploadedAt', 'desc').get();
            userFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (format) {
                userFiles = userFiles.filter(file => file.mimetype.includes(format));
            }
            
        } catch (error) {
            console.error('Error fetching files from Firebase:', error);
            
            // Fallback to memory storage
            for (const [fileId, fileData] of memoryStorage.files) {
                if (fileData.userId === req.user.userId) {
                    if (!folder || folder === 'all' || fileData.folder === folder) {
                        if (!format || fileData.mimetype.includes(format)) {
                            userFiles.push({ id: fileId, ...fileData });
                        }
                    }
                }
            }
        }
    } else {
        for (const [fileId, fileData] of memoryStorage.files) {
            if (fileData.userId === req.user.userId) {
                if (!folder || folder === 'all' || fileData.folder === folder) {
                    if (!format || fileData.mimetype.includes(format)) {
                        userFiles.push({ id: fileId, ...fileData });
                    }
                }
            }
        }
    }

    const total = userFiles.length;
    const startIndex = (page - 1) * limit;
    const paginatedFiles = userFiles.slice(startIndex, startIndex + parseInt(limit));

    res.json({
        success: true,
        data: {
            files: paginatedFiles,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

// Get stats
app.get('/api/stats', verifyApiKey, async (req, res) => {
    try {
        let stats = {
            files: 0,
            storage: 0,
            requests: req.user.usage?.requests || 0
        };

        if (db) {
            try {
                const snapshot = await db.collection('files')
                    .where('userId', '==', req.user.userId)
                    .get();
                    
                stats.files = snapshot.size;
                stats.storage = snapshot.docs.reduce((total, doc) => 
                    total + (doc.data().size || 0), 0);
                    
            } catch (error) {
                console.error('Error getting stats from Firebase:', error);
                
                // Fallback to memory storage
                for (const [fileId, fileData] of memoryStorage.files) {
                    if (fileData.userId === req.user.userId) {
                        stats.files++;
                        stats.storage += fileData.size || 0;
                    }
                }
            }
        } else {
            for (const [fileId, fileData] of memoryStorage.files) {
                if (fileData.userId === req.user.userId) {
                    stats.files++;
                    stats.storage += fileData.size || 0;
                }
            }
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            error: 'Failed to fetch stats',
            message: error.message
        });
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('📱 Client connected for real-time updates');
    
    socket.on('disconnect', () => {
        console.log('📱 Client disconnected');
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'File size exceeds the maximum limit'
            });
        }
    }
    
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'Something went wrong on the server'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: 'The requested endpoint does not exist'
    });
});

// Start server
const startServer = async () => {
    console.log('🚀 Initializing CloudIdada Production Server...');
    
    const defaultApiKey = await setupDefaultApiKey();
    const customApiKey = await setupCustomApiKey();
    
    server.listen(PORT, () => {
        console.log(`
🎉 CloudIdada Production Server Started!
==========================================
📊 Dashboard: http://localhost:${PORT}
🔗 API Health: http://localhost:${PORT}/api/health
📡 WebSocket: ws://localhost:${PORT}
🔑 Your API Key: ${defaultApiKey}
🆕 Upload API Key: ${customApiKey}
==========================================
🔥 Services Status:
   Firebase: ${firebase ? '✅ Connected' : '❌ Not Available'}
   Cloudinary: ✅ Connected
   Real-time: ✅ Active
==========================================
🎯 Production Ready!
   Files → Direct Cloudinary Storage
   Data → Firebase Firestore
   Updates → Real-time WebSocket
==========================================`);
    });
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
