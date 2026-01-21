# Sláinte Finance V2 - Setup Guide

**Version:** 2.0.0
**Last Updated:** 2025-01-12
**Architecture:** Electron Desktop + Express API + Mobile PWA

---

## 🎉 What's New in V2

### Key Improvements:
✅ **Electron Desktop App** - Installable Windows application
✅ **Built-in API Server** - Express server runs inside Electron (port 3001)
✅ **No More Proxy Server** - Direct Claude API calls in Electron, secure IPC bridge
✅ **Mobile-Ready API** - RESTful endpoints for mobile PWA access
✅ **Clean Architecture** - Removed all legacy/redundant files from V1
✅ **JWT Authentication** - Secure token-based auth for partners
✅ **Cloudflare Tunnel Ready** - Prepared for mobile device access

---

## 📁 Project Structure

```
slainteFinanceV2/
├── electron/
│   ├── main.cjs              # Electron main process + Express API server
│   └── preload.cjs           # IPC bridge for secure communication
├── src/                      # React application (copied from V1)
│   ├── components/           # All React components
│   ├── context/              # React context providers
│   ├── utils/                # Utility functions
│   │   └── claudeAPI.js      # ✨ NEW: Unified Claude API helper
│   └── ...
├── public/                   # Static assets (PWA manifest, icons, service worker)
├── dist/                     # Production build output (generated)
├── package.json              # Dependencies and scripts
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── PRODUCT_ROADMAP.md        # Long-term scaling strategy
└── SETUP_GUIDE.md           # This file!
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Windows 10/11 (for desktop app)
- Git (optional, for version control)

### Step 1: Install Dependencies

```bash
cd C:\Users\user\slainteFinanceV2
npm install
```

This will install:
- React and UI libraries
- Electron for desktop app
- Express for API server
- JWT for authentication
- All other dependencies

**Note:** This may take 3-5 minutes on first install.

### Step 2: Configure Environment

Create a `.env` file in the project root:

```env
# JWT Secret for partner authentication (REQUIRED)
JWT_SECRET=your-random-secret-key-here

# Partner Password for mobile login (REQUIRED)
PARTNER_PASSWORD=slainte2024

# API URL for mobile PWA (REQUIRED)
VITE_API_URL=http://localhost:3001

# ===================================================================
# OPTIONAL: Development-only API key
# ===================================================================
# Uncomment ONLY for development/testing convenience.
# In production, users enter their API key during onboarding.
# ANTHROPIC_API_KEY=your-api-key-here-for-development-only
```

**Important:**
- Generate a secure JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **DO NOT add ANTHROPIC_API_KEY to .env for production** (see Security Model below)
- Users will enter their API key during the app's onboarding process

### Step 3: Run Development Mode

**Option A: Just the Web App (fastest for testing UI)**
```bash
npm run dev
```
- Opens browser at http://localhost:5173
- Hot reload enabled
- No Electron, no API server (Claude calls will fail)

**Option B: Full Electron App with API Server (recommended)**
```bash
npm run electron-dev
```
- Starts Vite dev server
- Launches Electron window
- Express API server runs on port 3001
- Full functionality including chat

### Step 4: Test the Application

Once running, verify:

1. ✅ **Desktop UI loads** - Dashboard appears
2. ✅ **Data persists** - Upload a transaction file, reload, data still there
3. ✅ **Chat works** - Open chat, send a message to Cara
4. ✅ **API server running** - Check console for `[API Server] Running on http://localhost:3001`

---

## 🏗️ Building for Production

### Build the Electron App

```bash
npm run electron-build
```

This will:
1. Build React app with Vite (`npm run build`)
2. Package Electron app with electron-builder
3. Create Windows installer in `release/` folder

**Output:**
- `release/Sláinte Finance Setup 2.0.0.exe` - Installer
- `release/win-unpacked/` - Unpacked application files

### Install on Practice Computer

