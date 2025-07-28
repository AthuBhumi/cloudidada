# 🚀 CloudIdada Production Build

## 📦 Installation Guide

### 1. Upload to Hostinger
1. Create ZIP file of `build` folder
2. Upload to cPanel File Manager
3. Extract in `public_html` folder
4. Set file permissions to 755

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Update `.env` file with your production values:
```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Your Cloudinary Credentials
CLOUDINARY_CLOUD_NAME=cloudybaba
CLOUDINARY_API_KEY=482966548833695
CLOUDINARY_API_SECRET=gCsbP2_61aNPORLfXsT45Jv5uv8

# Firebase Configuration (if using)
FIREBASE_PROJECT_ID=cloudidada
# ... other Firebase credentials
```

### 4. Start Application
```bash
# Production start
npm start

# Or development mode
npm run dev
```

## 🌐 Access URLs

After deployment on `yourdomain.com`:

- **Main Dashboard**: `https://yourdomain.com/`
- **Upload Form**: `https://yourdomain.com/atharva.html`
- **My Files**: `https://yourdomain.com/my-files.html`
- **API Health**: `https://yourdomain.com/api/health`
- **Debug Tools**: `https://yourdomain.com/debug-upload.html`

## 🔑 API Key System

- **Auto-generation**: Any API key starting with `cld_` (10+ chars) works automatically
- **Your API Key**: `cld_e9tmoa7gudh` (already configured in atharva.html)
- **Custom Keys**: Users can create their own `cld_anything123` format

## 📁 File Structure

```
/
├── production-server-direct.js  # Main server file
├── package.json                 # Dependencies
├── .env                        # Environment variables
└── public/                     # Static files
    ├── atharva.html           # Upload form
    ├── my-files.html          # File dashboard
    ├── index.html             # Main page
    └── ...other files
```

## 🛠️ Features

✅ **File Upload**: Images, videos, documents, text files
✅ **Cloudinary Integration**: Real cloud storage
✅ **Auto API Keys**: No manual registration needed
✅ **User Dashboard**: Personal file management
✅ **Real-time Updates**: WebSocket support
✅ **CORS Ready**: Multiple domain support

## 🔧 Troubleshooting

### Common Issues:
1. **CORS Error**: Add your domain to `CORS_ORIGIN` in `.env`
2. **API Key Invalid**: Ensure format is `cld_xxxxxxxxxx`
3. **Upload Failed**: Check Cloudinary credentials
4. **Port Issues**: Default is 3000, change in `.env` if needed

### Support:
- Check logs: `npm start` shows real-time logs
- API Test: Visit `/api/health` for status
- Debug Mode: Use `/debug-upload.html` for testing

## 🚀 Ready for Production!

All files are optimized and ready for deployment on Hostinger or any Node.js hosting platform.
