# CloudIdada - Personal Storage Platform

![CloudIdada](https://img.shields.io/badge/CloudIdada-v1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.18+-red.svg)
![Firebase](https://img.shields.io/badge/Firebase-Admin-orange.svg)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Connected-yellow.svg)

A modern cloud storage platform with Firebase & Cloudinary integration, featuring real-time file management, user authentication, and API-based file operations.

## 🚀 Features

- **🔐 User Authentication** - Register/Login with JWT tokens
- **📁 File Upload** - Direct upload to Cloudinary storage
- **📊 Real-time Dashboard** - Live file management interface
- **🔑 API Key System** - Auto-generated API keys for users
- **💾 Dual Storage** - Firebase Firestore + Memory fallback
- **🌐 Real-time Updates** - WebSocket integration
- **📱 Responsive UI** - Clean, modern interface
- **🚀 Vercel Ready** - Configured for serverless deployment

## 📋 Prerequisites

Before running this project, make sure you have:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (v8 or higher) - Comes with Node.js
- **Git** - [Download here](https://git-scm.com/)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/AthuBhumi/cloudidada.git
cd cloudidada
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

The `.env` file is already configured with working credentials. If you need to modify:

```bash
# Copy the environment template (already configured)
cp .env.example .env
```

**Environment Variables:**
- ✅ Firebase credentials (pre-configured)
- ✅ Cloudinary account (cloudybaba - working)
- ✅ JWT secrets and CORS settings

## 🚀 Running the Application

### Development Server

```bash
npm start
```

This will start the server at: **http://localhost:3000**

### Development with Auto-reload

```bash
npm run dev
```

### Health Check

```bash
npm run health
```

## 📁 Project Structure

```
cloudidada/
├── public/                    # Frontend files
│   ├── index.html            # Main dashboard & auth
│   ├── atharva.html          # File upload form
│   ├── my-files.html         # File viewer
│   └── dashboard.html        # User dashboard
├── production-server-direct.js # Main server file
├── package.json              # Dependencies
├── .env                      # Environment variables
├── vercel.json              # Vercel deployment config
└── README.md                # This file
```

## 🌐 Available Endpoints

### Web Pages
- **Main Dashboard**: http://localhost:3000
- **Upload Form**: http://localhost:3000/atharva.html
- **My Files**: http://localhost:3000/my-files.html
- **User Dashboard**: http://localhost:3000/dashboard.html

### API Endpoints
- **Health Check**: `GET /api/health`
- **User Registration**: `POST /api/auth/register`
- **User Login**: `POST /api/auth/login`
- **File Upload**: `POST /api/upload`
- **Get Files**: `GET /api/files`
- **Delete File**: `DELETE /api/files/:id`

## 🔑 API Usage

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Upload a File
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "x-api-key: YOUR_API_KEY" \
  -F "file=@/path/to/your/file.jpg"
```

### Get Your Files
```bash
curl -X GET http://localhost:3000/api/files \
  -H "x-api-key: YOUR_API_KEY"
```

## 🔧 Configuration

### Firebase Setup
- Project ID: `cloudidada`
- Authentication: Service Account (pre-configured)
- Database: Firestore (with memory fallback)

### Cloudinary Setup
- Cloud Name: `cloudybaba`
- Account: Working credentials included
- Upload folder: `cloudidada`

### File Upload Limits
- Max file size: `10MB`
- Allowed types: Images, Videos, PDFs, Text files

## 🚀 Deployment

### Vercel Deployment

1. **Push to GitHub** (already done):
```bash
git push origin main
```

2. **Deploy to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables (from `.env`)
   - Deploy

3. **Environment Variables for Vercel**:
```
CLOUDINARY_CLOUD_NAME=cloudybaba
CLOUDINARY_API_KEY=482966548833695
CLOUDINARY_API_SECRET=gCsbP2_61aNPORLfXsT45Jv5uv8
```

### Local Production Test
```bash
NODE_ENV=production npm start
```

## 🎯 Usage Guide

### 1. Register an Account
1. Visit http://localhost:3000
2. Fill in the registration form
3. Get your auto-generated API key

### 2. Upload Files
1. Go to http://localhost:3000/atharva.html
2. Enter your name and select files
3. Files upload directly to Cloudinary

### 3. View Your Files
1. Visit http://localhost:3000/my-files.html
2. Use your API key to view files
3. Real-time updates via WebSocket

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
npm start
```

### Firebase Connection Issues
- Firebase errors are normal in development
- App works with memory storage fallback
- Files still upload to Cloudinary successfully

### Dependency Issues
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## 📊 Monitoring

### Server Health
- Health endpoint: http://localhost:3000/api/health
- Console logs show service status
- WebSocket connection status

### Storage Status
- Firebase: Connection status in logs
- Cloudinary: Upload success/failure
- Memory: Fallback storage active

## 🔐 Security Features

- **JWT Authentication** with 7-day expiry
- **Rate Limiting** (100 requests per 15 minutes)
- **CORS Protection** for specific origins
- **API Key Validation** for file operations
- **Helmet.js** security headers

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the console logs for error messages
2. Verify your `.env` file configuration
3. Ensure all dependencies are installed
4. Check if port 3000 is available

**Need help?** Create an issue on GitHub with:
- Error message
- Steps to reproduce
- Your environment (Node.js version, OS)

## 🎉 Success Indicators

When everything is working correctly, you'll see:

```
🎉 CloudIdada Production Server Started!
==========================================
📊 Dashboard: http://localhost:3000
🔗 API Health: http://localhost:3000/api/health
📡 WebSocket: ws://localhost:3000
🔑 Your API Key: cld_demo_xxxxx
==========================================
🔥 Services Status:
   Firebase: ✅ Connected
   Cloudinary: ✅ Connected
   Real-time: ✅ Active
==========================================
```

---

**CloudIdada** - Built with ❤️ using Node.js, Express, Firebase, and Cloudinary
