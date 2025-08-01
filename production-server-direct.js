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

// Load environment variables
dotenv.config();

console.log(process.env);
// Initialize Express app  
const app = express();

// Only create server and socket.io for local development
let server, io;
if (!process.env.VERCEL) {
    const { createServer } = require('http');
    const { Server } = require('socket.io');
    
    server = createServer(app);
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN?.split(',') || [
                "http://localhost:3000", 
                "http://localhost:3001",
                "http://127.0.0.1:5500",
                "http://localhost:5500",
                "https://cloudidada121.vercel.app",
                "https://cloudidada.vercel.app",
                "https://*.vercel.app"
            ],
            methods: ["GET", "POST", "PUT", "DELETE"]
        }
    });
} else {
    // Mock socket.io for serverless
    io = {
        emit: () => {} // No-op for serverless
    };
}

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
            imgSrc: ["'self'", "data:", "https:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
            connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:5500", "http://localhost:5500", "ws:", "wss:", "https://api.cloudinary.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:", "blob:"],
            frameSrc: ["'none'"]
        },
    },
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
        "http://localhost:3000", 
        "http://localhost:3001",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://cloudidada121.vercel.app",
        "https://cloudidada.vercel.app",
        "https://*.vercel.app"
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
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

// Initialize Firebase asynchronously
const initializeFirebase = async () => {
    // Check if Firebase environment variables are available
    const hasFirebaseConfig = process.env.FIREBASE_PROJECT_ID && 
                              process.env.FIREBASE_PRIVATE_KEY && 
                              process.env.FIREBASE_CLIENT_EMAIL;

    console.log('🔍 Firebase environment check:', {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        projectId: process.env.FIREBASE_PROJECT_ID
    });

    if (hasFirebaseConfig) {
        try {
            // Check if Firebase app already exists
            try {
                admin = require('firebase-admin');
                firebase = admin.app(); // Try to get existing app
                db = firebase.firestore();
                console.log('✅ Firebase Admin app already initialized');
            } catch (noAppError) {
                // App doesn't exist, create new one
                admin = require('firebase-admin');
                
                console.log('🔧 Creating new Firebase Admin app...');
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
                    credential: admin.credential.cert(serviceAccount)
                });

                db = admin.firestore();
                firebase = admin;
                console.log('✅ Firebase Admin initialized successfully');
            }
            
            // Test Firebase connection with more specific error handling
            console.log('🧪 Testing Firebase connection...');
            await db.collection('test').limit(1).get();
            console.log('🔥 Firebase Firestore connected and accessible');
            
        } catch (error) {
            console.error('❌ Firebase connection test failed:', error.message);
            console.error('🔍 Error code:', error.code);
            console.error('🔍 Error details:', error.details);
            
            if (error.code === 5) {
                console.log('💡 Error code 5 means NOT_FOUND - possible causes:');
                console.log('   1. Firebase project does not exist');
                console.log('   2. Firestore database is not enabled for this project');
                console.log('   3. Service account doesn\'t have proper permissions');
                console.log('   4. Project ID in .env doesn\'t match actual Firebase project');
            }
            
            console.log('⚠️ Disabling Firebase due to connection issues');
            console.log('🔄 Application will use memory storage as fallback');
            db = null;
            firebase = null;
        }
    } else {
        console.log('⚠️ Firebase environment variables not configured');
        console.log('💡 To use Firebase, set these environment variables:');
        console.log('   - FIREBASE_PROJECT_ID');
        console.log('   - FIREBASE_PRIVATE_KEY');
        console.log('   - FIREBASE_CLIENT_EMAIL');
        console.log('🔄 Using memory storage only');
        db = null;
        firebase = null;
    }
};

// Initialize Firebase without blocking server startup
initializeFirebase().catch(error => {
    console.error('Firebase initialization failed:', error.message);
    db = null;
    firebase = null;
});

// Cloudinary configuration
try {
    // Check if we have environment variables for Cloudinary
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
        console.log('⚠️ Cloudinary environment variables not found');
        console.log('💡 Please set the following environment variables:');
        console.log('   - CLOUDINARY_CLOUD_NAME');
        console.log('   - CLOUDINARY_API_KEY');
        console.log('   - CLOUDINARY_API_SECRET');
        throw new Error('Missing Cloudinary environment variables');
    }
    
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret
    });
    
    console.log('✅ Cloudinary configured successfully with environment variables');
    console.log(`☁️ Cloud Name: ${cloudName}`);
} catch (error) {
    console.error('❌ Cloudinary configuration failed:', error.message);
    console.log('⚠️ Cloudinary uploads will fail without proper configuration');
    console.log('🔧 Please configure Cloudinary environment variables in Vercel dashboard');
}

