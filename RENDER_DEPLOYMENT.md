# Render Deployment Guide

This guide provides step-by-step instructions for deploying Legal-ease to Render.

## Overview

The application consists of three services:
- **PostgreSQL Database** - Managed PostgreSQL instance
- **Backend API** - FastAPI application (Python)
- **Frontend** - React SPA served by Nginx

## Prerequisites

1. A [Render account](https://render.com)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Required API keys and credentials

## Deployment Steps

### Option 1: Deploy with render.yaml (Recommended)

1. **Connect your repository to Render**
   - Go to https://dashboard.render.com
   - Click "New" → "Blueprint"
   - Connect your Git repository
   - Select the repository containing this code

2. **Render will automatically detect the `render.yaml` file**
   - Review the services that will be created
   - Click "Apply" to create all services

3. **Configure environment variables** (see section below)

### Option 2: Manual Deployment

If you prefer to create services manually:

1. **Create PostgreSQL Database**
   - Go to Render Dashboard → "New" → "PostgreSQL"
   - Name: `legal-ease-db`
   - Database: `legal_ease`
   - User: `legal_ease_user`
   - Plan: Free (or higher)
   - Region: Oregon (or your preferred region)
   - Click "Create Database"

2. **Create Backend Service**
   - Go to Render Dashboard → "New" → "Web Service"
   - Connect your repository
   - Name: `legal-ease-backend`
   - Region: Oregon (same as database)
   - Branch: `main` (or your default branch)
   - Root Directory: `backend`
   - Environment: Docker
   - Dockerfile Path: `./backend/Dockerfile`
   - Plan: Free (or higher)
   - Add environment variables (see below)
   - Click "Create Web Service"

3. **Create Frontend Service**
   - Go to Render Dashboard → "New" → "Web Service"
   - Connect your repository
   - Name: `legal-ease-frontend`
   - Region: Oregon
   - Branch: `main`
   - Root Directory: `frontend`
   - Environment: Docker
   - Dockerfile Path: `./frontend/Dockerfile`
   - Plan: Free (or higher)
   - Add build environment variable:
     - `VITE_API_URL`: Use the backend service URL (e.g., `https://legal-ease-backend.onrender.com`)
   - Click "Create Web Service"

## Environment Variables

### Backend Service

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `production` |
| `DOMAIN` | Backend domain (auto-set by Render) | `legal-ease-backend.onrender.com` |
| `FRONTEND_HOST` | Frontend URL | `https://legal-ease-frontend.onrender.com` |
| `BACKEND_CORS_ORIGINS` | Allowed CORS origins (JSON array) | `["https://legal-ease-frontend.onrender.com"]` |
| `SECRET_KEY` | JWT secret key (auto-generate) | Use Render's "Generate" button |
| `FIRST_SUPERUSER` | Admin email | `admin@example.com` |
| `FIRST_SUPERUSER_PASSWORD` | Admin password (auto-generate) | Use Render's "Generate" button |
| `BOSON_API_KEY` | Boson AI API key | Your API key |

#### Database Variables (Auto-configured from Database)

These are automatically set when you link the database:

- `POSTGRES_SERVER`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | (empty) |
| `SMTP_USER` | SMTP username | (empty) |
| `SMTP_PASSWORD` | SMTP password | (empty) |
| `EMAILS_FROM_EMAIL` | Sender email address | `info@example.com` |
| `SMTP_TLS` | Use TLS | `True` |
| `SMTP_SSL` | Use SSL | `False` |
| `SMTP_PORT` | SMTP port | `587` |
| `SENTRY_DSN` | Sentry error tracking DSN | (empty) |
| `PROJECT_NAME` | Project name | `Legal-ease` |

### Frontend Service

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://legal-ease-backend.onrender.com` |

## Post-Deployment Configuration

### 1. Update CORS Origins

After deployment, update the backend's `BACKEND_CORS_ORIGINS` environment variable with your actual frontend URL:

```json
["https://legal-ease-frontend.onrender.com","https://your-custom-domain.com"]
```

### 2. Update Frontend Host

Set the backend's `FRONTEND_HOST` to your actual frontend URL:

```
https://legal-ease-frontend.onrender.com
```

### 3. Set Domain Variable

Set the backend's `DOMAIN` to match your backend URL (without https://):

```
legal-ease-backend.onrender.com
```

### 4. Configure Custom Domain (Optional)

If you want to use custom domains:

1. **For Frontend:**
   - Go to your frontend service settings
   - Click "Custom Domains"
   - Add your domain (e.g., `app.yourdomain.com`)
   - Update DNS records as instructed

2. **For Backend:**
   - Go to your backend service settings
   - Click "Custom Domains"
   - Add your domain (e.g., `api.yourdomain.com`)
   - Update DNS records as instructed

3. **Update Environment Variables:**
   - Update `BACKEND_CORS_ORIGINS` to include your custom frontend domain
   - Update `FRONTEND_HOST` to your custom frontend domain
   - Update `DOMAIN` to your custom backend domain
   - Update frontend's `VITE_API_URL` to your custom backend domain

### 5. Configure Email (Optional)

To enable email functionality (password reset, etc.), configure SMTP settings:

**Option A: Use SendGrid**
1. Sign up at https://sendgrid.com
2. Create an API key
3. Set environment variables:
   - `SMTP_HOST`: `smtp.sendgrid.net`
   - `SMTP_USER`: `apikey`
   - `SMTP_PASSWORD`: Your SendGrid API key
   - `SMTP_PORT`: `587`
   - `SMTP_TLS`: `True`
   - `EMAILS_FROM_EMAIL`: Your verified sender email

**Option B: Use AWS SES**
1. Set up Amazon SES
2. Configure environment variables accordingly

**Option C: Use Gmail** (for testing only)
1. Enable 2FA on your Google account
2. Generate an app password
3. Set environment variables:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_USER`: Your Gmail address
   - `SMTP_PASSWORD`: App password
   - `SMTP_PORT`: `587`
   - `SMTP_TLS`: `True`

## Monitoring and Logs

### View Logs

1. Go to your service in Render Dashboard
2. Click "Logs" tab
3. View real-time logs or search historical logs

### Health Checks

The backend service has a health check endpoint at:
```
https://your-backend-url.onrender.com/api/v1/utils/health-check
```

### Database Access

To access your database:

1. Go to your database in Render Dashboard
2. Use the connection details provided
3. Or use the built-in Adminer-like interface in Render

## Troubleshooting

### Backend Won't Start

1. **Check logs** in Render Dashboard
2. **Verify database connection**: Ensure all `POSTGRES_*` variables are set
3. **Check migrations**: Migrations run automatically via `render-start.sh`

### Frontend Shows API Errors

1. **Verify VITE_API_URL**: Must point to your backend URL
2. **Check CORS**: Backend's `BACKEND_CORS_ORIGINS` must include frontend URL
3. **Rebuild frontend**: After changing `VITE_API_URL`, trigger a manual deploy

### Database Connection Issues

1. **Check if database is healthy** in Render Dashboard
2. **Verify connection string** format
3. **Check IP whitelist** (not applicable for internal Render services)

### SSL/HTTPS Issues

- Render automatically provisions SSL certificates
- Ensure you're using `https://` in all URLs
- If using custom domains, wait for SSL certificate provisioning (can take up to 24 hours)

## Render Free Tier Limitations

- **Web Services**: Spin down after 15 minutes of inactivity (first request after spin-down takes 30-60 seconds)
- **Database**: 90-day expiration for free tier
- **Build minutes**: 500 build minutes per month
- **Bandwidth**: 100 GB per month

**To prevent spin-down:**
- Upgrade to paid plan ($7/month)
- Use an uptime monitoring service (e.g., UptimeRobot, Uptime.com)

## Scaling

To handle more traffic:

1. **Upgrade service plan** for more resources
2. **Add autoscaling** (available on paid plans)
3. **Upgrade database** to higher tier for more connections

## CI/CD

Render automatically deploys when you push to your connected branch:

1. **Auto-deploy on push** (default for main/master branch)
2. **Manual deploys**: Trigger from Render Dashboard
3. **Preview environments**: Create from pull requests (paid feature)

## Security Best Practices

1. **Use strong passwords** for `FIRST_SUPERUSER_PASSWORD` and `SECRET_KEY`
2. **Rotate secrets regularly** (especially `SECRET_KEY`)
3. **Enable Sentry** for error tracking
4. **Use environment-specific configs** (don't use the same SECRET_KEY across environments)
5. **Review Render security settings** (IP allowlists, etc.)

## Cost Optimization

1. **Start with free tier** for development
2. **Upgrade services independently** based on needs
3. **Monitor resource usage** in Render Dashboard
4. **Consider shared database** for multiple environments

## Support

- **Render Documentation**: https://render.com/docs
- **Render Community**: https://community.render.com
- **This Project**: Create an issue in your repository

## Additional Resources

- [Render Docker Deployment](https://render.com/docs/deploy-docker)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Render Custom Domains](https://render.com/docs/custom-domains)
