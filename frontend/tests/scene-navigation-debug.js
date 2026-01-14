/**
 * Scene Navigation Debug Script
 *
 * Run this in the browser console while on the Continuity tab to debug scene navigation.
 *
 * Usage:
 * 1. Navigate to Continuity tab in a Backlot project
 * 2. Open browser DevTools (F12)
 * 3. Copy and paste this entire script into the Console
 * 4. Run the debug functions to inspect scene navigation
 */

// Debug: Check if ScriptyWorkspace is rendered
function checkScriptyWorkspace() {
  const workspace = document.querySelector('[data-testid="scripty-workspace"]');
  console.log('ScriptyWorkspace found:', !!workspace);
  return workspace;
}

// Debug: List all scenes in the left panel
function listScenes() {
  const scenes = document.querySelectorAll('[data-testid^="scene-item-"]');
  console.log(`Found ${scenes.length} scenes:`);
  scenes.forEach((scene, i) => {
    const sceneNumber = scene.getAttribute('data-testid').replace('scene-item-', '');
    const content = scene.textContent;
    const isSelected = scene.className.includes('accent-yellow');
    console.log(`  ${i + 1}. Scene ${sceneNumber} - Selected: ${isSelected}`);
    console.log(`     Content: ${content.trim()}`);
  });
  return scenes;
}

// Debug: Get current page number
function getCurrentPage() {
  const pageSelector = document.querySelector('[data-testid="page-selector"]');
  if (pageSelector) {
    const value = pageSelector.value || pageSelector.textContent;
    console.log('Current page:', value);
    return value;
  }

  // Try alternative selectors
  const pageIndicator = document.querySelector('[data-testid="page-count"]');
  if (pageIndicator) {
    console.log('Page indicator:', pageIndicator.textContent);
    return pageIndicator.textContent;
  }

  console.log('Could not find page selector');
  return null;
}

// Debug: Click a scene and observe page change
function testSceneClick(sceneIndex = 0) {
  const scenes = document.querySelectorAll('[data-testid^="scene-item-"]');
  if (scenes.length === 0) {
    console.error('No scenes found');
    return;
  }

  if (sceneIndex >= scenes.length) {
    console.error(`Scene index ${sceneIndex} out of range (max: ${scenes.length - 1})`);
    return;
  }

  const scene = scenes[sceneIndex];
  const sceneNumber = scene.getAttribute('data-testid').replace('scene-item-', '');

  console.log(`\n=== Testing scene ${sceneNumber} click ===`);
  console.log('Before click:');
  const pageBefore = getCurrentPage();

  console.log('\nClicking scene...');
  scene.click();

  setTimeout(() => {
    console.log('\nAfter click:');
    const pageAfter = getCurrentPage();

    console.log('\nResults:');
    console.log('  Page changed:', pageBefore !== pageAfter);
    console.log('  Page before:', pageBefore);
    console.log('  Page after:', pageAfter);

    const isSelected = scene.className.includes('accent-yellow');
    console.log('  Scene selected:', isSelected);
  }, 500);
}

// Debug: Test clicking multiple scenes
function testMultipleScenes() {
  const scenes = document.querySelectorAll('[data-testid^="scene-item-"]');
  console.log(`\n=== Testing ${Math.min(scenes.length, 3)} scenes ===\n`);

  let index = 0;
  const interval = setInterval(() => {
    if (index >= Math.min(scenes.length, 3)) {
      clearInterval(interval);
      console.log('\n=== Test complete ===');
      return;
    }

    testSceneClick(index);
    index++;
  }, 2000);
}

