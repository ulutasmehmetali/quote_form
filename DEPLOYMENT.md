# 🚀 Vercel Deployment Guide

Complete guide for deploying MIYOMINT to Vercel with all features working.

## 📋 Prerequisites

- GitHub account
- Vercel account ([Sign up free](https://vercel.com/signup))
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## ⚡ Pre-Deployment Setup

The project includes `@vercel/blob` in dependencies for photo upload functionality. Make sure all dependencies are installed:

```bash
npm install
```

## 🎯 Quick Deploy (Recommended)

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - MIYOMINT platform"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/miyomint.git

# Push to GitHub
git push -u origin main
```

### Step 2: Deploy to Vercel

1. **Go to [Vercel Dashboard](https://vercel.com/new)**
2. **Click "Import Project"**
3. **Select your GitHub repository**
4. **Configure Project:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
   - Install Command: `npm install` (auto-detected)

5. **Enable Vercel Blob Storage:**
   - Go to **Storage** tab
   - Click **"Create Database"** → **"Blob"**
   - Vercel automatically creates `BLOB_READ_WRITE_TOKEN`

6. **Add Environment Variables:**
   Click "Environment Variables" and add:
   
   | Name | Value |
   |------|-------|
   | `OPENAI_API_KEY` | `sk-...` (your OpenAI API key) |
   
   _(Note: `BLOB_READ_WRITE_TOKEN` is auto-created when you enable Blob Storage)_

7. **Click "Deploy"** 🚀

### Step 3: Verify Deployment

1. Wait for build to complete (~2-3 minutes)
2. Click on your deployment URL
3. Test AI search functionality
4. Verify all features work

## ✅ What's Included

The project is **pre-configured** for Vercel deployment:

- ✅ **`api/suggest.ts`** - Vercel Edge Function for AI suggestions
- ✅ **`vercel.json`** - Deployment configuration
- ✅ **Build scripts** - Optimized for production
- ✅ **Environment handling** - Secure secrets management
- ✅ **CORS headers** - Proper API configuration

## 🔧 Manual Configuration (Advanced)

### Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Link to existing project? No
# - What's your project's name? miyomint
# - In which directory is your code located? ./
# - Want to override settings? No

# Add environment variables
vercel env add OPENAI_API_KEY production

# Deploy to production
vercel --prod
```

## 🌐 API Endpoints

After deployment, your API will be available at:

```
https://your-project.vercel.app/api/suggest
```

### Testing the API

```bash
curl -X POST https://your-project.vercel.app/api/suggest \
  -H "Content-Type: application/json" \
  -d '{"query":"my roof is leaking"}'
```

Expected response:
```json
{
  "suggestions": [
    {
      "service": "Roofing",
      "reason": "Specialized in roof repairs and leak fixes"
    }
  ]
}
```

## 📊 File Structure on Vercel

```
your-vercel-deployment/
├── api/
│   └── suggest.ts          # Edge Function (auto-detected)
├── dist/                   # Built frontend (auto-generated)
│   ├── index.html
│   ├── assets/
│   └── ...
└── vercel.json            # Configuration
```

## 🔐 Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

### Required
- **`OPENAI_API_KEY`**: Your OpenAI API key (required for AI search)

### Optional
- **`VITE_SUPABASE_URL`**: Supabase project URL (if using database)
- **`VITE_SUPABASE_ANON_KEY`**: Supabase anonymous key (if using database)

## 🎨 Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `miyomint.com`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate (~10 minutes)

## 📸 Photo Upload on Vercel

The project includes **Vercel Blob Storage** support (ready to activate):

### Enable Vercel Blob

1. **Install package:**
```bash
npm install @vercel/blob
```

2. **Add to Vercel:**
   - Dashboard → Storage → Create Blob Store
   - Vercel automatically adds `BLOB_READ_WRITE_TOKEN`

3. **Update storage provider:**
   - Go to Environment Variables
   - Add: `STORAGE_PROVIDER=vercel`
   - Redeploy

The storage abstraction layer will automatically switch to Vercel Blob!

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure Node.js version compatibility (20+)

### API Not Working
- Verify `OPENAI_API_KEY` is set correctly
- Check API logs in Vercel dashboard
- Test with curl command above

### CORS Errors
- Edge Function includes proper CORS headers
- Check browser console for specific errors

### 404 Errors
- Verify `vercel.json` is in project root
- Check rewrites configuration
- Redeploy after fixing

## 💰 Cost Estimate

**Vercel Free Tier includes:**
- ✅ 100GB bandwidth/month
- ✅ 100GB-hours Serverless Function execution/month
- ✅ 500k Edge Function invocations/month
- ✅ Automatic SSL certificates
- ✅ Custom domains

**Additional costs:**
- OpenAI API: ~$0.001 per search (~$5-10/month)
- Vercel Blob Storage: 100MB free, then $0.15/GB/month
- Vercel Pro: $20/month (for commercial use)

**Upload Limits:**
- Photo upload: Max 2MB per photo, 2.5MB total across all photos
- Edge Functions: ~4.5MB request payload limit (enforced by platform)
- Multipart encoding adds ~33% overhead, so 2.5MB file limit (with overhead = ~3.3MB) stays safely under Edge runtime constraints
- **Tip**: Compress photos before upload to fit within limits (most phones capture 3-5MB images by default)

## 🔄 Continuous Deployment

Every push to `main` branch automatically deploys to production!

```bash
# Make changes
git add .
git commit -m "Update feature"
git push origin main

# Vercel automatically deploys! 🎉
```

## 📱 Preview Deployments

Every pull request gets a unique preview URL:
- Separate deployment for each PR
- Test before merging to production
- Automatic cleanup when PR is closed

## 🎯 Production Checklist

Before going live:

- [ ] OpenAI API key is set
- [ ] Custom domain configured (optional)
- [ ] Analytics added (optional)
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Test all features on production URL
- [ ] Verify mobile responsiveness
- [ ] Check AI search functionality
- [ ] Test photo upload (if enabled)

## 🆘 Support

**Vercel Issues:**
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

**Project Issues:**
- Open issue on GitHub
- Check project README.md

---

**Your project is now live on Vercel! 🎉**

Access at: `https://your-project.vercel.app`
