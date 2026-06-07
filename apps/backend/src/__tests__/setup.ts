// Use test database for all integration tests
const testDbUrl = process.env['TEST_DATABASE_URL'];
if (testDbUrl) {
  process.env['DATABASE_URL'] = testDbUrl;
}

// Use fast bcrypt rounds in tests
process.env['BCRYPT_ROUNDS'] = '1';