1. Copy `Sláinte Finance Setup 2.0.0.exe` to practice computer
2. Run the installer
3. Follow installation wizard
4. App will be installed to `C:\Program Files\Sláinte Finance\`
5. Desktop shortcut created automatically

---

## 🔌 API Endpoints Reference

The Express server (port 3001) provides these endpoints:

### Authentication

**POST** `/api/auth/login`
```json
Request:
{
  "password": "slainte2024"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Data Endpoints (require auth token)

**GET** `/api/dashboard`
```json
Response:
{
  "income": 450000,
  "expenses": 320000,
  "profit": 130000,
  "transactionCount": 1523,
  "lastUpdated": "2025-01-12T14:30:00.000Z"
}
```

**GET** `/api/reports`
```json
Response: [
  {
    "id": "report-123",
    "type": "profit-loss",
    "generatedDate": "2025-01-10",
    "data": { ... }
  }
]
```

**GET** `/api/gms-health-check`
```json
Response:
{
  "id": "gms-report-456",
  "type": "gms-health-check",
  "generatedDate": "2025-01-11",
  "data": { ... }
}
```

**POST** `/api/chat`
```json
Request:
{
  "message": "What was my income last month?",
  "context": { ... }
}

Response:
{
  "content": [
    {
      "type": "text",
      "text": "Based on your data, your income last month was €38,500..."
    }
  ]
}
```

### Health Check

**GET** `/api/health`
```json
Response:
{
  "status": "ok",
  "timestamp": "2025-01-12T14:30:00.000Z"
}
```

---

## 🔐 API Key Security Model

**Important:** Sláinte Finance V2 uses a security-first approach for API keys.

### How API Keys Work

#### Desktop Users (Practice Manager)
1. **During First Launch:** The onboarding wizard asks users to enter their Anthropic API key
2. **Secure Storage:** Key is stored in localStorage (local to the desktop computer)
3. **Never in .env:** API keys should NOT be stored in the `.env` file for production
4. **Why This Matters:**
   - `.env` files can be accidentally committed to git or shared
   - Each practice uses their own API key (better security + individual billing)
   - If the app is distributed to other practices, they use their own keys

#### Mobile Users (Partners)
1. **No API Key Needed:** Partners never see or enter the API key
2. **Calls Route Through Desktop:** Mobile requests go to the desktop API server
3. **Desktop Handles Claude:** The desktop app makes Claude API calls on behalf of mobile users
4. **JWT Authentication:** Partners authenticate with a password, receive a token

### Security Benefits

✅ **No Accidental Exposure:** API keys never in version control or config files
✅ **Practice Isolation:** Each practice bills separately to their own Anthropic account
✅ **Partner Simplicity:** Partners don't need technical knowledge of API keys
✅ **Centralized Control:** Practice manager controls the API key, can change it anytime

### Development Convenience

For developers testing the app:
- You CAN add `ANTHROPIC_API_KEY` to `.env` for development convenience
- The app will use it as a fallback if no key is found in localStorage
- This only works when `NODE_ENV=development`
- **Never deploy to production with API key in .env**

### Where API Keys Are Stored

**Desktop:**
- Primary: `localStorage` (user-entered during onboarding)
- Fallback: `.env` file (development only)
- File location: `C:\Users\<username>\AppData\Roaming\slainte-finance-v2\localStorage.json`

**Mobile:**
- Not stored (mobile never needs the API key)

---

## 🔐 How Authentication Works

### Desktop (Electron)
- No authentication needed for local access
- Direct IPC calls to main process
- Full access to all features
- API key entered during onboarding (see Security Model above)

### Mobile (PWA)
1. Partner visits: `https://yourpractice.slainte.com`
2. Enters password (set in `.env` as `PARTNER_PASSWORD`)
3. Receives JWT token (valid 30 days)
4. Token stored in localStorage
5. All API calls include: `Authorization: Bearer <token>`

### Security Features
- JWT tokens expire after 30 days
- Tokens signed with secret key (never exposed)
- HTTPS required for production (Cloudflare Tunnel)
- Context isolation in Electron (no direct access to Node.js from renderer)

---

## 🌐 Cloudflare Tunnel Setup (For Mobile Access)

**Coming Next:** This will allow partners to access the desktop API from mobile devices.

### What is Cloudflare Tunnel?
- Creates secure tunnel from your desktop to the internet
- No port forwarding or firewall configuration needed
- Free tier available
- Stable HTTPS URL for mobile access

### Setup Steps (Phase 2)

1. **Install Cloudflare Tunnel:**
```bash
npm install -g cloudflared
```

2. **Login to Cloudflare:**
```bash
cloudflared tunnel login
```

3. **Create a tunnel:**
```bash
cloudflared tunnel create slainte-finance
```

4. **Start the tunnel:**
```bash
cloudflared tunnel --url http://localhost:3001
```

5. **Get your public URL:**
```
https://random-name-xyz.trycloudflare.com
```

6. **Update mobile PWA:**
- Set `VITE_API_URL=https://random-name-xyz.trycloudflare.com` in `.env`
- Rebuild: `npm run build`
- Deploy to Netlify

7. **Auto-start tunnel:**
- We'll integrate this into Electron main process
- Tunnel starts automatically when desktop app opens

---

## 🛠️ Troubleshooting

### Issue: Electron app won't start

**Symptoms:** Window doesn't open, or blank screen

**Solutions:**
1. Check if Vite dev server started (look for `http://localhost:5173` in console)
2. Try running just `npm run dev` first, ensure that works
3. Clear Electron cache: Delete `C:\Users\<username>\AppData\Roaming\slainte-finance-v2`
4. Check console for errors

### Issue: Chat not working

**Symptoms:** "Failed to get response from Claude"

**Solutions:**
1. Check if API key was entered during onboarding (stored in localStorage)
2. **For development:** Verify `ANTHROPIC_API_KEY` is uncommented in `.env` if using development fallback
3. Check API key is valid at https://console.anthropic.com/
4. Check console for `[API Server] Running on http://localhost:3001`
5. Look for specific error messages in console (will say "[API] Using API key from .env" if using development fallback)
6. Try calling API directly: `curl http://localhost:3001/api/health`
7. Check localStorage file: `C:\Users\<username>\AppData\Roaming\slainte-finance-v2\localStorage.json` should contain `claude_api_key`

### Issue: Data not persisting

**Symptoms:** Transactions disappear after reload

**Solutions:**
1. Check `C:\Users\<username>\AppData\Roaming\slainte-finance-v2\localStorage.json`
2. This file should contain your data
3. If missing, data is stored in browser localStorage instead
4. In Electron, use Developer Tools: View → Toggle Developer Tools → Application → Local Storage

### Issue: Mobile PWA can't connect

**Symptoms:** "Authentication required" or connection timeout

**Solutions:**
1. Ensure desktop app is running
2. Ensure desktop has internet connection
3. Check Cloudflare Tunnel is active
4. Verify mobile using correct URL (HTTPS, not HTTP)
5. Check token hasn't expired (30 day limit)

### Issue: Build fails

**Symptoms:** `npm run electron-build` errors

**Solutions:**
1. Ensure `npm run build` works first
2. Check `dist/` folder contains built files
3. Verify `electron/main.cjs` and `electron/preload.cjs` exist
4. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

---

## 📝 Development Workflow

### Daily Development

1. **Start development environment:**
```bash
npm run electron-dev
```

2. **Make changes to React components:**
- Edit files in `src/`
- Vite hot-reloads automatically
- Changes appear instantly

3. **Make changes to Electron code:**
- Edit `electron/main.cjs` or `electron/preload.cjs`
- Stop electron-dev (Ctrl+C)
- Restart: `npm run electron-dev`

4. **Test API endpoints:**
```bash
# Use curl or Postman
curl http://localhost:3001/api/health
```

### Testing Claude API Integration

**In Electron:**
```javascript
// Open DevTools in Electron: View → Toggle Developer Tools
// In console:
const response = await window.electronAPI.callClaude('Hello, Cara!');
console.log(response);
```

**Via HTTP API:**
```bash
# Get token first
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"slainte2024"}'

# Use token for chat
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message":"Hello, Cara!"}'
```

---

## 🔄 Migration from V1

### What Was Removed

- ❌ `proxy-server.cjs` - No longer needed (direct API calls)
- ❌ `simple-proxy.cjs` - No longer needed
- ❌ `components/` folder - Old components (now in src/)
- ❌ `data/` folder - Old data files
- ❌ `utils/` folder - Old utilities
- ❌ Conversion scripts - One-time use only
- ❌ `npm run proxy` script - No longer needed
- ❌ `npm run dev-with-proxy` script - No longer needed

### What Was Kept

- ✅ All `src/` folder (current components)
- ✅ `public/` folder (PWA assets)
- ✅ Config files (vite, tailwind, etc.)
- ✅ `PRODUCT_ROADMAP.md`

### Data Migration

**LocalStorage location changed:**
- Old: Browser's localStorage
- New: `C:\Users\<username>\AppData\Roaming\slainte-finance-v2\localStorage.json`

**To migrate your data:**
1. Export from V1: Use "Data Sync" → Export
2. Save the JSON file
3. In V2 Electron app:
   - Open Developer Tools
   - Go to Console
   - Run migration script (TODO: create migration tool)

---

## 🎯 Next Steps

### Immediate (This Week)

1. ✅ Install dependencies: `npm install`
2. ✅ Configure `.env` file with API key
3. ✅ Run development mode: `npm run electron-dev`
4. ✅ Test all features work
5. ⏳ Fix any remaining component API calls (7 more files)
6. ⏳ Build production version: `npm run electron-build`
7. ⏳ Install on practice computer

### Phase 1 Completion (Weeks 2-4)

1. ⏳ Set up Cloudflare Tunnel
2. ⏳ Test mobile PWA connection
3. ⏳ Create partner login screen
4. ⏳ Deploy mobile PWA to Netlify
5. ⏳ Test end-to-end: Desktop → Cloudflare → Mobile
6. ⏳ Run with practice for 1-2 weeks, gather feedback

### Phase 2 (Months 2-3)

- Offer to 2-3 other practices
- Iterate based on feedback
- Document installation process
- Create support materials

See `PRODUCT_ROADMAP.md` for full scaling strategy.

---

## 📚 Additional Resources

### Documentation
- Electron: https://www.electronjs.org/docs/latest
- Express: https://expressjs.com/
- Vite: https://vitejs.dev/
- React: https://react.dev/

### Anthropic Claude API
- Console: https://console.anthropic.com/
- API Docs: https://docs.anthropic.com/

### Cloudflare Tunnel
- Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Quick Start: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Check console logs in Electron DevTools
3. Check API server logs in terminal
4. Review `PRODUCT_ROADMAP.md` for architecture details

---

## ✅ Completion Checklist

Before considering Phase 1 complete:

**Desktop App:**
- [ ] Electron app installs successfully
- [ ] Desktop UI loads and works
- [ ] All transaction features work
- [ ] Reports generate correctly
- [ ] Chat (Cara) responds correctly
- [ ] Data persists after restart
- [ ] API server starts automatically

**API Server:**
- [ ] Express server runs on port 3001
- [ ] All endpoints return correct data
- [ ] Authentication works
- [ ] Claude API integration works
- [ ] Error handling graceful

**Mobile Preparation:**
- [ ] Cloudflare Tunnel configured
- [ ] Public URL accessible
- [ ] Partner login screen created
- [ ] Mobile PWA updated with API calls
- [ ] Mobile PWA deployed to Netlify

**Production Ready:**
- [ ] Built installer tested
- [ ] Installed on practice computer
- [ ] Runs 24/7 without issues
- [ ] Partners can access from mobile
- [ ] All features work end-to-end

---

**Ready to build? Run:** `npm install` then `npm run electron-dev`

Good luck! 🚀
