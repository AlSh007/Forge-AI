# 🔄 Migration from Yarn to npm - Complete

## ✅ What Was Changed

The ForgeAI project has been successfully converted from **yarn workspaces** to **npm workspaces**.

### Updated Files

#### 1. **Root Configuration** ✅
- `package.json` - Updated all scripts to use `npm run ... -w workspace`
- `tsconfig.json` - No changes needed (shared config)
- `.gitignore` - No changes needed

#### 2. **Backend Package** ✅
- `backend/package.json` - Added `prisma:studio` script for easier commands
- TypeScript and dependency configurations remain the same

#### 3. **Frontend Package** ✅
- `frontend/package.json` - Ready to use with npm
- Next.js configuration unchanged

#### 4. **Agent Core Package** ✅
- `agent-core/package.json` - Ready to use with npm
- Framework configuration unchanged

#### 5. **Documentation** ✅
- `README.md` - Updated to reference npm 7+ requirement
- `QUICK_START.md` - All yarn commands replaced with npm equivalents
- `SETUP_COMPLETE.md` - All instructions updated to use npm
- `docs/IMPLEMENTATION_ROADMAP.md` - Updated commands for Phase 1

---

## 📋 Command Mapping: Yarn → npm

| Yarn Command | npm Command | Purpose |
|---|---|---|
| `yarn install` | `npm install` | Install all dependencies |
| `yarn workspace backend dev` | `npm run dev -w backend` | Run backend in dev mode |
| `yarn workspace frontend dev` | `npm run dev -w frontend` | Run frontend in dev mode |
| `yarn workspace agent-core dev` | `npm run dev -w agent-core` | Run agent core in dev mode |
| `yarn dev` | `npm run dev` | Run all workspaces |
| `yarn build` | `npm run build` | Build all workspaces |
| `yarn test` | `npm run test` | Test all workspaces |
| `yarn lint` | `npm run lint` | Lint all workspaces |

---

## 🚀 Quick Start with npm

### Step 1: Install Dependencies
```bash
cd "c:\Users\Alok\Desktop\Forge AI"
npm install
```

### Step 2: Set Up Environment
```bash
# Copy environment template
copy backend\.env.example backend\.env.local
```

Edit `backend/.env.local`:
```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/forgeai_dev
GITHUB_TOKEN=your_github_token_here
OPENAI_API_KEY=your_api_key_here
```

### Step 3: Set Up PostgreSQL (Docker Recommended)
```bash
docker run --name forgeai-db \
  -e POSTGRES_DB=forgeai_dev \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

### Step 4: Run Database Migrations
```bash
npm run db:push -w backend
```

### Step 5: Start Development Servers

Open 3 terminals:

**Terminal 1 - Backend:**
```bash
npm run dev -w backend
# Should output: ✓ Server running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm run dev -w frontend
# Should output: ▲ Ready in X.XXXs
```

**Terminal 3 - Agent Core (Optional):**
```bash
npm run dev -w agent-core
```

---

## 📦 Requirements

- **Node.js:** 18 or higher
- **npm:** 7 or higher (required for workspaces)

### Verify Your Version
```bash
node --version   # Should show v18.0.0 or higher
npm --version    # Should show 7.0.0 or higher
```

---

## ❓ FAQ

### Q: Why switch from yarn to npm?
**A:** npm 7+ has built-in workspace support, no additional package manager needed. npm comes standard with Node.js.

### Q: Can I still use yarn?
**A:** The project is now optimized for npm, but yarn should still work with the same commands (replace `npm run ... -w` with `yarn workspace`).

### Q: What if I get "npm: ERR! unknown command"?
**A:** Make sure you're using npm 7+. Update with: `npm install -g npm@latest`

### Q: Can I run all development servers with one command?
**A:** Yes! Use: `npm run dev`

---

## 🔍 Project Structure with npm

```
Forge AI/
├── package.json          ← Root workspace config
├── backend/              ← Backend workspace
│   └── package.json      ← Backend config
├── frontend/             ← Frontend workspace
│   └── package.json      ← Frontend config
└── agent-core/           ← Agent workspace
    └── package.json      ← Agent config
```

### How npm Workspaces Work

When you run:
```bash
npm run dev -w backend
```

npm automatically:
1. Looks for the workspace named "backend" in root `package.json`
2. Looks for the "dev" script in `backend/package.json`
3. Runs it with proper environment and dependencies resolved

This is much simpler than managing multiple package managers!

---

## 🛠️ Common npm Workspace Commands

```bash
# Install dependencies for all workspaces
npm install

# Install a package in a specific workspace
npm install axios -w backend

# Run a script in a specific workspace
npm run dev -w frontend

# Run a script in all workspaces
npm run build

# List all workspaces
npm ls -w

# View workspace configuration
npm query ".workspaces[*]"
```

---

## 📚 Resources

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Node.js Official Site](https://nodejs.org)
- [npm Official Documentation](https://docs.npmjs.com)

---

## ✨ Benefits of npm Workspaces

✅ **No external package manager** - npm included with Node.js  
✅ **Native support** - Built into npm 7+  
✅ **Simpler installation** - One `npm install` command  
✅ **Consistent** - Same tool for mono and multi-repo projects  
✅ **Better compatibility** - Works with most CI/CD systems  

---

## 🎯 Next Steps

1. ✅ Read this guide (you're doing it!)
2. ⏭️ Follow the Quick Start steps above
3. 📖 Read [QUICK_START.md](./QUICK_START.md) for detailed setup
4. 🚀 Start developing!

---

## 🆘 Troubleshooting

### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -r node_modules
npm install
```

### Port 3000 already in use
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Database connection error
```bash
# Make sure PostgreSQL is running
# Check DATABASE_URL in backend/.env.local
# Verify database exists: createdb forgeai_dev
```

### Still having issues?
Check the [QUICK_START.md](./QUICK_START.md) troubleshooting section!

---

**Version:** npm 7+ compatible  
**Updated:** March 14, 2026  
**Status:** ✅ Ready to Use
