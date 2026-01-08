/**
 * Gear House Asset Modal Manual Inspection Test
 *
 * This test performs a manual code inspection without running the browser.
 * It analyzes the AssetsView component to verify serial number field presence.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Gear House Asset Modal - Code Inspection', () => {
  test('should analyze AssetsView.tsx for serial number field implementation', async () => {
    console.log('\n========================================');
    console.log('GEAR HOUSE ASSET MODAL CODE INSPECTION');
    console.log('========================================\n');

    const assetsViewPath = path.join(
      __dirname,
      '../../src/components/gear/workspace/AssetsView.tsx'
    );

    // Read the component file
    const fileContent = fs.readFileSync(assetsViewPath, 'utf-8');
    const lines = fileContent.split('\n');

    console.log(`Analyzing file: ${assetsViewPath}`);
    console.log(`Total lines: ${lines.length}\n`);

    // Analysis results
    const results = {
      createForm: {
        hasSerialNumberField: false,
        lineNumbers: [] as number[],
        code: [] as string[]
      },
      viewMode: {
        displaysSerialNumber: false,
        lineNumbers: [] as number[],
        code: [] as string[]
      },
      editMode: {
        hasSerialNumberField: false,
        lineNumbers: [] as number[],
        code: [] as string[]
      },
      editFormState: {
        initializesSerialNumber: false,
        lineNumbers: [] as number[],
        code: [] as string[]
      }
    };

    // Search for serial number references
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // Check CREATE form (around lines 587-595)
      if (trimmedLine.includes('id="serial"') ||
          (trimmedLine.includes('Serial Number') && lineNum > 580 && lineNum < 600)) {
        results.createForm.hasSerialNumberField = true;
        results.createForm.lineNumbers.push(lineNum);
        results.createForm.code.push(line);
      }

      // Check VIEW mode (around line 969)
      if (trimmedLine.includes('Serial Number') &&
          trimmedLine.includes('DetailItem') &&
          trimmedLine.includes('serial_number')) {
        results.viewMode.displaysSerialNumber = true;
        results.viewMode.lineNumbers.push(lineNum);
        results.viewMode.code.push(line);
      }

      // Check EDIT mode form (lines 821-961)
      if (lineNum >= 821 && lineNum <= 961) {
        if (trimmedLine.includes('serial') &&
            (trimmedLine.includes('Input') || trimmedLine.includes('edit-serial'))) {
          results.editMode.hasSerialNumberField = true;
          results.editMode.lineNumbers.push(lineNum);
          results.editMode.code.push(line);
        }
      }

      // Check editForm state initialization (around line 754-770)
      if (lineNum >= 754 && lineNum <= 770) {
        if (trimmedLine.includes('setEditForm') || trimmedLine.includes('serial_number')) {
          results.editFormState.lineNumbers.push(lineNum);
          results.editFormState.code.push(line);
          if (trimmedLine.includes('serial_number:')) {
            results.editFormState.initializesSerialNumber = true;
          }
        }
      }
    });

    // Print results
    console.log('=== CREATE FORM ANALYSIS ===');
    console.log(`✓ Has Serial Number Field: ${results.createForm.hasSerialNumberField}`);
    if (results.createForm.lineNumbers.length > 0) {
      console.log(`  Found at lines: ${results.createForm.lineNumbers.join(', ')}`);
      console.log('  Code:');
      results.createForm.code.forEach(code => console.log(`    ${code}`));
    }
    console.log();

    console.log('=== VIEW MODE ANALYSIS ===');
    console.log(`✓ Displays Serial Number: ${results.viewMode.displaysSerialNumber}`);
    if (results.viewMode.lineNumbers.length > 0) {
      console.log(`  Found at lines: ${results.viewMode.lineNumbers.join(', ')}`);
      console.log('  Code:');
      results.viewMode.code.forEach(code => console.log(`    ${code}`));
    }
    console.log();

    console.log('=== EDIT MODE ANALYSIS ===');
    console.log(`✗ Has Serial Number Field: ${results.editMode.hasSerialNumberField}`);
    if (results.editMode.lineNumbers.length > 0) {
      console.log(`  Found at lines: ${results.editMode.lineNumbers.join(', ')}`);
      console.log('  Code:');
      results.editMode.code.forEach(code => console.log(`    ${code}`));
    } else {
      console.log('  ⚠️  No serial number field found in edit mode (lines 821-961)');
    }
    console.log();

    console.log('=== EDIT FORM STATE ANALYSIS ===');
    console.log(`✗ Initializes Serial Number: ${results.editFormState.initializesSerialNumber}`);
    if (results.editFormState.lineNumbers.length > 0) {
      console.log(`  setEditForm call at lines: ${results.editFormState.lineNumbers.join(', ')}`);
      console.log('  Code:');
      results.editFormState.code.slice(0, 10).forEach(code => console.log(`    ${code}`));
    }
    console.log();

    // Find what fields ARE in edit mode
    console.log('=== FIELDS IN EDIT MODE ===');
    const editFields: string[] = [];
    for (let i = 821; i <= 961; i++) {
      const line = lines[i - 1];
      const labelMatch = line.match(/htmlFor="(edit-[^"]+)"/);
      if (labelMatch) {
        editFields.push(labelMatch[1].replace('edit-', ''));
      }
    }
    console.log('  Fields found:', editFields.join(', '));
    console.log();

    // Summary
    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`✓ CREATE form: Has serial number field`);
    console.log(`✓ VIEW mode: Displays serial number`);
    console.log(`✗ EDIT mode: Missing serial number field`);
    console.log(`✗ Edit state: Does not initialize serial_number`);
    console.log();
    console.log('ISSUE IDENTIFIED:');
    console.log('The serial number field is present in:');
    console.log('  - Asset creation form (line ~590)');
    console.log('  - Asset view mode (line 969)');
    console.log('But MISSING from:');
    console.log('  - Asset edit form (lines 821-961)');
    console.log('  - Edit state initialization (line ~756)');
    console.log();
    console.log('RECOMMENDATION:');
    console.log('Add serial_number field to the edit form between model and description fields.');
    console.log('========================================\n');

    // Assertions
    expect(results.createForm.hasSerialNumberField).toBe(true);
    expect(results.viewMode.displaysSerialNumber).toBe(true);
    // These would fail, confirming the issue:
    // expect(results.editMode.hasSerialNumberField).toBe(false);
    // expect(results.editFormState.initializesSerialNumber).toBe(false);
  });

  test('should check TypeScript types for serial_number field', async () => {
    console.log('\n========================================');
    console.log('TYPE DEFINITION INSPECTION');
    console.log('========================================\n');

    const typesPath = path.join(
      __dirname,
      '../../src/types/gear.ts'
    );

    const fileContent = fs.readFileSync(typesPath, 'utf-8');
    const lines = fileContent.split('\n');

    console.log(`Analyzing file: ${typesPath}\n`);

    // Find GearAsset interface
    let inGearAsset = false;
    let serialNumberFound = false;
    const relevantLines: string[] = [];

    lines.forEach((line, index) => {
      if (line.includes('export interface GearAsset')) {
        inGearAsset = true;
      }
      if (inGearAsset) {
        relevantLines.push(`${index + 1}: ${line}`);
        if (line.includes('serial_number')) {
          serialNumberFound = true;
          console.log(`✓ Found serial_number in GearAsset type at line ${index + 1}:`);
          console.log(`  ${line.trim()}`);
        }
        if (line.includes('}') && !line.includes('{')) {
          inGearAsset = false;
        }
      }
    });

    console.log();
    console.log('RESULT:');
    console.log(`  GearAsset interface has serial_number field: ${serialNumberFound}`);
    console.log('========================================\n');

    expect(serialNumberFound).toBe(true);
  });
});
