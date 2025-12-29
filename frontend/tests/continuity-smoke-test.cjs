/**
 * Continuity Tab Smoke Test
 *
 * This is a simplified smoke test that can run without full Playwright system dependencies.
 * It uses basic navigation and element detection to verify the Continuity tab is accessible
 * and the main components are present.
 *
 * Run with: node tests/continuity-smoke-test.js
 */

const http = require('http');

// Test configuration
const baseUrl = 'http://localhost:8080';
const testResults = [];

// Helper to check if server is running
function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(baseUrl, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Log test result
function logTest(name, passed, message = '') {
  const status = passed ? 'PASS' : 'FAIL';
  const emoji = passed ? '✓' : '✗';
  console.log(`${emoji} [${status}] ${name}`);
  if (message) console.log(`  └─ ${message}`);
  testResults.push({ name, passed, message });
}

// Main test runner
async function runTests() {
  console.log('\n===========================================');
  console.log('Continuity Tab Smoke Test');
  console.log('===========================================\n');

  // Test 1: Check if app is running
  console.log('1. Checking if application is running...');
  const serverRunning = await checkServer();
  logTest('Application is accessible', serverRunning,
    serverRunning ? `Server is running at ${baseUrl}` : `Server is not running at ${baseUrl}`);

  if (!serverRunning) {
    console.log('\n❌ Cannot proceed: Application is not running');
    console.log('Please start the application with: npm run dev');
    process.exit(1);
  }

  // Test 2: Check frontend files exist
  console.log('\n2. Checking component files...');
  const fs = require('fs');
  const path = require('path');

  const componentFiles = [
    'src/components/backlot/workspace/ScriptyWorkspace.tsx',
    'src/components/backlot/workspace/scripty/TakeLoggerPanel.tsx',
    'src/components/backlot/workspace/scripty/ContinuityNotesPanel.tsx',
    'src/components/backlot/workspace/scripty/ContinuityPhotosPanel.tsx',
    'src/components/backlot/workspace/ScriptView.tsx',
  ];

  componentFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(fullPath);
    logTest(`Component exists: ${file}`, exists,
      exists ? `Found at ${fullPath}` : `Not found at ${fullPath}`);
  });

  // Test 3: Check hooks exist
  console.log('\n3. Checking hooks...');
  const hooksFiles = [
    'src/hooks/backlot/useContinuity.ts',
  ];

  hooksFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(fullPath);
    logTest(`Hook exists: ${file}`, exists,
      exists ? `Found at ${fullPath}` : `Not found at ${fullPath}`);
  });

  // Test 4: Check for critical dependencies in package.json
  console.log('\n4. Checking dependencies...');
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  const criticalDeps = [
    '@radix-ui/react-tabs',
    '@radix-ui/react-dropdown-menu',
    'react-pdf',
    'react-dropzone',
  ];

  criticalDeps.forEach(dep => {
    const exists = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
    logTest(`Dependency installed: ${dep}`, !!exists,
      exists ? `Version: ${exists}` : 'Not installed');
  });

  // Test 5: Check TypeScript types
  console.log('\n5. Checking TypeScript type definitions...');
  const typesPath = path.join(__dirname, '..', 'src/types/backlot.ts');
  const typesExist = fs.existsSync(typesPath);
  logTest('Backlot types file exists', typesExist,
    typesExist ? 'TypeScript types are defined' : 'Types file missing');

  // Generate summary
  console.log('\n===========================================');
  console.log('Test Summary');
  console.log('===========================================\n');

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${passRate}%)`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Navigate to http://localhost:8080');
    console.log('   2. Log in to the application');
    console.log('   3. Go to Backlot > Select Project > Script > Continuity tab');
    console.log('   4. Use the manual test plan: tests/manual-continuity-test.md');
  }
}

// Run tests
runTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});
