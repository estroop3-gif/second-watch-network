import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Shared helpers for Team & Access E2E tests.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID_FILE = path.join(__dirname, '..', '..', '..', 'playwright', '.auth', 'project-id.txt');

/**
 * Discover the first project ID for the owner account.
 * Reads the owner auth state, calls the API, and caches the result.
 */
async function getProjectId(): Promise<string> {
  // Check cached value first
  try {
    const cached = fs.readFileSync(PROJECT_ID_FILE, 'utf8').trim();
    if (cached) return cached;
  } catch {}

  // Read owner auth state and extract token
  const authPath = path.join(__dirname, '..', '..', '..', 'playwright', '.auth', 'owner.json');
  const state = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const origin = state.origins?.[0];
  const accessToken = origin?.localStorage?.find((i: any) => i.name === 'access_token')?.value;

  if (!accessToken) {
    throw new Error('No access_token found in owner auth state');
  }

  const baseUrl = process.env.VITE_API_URL || 'http://localhost:8000';
  const resp = await fetch(`${baseUrl}/api/v1/backlot/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const projects = await resp.json();

  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('No projects found for owner account');
  }

  const projectId = projects[0].id;

  // Cache it
  fs.writeFileSync(PROJECT_ID_FILE, projectId, 'utf8');
  return projectId;
}

/**
 * Navigate directly to a project's Team & Access tab.
 * Goes to the project workspace, waits for sidebar, scrolls to and clicks "Team & Access".
 */
export async function navigateToTeamAccess(
  page: Page,
  projectId?: string
): Promise<void> {
  const id = projectId || (await getProjectId());
  await page.goto(`/backlot/projects/${id}`);

  // Wait for workspace sidebar to load
  await expect(
    page.locator('button:has-text("Overview")')
  ).toBeVisible({ timeout: 20000 });

  // Scroll sidebar to bottom and click "Team & Access"
  const teamBtn = page.locator('button:has-text("Team & Access")');
  await teamBtn.scrollIntoViewIfNeeded();
  await teamBtn.click();

  // Wait for the Team & Access header (h2 inside the view content, not sidebar)
  await expect(
    page.locator('h2:has-text("Team & Access")')
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Switch to a sub-tab within Team & Access.
 */
export async function switchSubTab(
  page: Page,
  tabName: 'Team Members' | 'Roles & Permissions' | 'External Access'
): Promise<void> {
  const tab = page.locator(`[role="tab"]:has-text("${tabName}")`);
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  // Wait for tab content to render
  await page.waitForTimeout(1000);
}

/**
 * Type a search query in the Team Members search input.
 */
export async function searchMembers(
  page: Page,
  query: string
): Promise<void> {
  const searchInput = page.locator(
    'input[placeholder*="Search team"], input[placeholder*="search team"]'
  );
  await searchInput.fill(query);
  // Wait for debounce / filter
  await page.waitForTimeout(300);
}

/**
 * Full flow to add a member via the Add Member dialog.
 */
export async function addMemberViaDialog(
  page: Page,
  params: {
    name: string;
    role?: string;
    backlotRole?: string;
  }
): Promise<void> {
  // Open dialog
  await page.locator('button:has-text("Add Member")').click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

  // Search for user
  const searchInput = page.locator(
    '[role="dialog"] input[placeholder*="Search"], [role="dialog"] input[placeholder*="search"]'
  );
  await searchInput.fill(params.name);
  await page.waitForTimeout(600);

  // Select user from results
  const userResult = page.locator(`[role="dialog"] button:has-text("${params.name}")`).first();
  await userResult.click();

  // Select project role if specified
  if (params.role) {
    await page.locator('[role="dialog"]').locator('text=Project Role').locator('..').locator('button[role="combobox"]').click();
    await page.locator(`[role="option"]:has-text("${params.role}")`).click();
  }

  // Select backlot role if specified
  if (params.backlotRole) {
    await page.locator('[role="dialog"]').locator('text=Backlot Role').locator('..').locator('button[role="combobox"]').click();
    await page.locator(`[role="option"]:has-text("${params.backlotRole}")`).click();
  }

  // Submit
  await page.locator('[role="dialog"] button:has-text("Add Member")').click();
}

/**
 * Full flow to add an external seat (freelancer or client).
 */
export async function addExternalSeat(
  page: Page,
  params: {
    name: string;
    type: 'freelancer' | 'client';
    capabilities?: {
      canInvoice?: boolean;
      canExpense?: boolean;
      canTimecard?: boolean;
    };
  }
): Promise<void> {
  const buttonText = params.type === 'freelancer' ? 'Add Freelancer' : 'Add Client';
  await page.locator(`button:has-text("${buttonText}")`).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

  // Search for user
  const searchInput = page.locator(
    '[role="dialog"] input[placeholder*="Search"], [role="dialog"] input[placeholder*="search"]'
  );
  await searchInput.fill(params.name);
  await page.waitForTimeout(600);

  // Select user
  const userResult = page.locator(`[role="dialog"] button:has-text("${params.name}")`).first();
  await userResult.click();

  // Toggle capabilities for freelancers
  if (params.type === 'freelancer' && params.capabilities) {
    const caps = params.capabilities;
    if (caps.canInvoice === false) {
      await page.locator('[role="dialog"] label:has-text("Can submit invoices") input, [role="dialog"] label:has-text("Can submit invoices") button').click();
    }
    if (caps.canExpense === false) {
      await page.locator('[role="dialog"] label:has-text("Can submit expenses") input, [role="dialog"] label:has-text("Can submit expenses") button').click();
    }
    if (caps.canTimecard === false) {
      await page.locator('[role="dialog"] label:has-text("Can submit timecards") input, [role="dialog"] label:has-text("Can submit timecards") button').click();
    }
  }

  // Submit
  await page.locator(`[role="dialog"] button:has-text("${buttonText}")`).click();
}

/**
 * Wait for a Sonner toast with the given text.
 * Sonner renders toasts as `<li data-sonner-toast>` with a `<div data-title>` child.
 */
export async function waitForToast(
  page: Page,
  message: string,
  timeout = 5000
): Promise<void> {
  await expect(
    page.locator(`[data-sonner-toast]`).filter({ hasText: message }).first()
  ).toBeVisible({ timeout });
}

/**
 * Locate a member card by display name.
 */
export function getMemberCard(page: Page, name: string) {
  return page.locator(`.rounded-lg:has-text("${name}")`).first();
}

/**
 * Get the count of visible members from the header.
 */
export async function getMemberCount(page: Page): Promise<string> {
  const countEl = page.locator('text=/\\d+ team member/');
  return countEl.textContent() ?? '';
}

/**
 * Navigate to the project workspace (for visibility tests that check sidebar).
 * Goes directly to the project URL without the ?view= param so sidebar is visible.
 */
export async function navigateToProject(page: Page): Promise<void> {
  const id = await getProjectId();
  await page.goto(`/backlot/projects/${id}`);

  // Wait for workspace to load — look for sidebar buttons
  await expect(
    page.locator('button:has-text("Overview")')
  ).toBeVisible({ timeout: 20000 });
}
