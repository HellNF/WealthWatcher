// jest.env.ts
process.env.DATABASE_PATH = ':memory:'

// Isolated test key: tests must not depend on local production credentials.
process.env.AUTH_SECRET = 'wealthwatcher-tests-only-not-for-production'
