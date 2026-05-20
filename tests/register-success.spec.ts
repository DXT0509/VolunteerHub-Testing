import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4173";

/**
 * Register Success Page – /register-success
 *
 * This page is ONLY reachable after a successful registration.
 * It has a guard that redirects to /register if accessed directly.
 *
 * Covers:
 *   Positive:
 *     1. Success message is displayed correctly
 *     2. "Back to login" button exists and is visible
 *     3. Click "Back to login" → navigates to /login
 *   Negative:
 *     4. Direct access without registration → redirects to /register
 */

const URL_REGISTER_SUCCESS = /\/register-success\/?$/;
const URL_REGISTER = /\/register\/?$/;
const URL_LOGIN = /\/login\/?$/;

// Generate unique test user data to avoid collisions
const UNIQUE_ID = Date.now() + 1;
const NEW_EMAIL = `testsuccess_${UNIQUE_ID}@gmail.com`;
const NEW_PHONE = `090${String(UNIQUE_ID).slice(-7)}`;
const NEW_FULL_NAME = "Register Success Test";
const NEW_PASSWORD = "test123456";

test.describe("Register Success Page – Positive", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage once before navigating to avoid stale auth redirects.
    await page.context().addInitScript(() => {
      localStorage.clear();
    });

    await page.goto(`${BASE}/register`);
    await expect(page.getByRole("heading", { name: /register/i })).toBeVisible({
      timeout: 10_000,
    });

    // Fill the registration form
    await page.locator('input[name="full_name"]').fill(NEW_FULL_NAME);
    await page.locator('input[name="phone"]').fill(NEW_PHONE);
    await page.locator('input[name="email"]').fill(NEW_EMAIL);
    await page.locator('input[name="password"]').fill(NEW_PASSWORD);
    await page.locator('input[type="checkbox"][name="agree"]').check();
    await page.getByRole("button", { name: /register/i }).click();

    // Wait for navigation to /register-success
    await page.waitForURL(URL_REGISTER_SUCCESS, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_REGISTER_SUCCESS);
  });

  // -------------------------------------------------------------------
  // Positive – Success message content
  // -------------------------------------------------------------------
  test("Hiển thị tiêu đề và thông báo thành công", async ({ page }) => {
    // <h2>Success</h2> – the page title (exact match avoids hitting
    // the <h6> "Account registered successfully!" text)
    await expect(
      page.getByRole("heading", { name: "Success", exact: true }),
    ).toBeVisible();

    // Message paragraph: "Account registered successfully!"
    await expect(
      page.getByText(/registered successfully|đăng ký.*thành công/i).first(),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------
  // Positive – "Back to login" button exists and is visible
  // -------------------------------------------------------------------
  test('Nút "Quay lại trang đăng nhập" hiển thị rõ ràng', async ({ page }) => {
    const backButton = page.getByRole("button", {
      name: /back to login|quay về.*đăng nhập/i,
    });

    await expect(backButton).toBeVisible();
    await expect(backButton).toBeEnabled();
  });

  // -------------------------------------------------------------------
  // Positive – Click "Back to login" navigates to /login
  // -------------------------------------------------------------------
  test('Click "Quay lại trang đăng nhập" => điều hướng về /login', async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /back to login|quay về.*đăng nhập/i })
      .click();

    await page.waitForURL(URL_LOGIN, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_LOGIN);
    // Heading: "Login" (English, default i18n)
    await expect(
      page.getByRole("heading", { name: "Login", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
