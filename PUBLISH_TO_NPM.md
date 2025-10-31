# How to Publish to NPM

## 📍 Package Location
Your package is here: `/Users/heyitspkj/Desktop/Quick Reply/observability-newrelic-package`

The **package.json** is at: `/Users/heyitspkj/Desktop/Quick Reply/observability-newrelic-package/package.json`

---

## 🚀 Step-by-Step: Publish to NPM

### Step 1: Build the Package
```bash
cd "/Users/heyitspkj/Desktop/Quick Reply/observability-newrelic-package"
npm install
npm run build
```

This creates the `dist/` folder with compiled JavaScript files.

---

### Step 2: Login to NPM (One-time)
```bash
npm login
```

Enter your:
- Username
- Password  
- Email
- OTP (if you have 2FA enabled)

---

### Step 3: Publish to NPM
```bash
npm publish
```

Done! Your package is now on NPM.

---

## 📦 Package Details

**Package Name:** `awesome-instrumentation-core`

**What's included:**
- ✅ MongoDB tracing
- ✅ Axios distributed tracing (NEW in v2.1.0!)
- ✅ Express middleware
- ✅ Observability service
- ✅ Data scrubbing utilities

---

## 🔧 Using the Package in Your Project

### Step 1: Install in Your Project
```bash
cd "/Users/heyitspkj/Desktop/Quick Reply/qr-dashboard-backend-new"
npm install awesome-instrumentation-core
```

### Step 2: Update One Import
In `src/lib/db/mongo/mongo-db.ts`, change:

**From:**
```typescript
import { registerMongoClient } from '@lib/observability'
```

**To:**
```typescript
import { registerMongoClient } from 'awesome-instrumentation-core'
```

### Step 3: Done!
Everything else stays the same. Bootstrap files don't change.

---

## 🔄 Updating the Package

When you make changes:

```bash
cd "/Users/heyitspkj/Desktop/Quick Reply/observability-newrelic-package"

# Update version
npm version patch  # 1.0.0 → 1.0.1

# Build and publish
npm run build
npm publish
```

Then update in your project:
```bash
npm update awesome-instrumentation-core
```

---

## 🎯 What's Missing to Add Later

These files don't exist yet but you can add them if needed:
- `observability.service.interface.ts` - Service interface
- `newrelic/newrelic.service.ts` - New Relic implementation

Current files work fine without them!

---

## ⚠️ Important Notes

1. **Package name** is currently `awesome-instrumentation-core`
   - Change in package.json if you want different name
   - Must be unique on NPM

2. **Access is public**
   - Anyone can install it
   - Change to `"restricted"` for private packages (requires paid NPM account)

3. **First time publishing?**
   - May need to verify your email with NPM
   - May need to create NPM account at https://www.npmjs.com/signup

