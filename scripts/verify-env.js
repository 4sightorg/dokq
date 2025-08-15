const fs = require('fs');
const path = require('path');

require('dotenv').config();

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found');
  process.exit(1);
}

const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
];

let missingRequired = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (
    !value ||
    value === 'your_actual_firebase_api_key_here' ||
    value === 'your_project_id'
  ) {
    missingRequired.push(varName);
  }
});

if (missingRequired.length > 0) {
  console.error(
    `Missing required environment variables: ${missingRequired.join(', ')}`
  );
  process.exit(1);
}

process.exit(0);