// Debug: Check for scene mappings in React component state
function checkSceneMappings() {
  console.log('\n=== Checking for scene_mappings ===');

  // Try to find React Fiber node
  const workspace = document.querySelector('[data-testid="scripty-workspace"]');
  if (!workspace) {
    console.error('ScriptyWorkspace not found');
    return;
  }

  // Look for React internal properties
  const fiberKey = Object.keys(workspace).find(key => key.startsWith('__reactFiber'));
  const propsKey = Object.keys(workspace).find(key => key.startsWith('__reactProps'));

  if (propsKey) {
    const props = workspace[propsKey];
    console.log('ScriptyWorkspace props found');
    console.log('  Has sceneMappings:', 'sceneMappings' in props);
    console.log('  Has continuityPdfUrl:', 'continuityPdfUrl' in props);

    if (props.sceneMappings) {
      console.log('  Scene mappings:', props.sceneMappings);
      console.log('  Number of scenes:', props.sceneMappings.scenes?.length || 0);
    } else {
      console.log('  ⚠️ No scene mappings provided to component');
    }

    return props;
  }

  console.log('⚠️ Could not access React props (production build?)');
  return null;
}

// Debug: Monitor localStorage for any cached data
function checkLocalStorage() {
  console.log('\n=== Checking localStorage ===');

  const relevantKeys = Object.keys(localStorage).filter(key =>
    key.includes('scene') ||
    key.includes('continuity') ||
    key.includes('export') ||
    key.includes('backlot')
  );

  console.log(`Found ${relevantKeys.length} relevant keys:`);
  relevantKeys.forEach(key => {
    console.log(`  ${key}:`, localStorage.getItem(key)?.substring(0, 100) + '...');
  });
}

// Debug: Check version selector
function checkVersionSelector() {
  console.log('\n=== Checking Version Selector ===');

  // Look for version selector (in ContinuityView)
  const selectors = document.querySelectorAll('select, [role="combobox"]');
  const versionSelector = Array.from(selectors).find(el =>
    el.textContent.toLowerCase().includes('version') ||
    el.previousElementSibling?.textContent.toLowerCase().includes('version')
  );

  if (versionSelector) {
    console.log('✓ Version selector found');
    console.log('  Selected value:', versionSelector.value || versionSelector.textContent);

    // Try to list options
    const options = versionSelector.querySelectorAll('option, [role="option"]');
    console.log(`  Available versions: ${options.length}`);
    options.forEach((opt, i) => {
      console.log(`    ${i + 1}. ${opt.textContent}`);
    });
  } else {
    console.log('⚠️ No version selector found');
    console.log('This could mean:');
    console.log('  1. No continuity exports exist');
    console.log('  2. Not on ContinuityView (using ScriptyWorkspace directly)');
  }
}

// Debug: Full diagnostic
function runFullDiagnostic() {
  console.clear();
  console.log('========================================');
  console.log('Scene Navigation Diagnostic Report');
  console.log('========================================\n');

  checkScriptyWorkspace();
  listScenes();
  getCurrentPage();
  checkSceneMappings();
  checkVersionSelector();
  checkLocalStorage();

  console.log('\n========================================');
  console.log('Diagnostic Complete');
  console.log('========================================\n');
  console.log('Next steps:');
  console.log('  1. Run testSceneClick(0) to test first scene');
  console.log('  2. Run testMultipleScenes() to test multiple scenes');
  console.log('  3. Check Network tab for API responses');
}

// Export functions to window for easy access
window.sceneDebug = {
  checkScriptyWorkspace,
  listScenes,
  getCurrentPage,
  testSceneClick,
  testMultipleScenes,
  checkSceneMappings,
  checkVersionSelector,
  checkLocalStorage,
  runFullDiagnostic,
};

console.log('Scene Navigation Debug Tools Loaded!');
console.log('Available functions:');
console.log('  sceneDebug.runFullDiagnostic() - Run complete diagnostic');
console.log('  sceneDebug.testSceneClick(0)   - Test clicking first scene');
console.log('  sceneDebug.testMultipleScenes() - Test multiple scenes');
console.log('  sceneDebug.listScenes()        - List all scenes');
console.log('  sceneDebug.checkSceneMappings() - Check for scene_mappings prop');
console.log('  sceneDebug.checkVersionSelector() - Check export version selector');
console.log('\nRun sceneDebug.runFullDiagnostic() to start!');