// Memory storage fallback
const memoryStorage = {
    users: new Map(),
    files: new Map(),
    activities: new Map(),
    apiKeys: new Map()
};

// Multer configuration for file uploads - Serverless compatible
const upload = multer({
    storage: process.env.VERCEL ? multer.memoryStorage() : multer.diskStorage({
        destination: 'uploads/temp/'
    }),
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

// Cloudinary upload helper with fallback - Serverless compatible
const uploadToCloudinary = async (fileInput, options = {}) => {
    try {
        let result;
        
        if (process.env.VERCEL && Buffer.isBuffer(fileInput)) {
            // Serverless: Upload from buffer
            result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: options.folder || 'cloudidada',
                        tags: options.tags || [],
                        resource_type: options.resource_type || 'auto',
                        transformation: options.transformation || []
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(fileInput);
            });
        } else {
            // Local development: Upload from file path
            result = await cloudinary.uploader.upload(fileInput, {
                folder: options.folder || 'cloudidada',
                tags: options.tags || [],
                resource_type: options.resource_type || 'auto',
                transformation: options.transformation || []
            });
        }
        
        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error.message);
        
        // For serverless, we can't use local fallback
        if (process.env.VERCEL) {
            return {
                success: false,
                error: error.message
            };
        }
        
        // Fallback: Create local file storage (local development only)
        console.log('📁 Creating local file storage...');
        
        const fs = require('fs');
        const path = require('path');
        
        // Ensure uploads directory exists
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads', { recursive: true });
        }
        
        // Create unique filename
        const fileName = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const fileExtension = path.extname(fileInput);
        const newFileName = fileName + fileExtension;
        const newFilePath = `uploads/${newFileName}`;
        
        // Copy file to uploads directory
        fs.copyFileSync(fileInput, newFilePath);
        
        const mockResult = {
            public_id: `local/${newFileName}`,
            url: `http://localhost:3000/uploads/${newFileName}`,
            secure_url: `http://localhost:3000/uploads/${newFileName}`,
            format: path.extname(fileInput).substring(1),
            resource_type: 'image',
            bytes: fs.statSync(fileInput).size,
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
                console.log('🔍 Checking API key in Firebase...');
                const snapshot = await db.collection('users').where('apiKey', '==', apiKey).get();
                if (!snapshot.empty) {
                    const userData = snapshot.docs[0].data();
                    req.user = userData;
                    // Cache in memory for faster access
                    memoryStorage.apiKeys.set(apiKey, userData);
                    console.log('✅ API key found in Firebase');
                    return next();
                }
            } catch (error) {
                console.error('❌ Firebase API key lookup failed:', error.message);
                console.log('⚠️ Disabling Firebase for this session due to connection issues');
                // Disable Firebase for this session
                db = null;
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

    // Always store in memory first
    memoryStorage.activities.set(activity.id, activity);

    // Try Firebase only if available and connected
    if (db) {
        try {
            await db.collection('activities').add(activity);
            console.log('📊 Activity logged to Firebase');
        } catch (error) {
            console.error('⚠️ Firebase activity logging failed, using memory only:', error.message);
            // Disable Firebase if it's consistently failing
            if (error.code === 5) {
                console.log('🔴 Disabling Firebase due to NOT_FOUND errors');
                db = null;
                firebase = null;
            }
        }
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

    // Add new API key from atharva.html
    const newApiKey = 'cld_s7egj0b0er8';
    const newUser = {
        userId: 'new_user_001',
        userName: 'New Upload User',
        email: 'newuser@cloudidada.com',
        apiKey: newApiKey,
        plan: 'free',
        usage: { storage: 0, requests: 0 },
        createdAt: new Date().toISOString()
    };

    memoryStorage.users.set('new_user_001', newUser);
    memoryStorage.apiKeys.set(newApiKey, newUser);

    if (db) {
        try {
            await db.collection('users').doc('custom_user_001').set(customUser);
            await db.collection('users').doc('atharva_user_001').set(atharvaUser);
            await db.collection('users').doc('new_user_001').set(newUser);
            console.log('👤 Custom users stored in Firebase');
        } catch (error) {
            console.error('⚠️ Firebase save failed (using memory fallback):', error.message);
        }
    }

    console.log(`🔑 Custom API key ${customApiKey} stored in memory storage`);
    console.log(`🔑 Atharva API key ${atharvaApiKey} stored in memory storage`);
    console.log(`🔑 New API key ${newApiKey} stored in memory storage`);
    return customApiKey;
};

// Routes

// Database initialization endpoint
app.get('/api/init-db', async (req, res) => {
    try {
        if (!db) {
            return res.json({
                success: false,
                message: 'Firebase not connected, using memory storage',
                troubleshooting: {
                    hasConfig: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    steps: [
                        '1. Go to https://console.firebase.google.com/',
                        '2. Create a new project or select existing project "cloudidada"',
                        '3. Go to Firestore Database and click "Create database"',
                        '4. Choose "Start in test mode" for now',
                        '5. Select a location (any location is fine)',
                        '6. Go to Project Settings > Service Accounts',
                        '7. Generate new private key if needed'
                    ]
                }
            });
        }

        // Try to create/verify collections exist
        await db.collection('users').doc('test').set({ test: true });
        await db.collection('files').doc('test').set({ test: true });
        await db.collection('activities').doc('test').set({ test: true });
        
        // Clean up test documents
        await db.collection('users').doc('test').delete();
        await db.collection('files').doc('test').delete();
        await db.collection('activities').doc('test').delete();

        res.json({
            success: true,
            message: 'Database collections initialized successfully'
        });
    } catch (error) {
        console.error('Database initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Database initialization failed',
            error: error.message,
            troubleshooting: {
                errorCode: error.code,
                possibleCauses: error.code === 5 ? [
                    'Firestore database not enabled in Firebase project',
                    'Project ID mismatch in environment variables',
                    'Service account permissions insufficient'
                ] : ['Unknown error - check Firebase console']
            }
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'CloudIdada server is running',
        timestamp: new Date().toISOString(),
        services: {
            firebase: !!firebase,
            cloudinary: !!cloudinary,
            realtime: !process.env.VERCEL // Only true for local development
        },
        environment: process.env.VERCEL ? 'serverless' : 'development',
        storage: {
            firebase: !!db,
            memory: true,
            cloudinary: true
        },
        memoryStats: {
            users: memoryStorage.users.size,
            files: memoryStorage.files.size,
            apiKeys: memoryStorage.apiKeys.size
        }
    });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Registration attempt:', req.body);
    
    try {
        const { email, password, userName } = req.body;

        if (!email || !password || !userName) {
            console.log('❌ Missing fields:', { email: !!email, password: !!password, userName: !!userName });
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, password, and userName are required'
            });
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const apiKey = `cld_${Math.random().toString(36).substring(2, 15)}`;
        
        console.log('🔐 Hashing password...');
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

        console.log('💾 Storing user data...');
        // Always store in memory first
        memoryStorage.users.set(userId, userData);
        memoryStorage.apiKeys.set(apiKey, userData);
        console.log('✅ User data stored in memory');

        // Try Firebase only if available
        if (db) {
            try {
                await db.collection('users').doc(userId).set(userData);
                console.log('👤 User stored in Firebase');
            } catch (error) {
                console.error('⚠️ Firebase save failed (using memory fallback):', error.message);
                // Disable Firebase if it's consistently failing
                if (error.code === 5) {
                    console.log('🔴 Disabling Firebase due to NOT_FOUND errors');
                    db = null;
                    firebase = null;
                }
            }
        }

        await addActivity('user_registered', {
            userName,
            email,
            apiKey
        });

        console.log('✅ Registration successful for:', userName);
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
        console.error('❌ Registration error:', error);
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

        // Check Firebase if not found in memory and Firebase is available
        if (!userData && db) {
            try {
                const snapshot = await db.collection('users').where('email', '==', email).get();
                if (!snapshot.empty) {
                    userData = snapshot.docs[0].data();
                    // Cache in memory for faster access
                    memoryStorage.users.set(userData.userId, userData);
                    memoryStorage.apiKeys.set(userData.apiKey, userData);
                    console.log('✅ User found in Firebase and cached');
                }
            } catch (error) {
                console.error('⚠️ Firebase user lookup failed:', error.message);
                // Disable Firebase if it's consistently failing
                if (error.code === 5) {
                    console.log('🔴 Disabling Firebase due to NOT_FOUND errors');
                    db = null;
                    firebase = null;
                }
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

        const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        console.log('☁️ Uploading directly to Cloudinary...');
        
        // Handle serverless (buffer) vs local (file path)
        const fileInput = process.env.VERCEL ? req.file.buffer : req.file.path;
        tempFilePath = process.env.VERCEL ? null : req.file.path;
        
        const cloudinaryResult = await uploadToCloudinary(fileInput, {
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
        // Clean up temporary file (only for local development)
        if (tempFilePath && !process.env.VERCEL) {
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
    let usingFirebase = false;

    // Always try memory storage first for better performance
    for (const [fileId, fileData] of memoryStorage.files) {
        if (fileData.userId === req.user.userId) {
            if (!folder || folder === 'all' || fileData.folder === folder) {
                if (!format || (fileData.mimetype && fileData.mimetype.includes(format))) {
                    userFiles.push({ id: fileId, ...fileData });
                }
            }
        }
    }

    // If no files in memory and Firebase is available, try Firebase
    if (userFiles.length === 0 && db) {
        try {
            console.log('📁 Attempting to fetch files from Firebase...');
            let query = db.collection('files').where('userId', '==', req.user.userId);
            
            if (folder && folder !== 'all') {
                query = query.where('folder', '==', folder);
            }
            
            // Try with ordering first, fallback without ordering if index doesn't exist
            let snapshot;
            try {
                snapshot = await query.orderBy('uploadedAt', 'desc').get();
            } catch (orderError) {
                console.log('⚠️ Index for uploadedAt not found, fetching without ordering');
                snapshot = await query.get();
            }
            
            const firebaseFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Cache Firebase files in memory for faster access
            firebaseFiles.forEach(file => {
                memoryStorage.files.set(file.id, file);
            });
            
            userFiles = firebaseFiles;
            usingFirebase = true;
            
            // Sort manually if we couldn't order in query
            if (userFiles.length > 0 && userFiles[0].uploadedAt) {
                userFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
            }
            
            if (format) {
                userFiles = userFiles.filter(file => file.mimetype && file.mimetype.includes(format));
            }
            
            console.log(`✅ Fetched ${userFiles.length} files from Firebase`);
            
        } catch (error) {
            console.error('❌ Firebase query failed:', error.message);
            console.log('⚠️ Firebase database may not exist or credentials are invalid');
            console.log('🔄 Continuing with memory storage only');
            
            // Set db to null to avoid future Firebase attempts
            db = null;
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
            },
            meta: {
                source: usingFirebase ? 'firebase' : 'memory',
                firebaseConnected: !!db,
                totalFilesInMemory: memoryStorage.files.size
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

// WebSocket connection handling (only for local development)
if (!process.env.VERCEL && io && io.on) {
    io.on('connection', (socket) => {
        console.log('📱 Client connected for real-time updates');
        
        socket.on('disconnect', () => {
            console.log('📱 Client disconnected');
        });
    });
}

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
    
    // Only start server if not in Vercel environment and server exists
    if (!process.env.VERCEL && server) {
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
   Data → Firebase/Memory Storage
   Updates → Real-time WebSocket
==========================================`);
        });
    } else {
        console.log('🌐 Running in Vercel serverless environment');
        await setupDefaultApiKey();
        await setupCustomApiKey();
    }
};

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // Check if response is already sent
    if (res.headersSent) {
        return next(error);
    }
    
    // Send JSON error response
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        message: `The endpoint ${req.originalUrl} does not exist`,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown (only for local development)
if (!process.env.VERCEL && server) {
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
}

// Initialize for both local and Vercel environments
if (process.env.VERCEL) {
    // For Vercel, just initialize without starting server
    console.log('🌐 Initializing for Vercel...');
    setupDefaultApiKey().catch(console.error);
    setupCustomApiKey().catch(console.error);
} else {
    // For local development, start the server
    startServer().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

// Export for Vercel serverless functions
module.exports = app;
