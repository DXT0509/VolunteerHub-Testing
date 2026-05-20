import { test as setup, expect } from "@playwright/test";

const adminFile = "playwright/.auth/admin.json";
const volunteerFile = "playwright/.auth/volunteer.json";
const managerFile = "playwright/.auth/manager.json";

// Helper function to perform login and save storage state
async function performLogin(
  page: any,
  email: string,
  pass: string,
  filePath: string,
) {
  // Clear localStorage ONLY when on /login to prevent stale auth redirects.
  // The Login component does window.location.href = "/" on success, which causes
  // a full page reload. If we clear localStorage unconditionally, the JWT token
  // set right before the navigation is wiped on the destination page.
  await page.context().addInitScript(() => {
    if (
      window.location.pathname === "/login" ||
      window.location.pathname === "/login/"
    ) {
      localStorage.clear();
    }
  });

  await page.goto("/login");

  // Wait for the login page elements
  await expect(page.locator('input[name="email"]')).toBeVisible({
    timeout: 10000,
  });

  // Fill credentials
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();

  // Wait for successful navigation to "/"
  await page.waitForURL(/\/$/, { timeout: 10000 });
  await expect(page).toHaveURL(/\/$/);

  // Double check that we have a token stored in localStorage
  const token = await page.evaluate(() => localStorage.getItem("token"));
  expect(token).toBeTruthy();

  // Save context state
  await page.context().storageState({ path: filePath });
}

setup("authenticate as admin", async ({ page }) => {
  await performLogin(page, "admin@gmail.com", "admin123", adminFile);
});

setup("authenticate as volunteer", async ({ page }) => {
  await performLogin(page, "volunteer1@gmail.com", "123456", volunteerFile);
});

setup("authenticate as event manager", async ({ page }) => {
  await performLogin(page, "manager1@gmail.com", "123456", managerFile);
});
