# ForgeAI Quick Start Guide

## 🚀 Initial Setup (5 minutes)

### 1. Install Dependencies

```bash
# Install all dependencies for the monorepo
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
copy backend\.env.example backend\.env.local
# OR on Linux/Mac:
cp backend/.env.example backend/.env.local
```

Edit `backend/.env.local` with your configuration:

```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/forgeai_dev
GITHUB_TOKEN=your_token_here
OPENAI_API_KEY=your_api_key_here
```

### 3. Database Setup

```bash
# Install PostgreSQL locally or use Docker
# Option A: Using Docker
docker run --name forgeai-db \
  -e POSTGRES_DB=forgeai_dev \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Option B: Or use your existing PostgreSQL installation
# Make sure you create a database named forgeai_dev

# Run migrations
npm run db:push -w backend
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend API
npm run dev -w backend

# Terminal 2: Frontend (new terminal)
npm run dev -w frontend

# Terminal 3: Agent Core (new terminal)
npm run dev -w agent-core
```

**Server URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3000 (different port, see console)

---

## 📁 Project Structure

```
forgeai/
├── backend/                 # Express API & Orchestration
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── db/             # Database utilities
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── package.json
│
├── frontend/               # Next.js Dashboard
│   ├── pages/             # Page components
│   │   ├── index.tsx      # Home page
│   │   └── _app.tsx       # App wrapper
│   ├── components/        # Reusable components
│   ├── lib/              # Utilities & API client
│   └── package.json
│
├── agent-core/            # Agent Framework
│   ├── src/
│   │   ├── agents/       # Agent implementations
│   │   ├── tools/        # Agent tools
│   │   ├── orchestration/ # Coordinator
│   │   ├── sandbox/      # Execution environment
│   │   └── types.ts      # TypeScript interfaces
│   └── package.json
│
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md    # System design
│   ├── IMPLEMENTATION_ROADMAP.md
│   └── README.md
│
└── package.json          # Monorepo root
```

---

## 🔨 Common Commands

```bash
# Install packages
npm install

# Development
npm run dev                # Run all dev servers
npm run dev -w backend     # Run backend only
npm run dev -w frontend    # Run frontend only

# Build
npm run build

# Testing
npm run test

# Linting
npm run lint

# Database
npm run migrate -w backend       # Run migrations
npm run db:push -w backend       # Sync schema
npm run prisma:studio -w backend # View database GUI
```

---

## 📦 Key Dependencies

### Backend
- **Express** - Web framework
- **Prisma** - ORM for database
- **TypeScript** - Type safety
- **PostgreSQL** - Database

### Frontend
- **Next.js** - React framework
- **TailwindCSS** - Styling
- **Zustand** - State management
- **Axios** - HTTP client

### Agent Core
- **LangChain** - LLM framework
- **OpenAI SDK** - OpenAI integration
- **TypeScript** - Type safety

---

## 🎯 Next Steps After Setup

1. **Test Backend Connection:**
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **View Database:**
   ```bash
   npm run prisma:studio -w backend
   ```

3. **Run First Agent Test:**
   ```bash
   npm run dev -w agent-core
   ```

4. **Access Frontend Dashboard:**
   Open http://localhost:3000 in your browser

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env.local`
- Ensure database exists: `createdb forgeai_dev`

### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### TypeScript Errors
```bash
# Rebuild TypeScript
npm run build

# Check for type errors
npm run tsc --noEmit -w backend
```

---

## 🔐 Security Notes

- Never commit `.env` files
- Keep `GITHUB_TOKEN` and API keys secret
- Use separate tokens for dev/prod environments
- Enable 2FA on GitHub and other accounts
- Regularly rotate API keys

---

## 📚 Documentation References

- [Architecture Overview](./ARCHITECTURE.md)
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)
- [Product Requirements Document](../pm)

## 🔄 Switching from Yarn to npm

This project uses **npm workspaces** (npm 7+) instead of yarn.
- **Advantage:** Works with standard npm installation
- **Requirements:** npm 7 or higher
- **Check version:** `npm --version`

---

## 💡 Development Tips

1. **Use TypeScript strict mode** - Catch errors early
2. **Write tests as you go** - Less refactoring later
3. **Commit frequently** - Easier to rollback if needed
4. **Keep Docker running** - For sandbox testing
5. **Check PR templates** - Consistency across codebase

---

## 🎓 Learning Resources

- [Express.js Official Docs](https://expressjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma ORM Guide](https://www.prisma.io/docs)
- [LangChain Documentation](https://docs.langchain.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

**Happy Coding! 🚀**

Questions? Check the docs folder or open an issue on GitHub.
