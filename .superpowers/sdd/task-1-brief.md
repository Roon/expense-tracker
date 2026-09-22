### Task 1: Scaffold project and configure testing

**Files:**
- Create: `expense-tracker/` (via create-next-app)
- Create: `expense-tracker/jest.config.ts`
- Create: `expense-tracker/jest.setup.ts`

**Interfaces:**
- Produces: working dev server, passing `npm test` run

- [ ] **Step 1: Scaffold the Next.js project**

Run from `/home/aaron/Coursera/ClaudeCode`:
```bash
npx create-next-app@14 expense-tracker \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-npm
```
Expected: `expense-tracker/` directory created with `app/`, `package.json`, `tsconfig.json`, `tailwind.config.ts`.

- [ ] **Step 2: Install additional dependencies**

Run from `expense-tracker/`:
```bash
npm install recharts react-hook-form @hookform/resolvers zod lucide-react
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: no peer-dependency errors; `node_modules/recharts` exists.

- [ ] **Step 3: Add test scripts to package.json**

In `expense-tracker/package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
// expense-tracker/jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create jest.setup.ts**

```typescript
// expense-tracker/jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Verify test runner works**

Create a smoke test `expense-tracker/__tests__/smoke.test.ts`:
```typescript
test('jest is configured correctly', () => {
  expect(1 + 1).toBe(2)
})
```
Run: `npm test`
Expected: `PASS __tests__/smoke.test.ts` with 1 passing test. Delete this file after confirming.

- [ ] **Step 7: Verify dev server starts**

Run: `npm run dev`
Expected: `ready - started server on 0.0.0.0:3000`. Visit `http://localhost:3000` and see default Next.js page. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 expense tracker with jest"
```

---

