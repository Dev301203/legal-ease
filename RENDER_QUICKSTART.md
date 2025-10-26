# Render Quick Start Guide

## Deploy in 5 Minutes

### Step 1: Push to Git
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Create Render Account
1. Go to https://render.com and sign up
2. Connect your GitHub/GitLab account

### Step 3: Deploy with Blueprint
1. In Render Dashboard, click **"New"** → **"Blueprint"**
2. Select your repository (`legal-ease`)
3. Render will detect `render.yaml` and show 3 services:
   - PostgreSQL Database
   - Backend API
   - Frontend

4. Click **"Apply"** to create all services

### Step 4: Configure Required Environment Variables

After deployment, configure these in the **Backend Service**:

1. Go to your backend service → **Environment** tab

2. **Update these auto-generated variables:**
   - `DOMAIN`: Set to your backend URL (e.g., `legal-ease-backend.onrender.com`)
   - `FRONTEND_HOST`: Set to your frontend URL (e.g., `https://legal-ease-frontend.onrender.com`)
   - `BACKEND_CORS_ORIGINS`: Set to `["https://legal-ease-frontend.onrender.com"]`
   - `FIRST_SUPERUSER`: Your admin email
   - `BOSON_API_KEY`: Your Boson AI API key

3. **Verify these were auto-generated:**
   - `SECRET_KEY` (should be a long random string)
   - `FIRST_SUPERUSER_PASSWORD` (should be a strong password - save this!)

4. Click **"Save Changes"** and wait for the service to redeploy

### Step 5: Access Your Application

1. **Frontend**: Click the URL shown in your frontend service (e.g., `https://legal-ease-frontend.onrender.com`)
2. **Backend API Docs**: Visit `https://your-backend-url.onrender.com/docs`
3. **Login**: Use `FIRST_SUPERUSER` email and `FIRST_SUPERUSER_PASSWORD`

### Step 6: First Request (Important!)

⚠️ **Render free tier services spin down after 15 minutes of inactivity.**

The first request after spin-down takes 30-60 seconds to wake up. This is normal!

## Essential URLs

After deployment, bookmark these:

- **Frontend**: `https://legal-ease-frontend.onrender.com`
- **Backend API**: `https://legal-ease-backend.onrender.com`
- **API Documentation**: `https://legal-ease-backend.onrender.com/docs`
- **Health Check**: `https://legal-ease-backend.onrender.com/api/v1/utils/health-check`

## Common Issues & Quick Fixes

### "API request failed" in frontend
**Fix**: Update backend's `BACKEND_CORS_ORIGINS` to include your frontend URL

### Backend shows database errors
**Fix**: Database variables are auto-configured. If errors persist, check database status in Render Dashboard

### Frontend shows wrong API URL
**Fix**:
1. Go to frontend service → Environment
2. Update `VITE_API_URL` to your backend URL
3. Save and trigger manual deploy

### Forgot admin password
**Fix**:
1. Go to backend service → Environment
2. View `FIRST_SUPERUSER_PASSWORD` value
3. Or generate new password and redeploy

## Next Steps

1. **Set up custom domain** (optional) - See `RENDER_DEPLOYMENT.md`
2. **Configure email** (optional) - See `RENDER_DEPLOYMENT.md` → Email Configuration
3. **Enable error tracking** (optional) - Add Sentry DSN
4. **Upgrade to paid plan** ($7/month) - Prevents service spin-down

## Need More Help?

See detailed guide: `RENDER_DEPLOYMENT.md`

## Monitoring Your Free Services

Free tier limitations:
- Services sleep after 15 minutes of inactivity
- First request after sleep: 30-60 seconds
- 500 build minutes/month
- 100 GB bandwidth/month

To keep services awake (without upgrading):
- Use a free uptime monitor (e.g., UptimeRobot.com)
- Set it to ping your backend health check every 14 minutes

## Useful Commands

### View Logs
```
Render Dashboard → Your Service → Logs tab
```

### Trigger Manual Deploy
```
Render Dashboard → Your Service → Manual Deploy button
```

### Check Database
```
Render Dashboard → legal-ease-db → Connect
```

## Security Checklist

- [ ] Changed `SECRET_KEY` from default
- [ ] Strong `FIRST_SUPERUSER_PASSWORD`
- [ ] Updated `BACKEND_CORS_ORIGINS` with actual frontend URL
- [ ] Kept `BOSON_API_KEY` secret (never commit to git)
- [ ] Reviewed environment variables in Render Dashboard

## Support

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com
- **Community**: https://community.render.com

---

**Ready to deploy?** → https://dashboard.render.com/blueprints
