import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

/**
 * Login Page – Luồng Xác thực Cơ bản + Tính năng "Remember Me"
 *
 * Seed-data dependencies (prisma/seedUser.ts, password always "123456"):
 *   - volunteer1@gmail.com  : is_active = true
 *   - volunteer2@gmail.com  : is_active = true   (used for overwrite scenario)
 *   - volunteer24@gmail.com : is_active = false
 *   - volunteer25@gmail.com : is_active = false
 */

const URL_LOGIN = /\/login\/?$/;
const URL_HOME = /localhost:4173\/?$/;

// =====================================================================
// Part A – Authentication (Happy Path + Negative cases)
// =====================================================================
test.describe('Login Page – Luồng Xác thực Cơ bản', () => {
  test.beforeEach(async ({ page }) => {
    // ------------------------------------------------------------------
    // addInitScript runs BEFORE any page JS on EVERY navigation.
    // We only wipe localStorage when the current URL is /login so that
    // a successful login redirect (window.location.href = "/") does NOT
    // lose the token it just stored.
    // ------------------------------------------------------------------
    await page.context().addInitScript(() => {
      if (window.location.pathname.includes('/login')) {
        localStorage.clear();
      }
    });

    await page.goto(`${BASE}/login`);

    // Wait for the <h2>Login</h2> heading (default i18n is English).
    // This also guarantees the 1s CSS fade-in animation has completed.
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------
  // Shared helper – fill form and click submit
  // button[type="submit"] is language-agnostic (getByRole may race i18n).
  // -------------------------------------------------------------------
  async function submitLogin(
    page: ReturnType<typeof test.info> extends never ? never : any,
    email: string,
    password: string,
  ) {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
  }

  // ---- Positive (Happy Path) ----
  test('Đăng nhập với Email + Password đúng => điều hướng về /', async ({
    page,
  }) => {
    await submitLogin(page, 'volunteer1@gmail.com', '123456');

    // The app navigates via window.location.href = "/" (full page load)
    await page.waitForURL(URL_HOME, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_HOME);

    // Token must be persisted after successful login
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  // ---- Negative – Wrong password ----
  test('Sai mật khẩu: Nhập đúng Email nhưng sai Password', async ({
    page,
  }) => {
    await submitLogin(page, 'volunteer1@gmail.com', 'wrongpassword');

    // API returns 400 → we stay on /login
    await expect(page).toHaveURL(URL_LOGIN);
    // MUI Snackbar renders an Alert inside the .MuiAlert-message div
    await expect(
      page.locator('.MuiAlert-message').first(),
    ).toContainText('Sai mật khẩu', { timeout: 5_000 });
  });

  // ---- Negative – Unregistered email ----
  test('Email chưa đăng ký: Nhập Email không tồn tại trong hệ thống', async ({
    page,
  }) => {
    await submitLogin(page, 'nonexistent@example.com', '123456');

    await expect(page).toHaveURL(URL_LOGIN);
    await expect(
      page.locator('.MuiAlert-message').first(),
    ).toContainText('Tài khoản không tồn tại', { timeout: 5_000 });
  });

  // ---- Negative – Both fields empty ----
  test('Để trống: Không nhập Email, không nhập Password', async ({
    page,
  }) => {
    await page.locator('button[type="submit"]').click();

    // Browser HTML5 validation blocks form submission
    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      'validity.valid',
      false,
    );
  });

  // ---- Negative – Email empty, password filled ----
  test('Để trống: Không nhập Email (chỉ nhập Password)', async ({ page }) => {
    await page.locator('input[name="password"]').fill('123456');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      'validity.valid',
      false,
    );
  });

  // ---- Negative – Password empty, email filled ----
  test('Để trống: Không nhập Password (chỉ nhập Email)', async ({ page }) => {
    await page.locator('input[name="email"]').fill('volunteer1@gmail.com');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.locator('input[name="password"]')).toHaveJSProperty(
      'validity.valid',
      false,
    );
  });

  // ---- Negative – Invalid email format ----
  test('Định dạng Email: Nhập email sai cú pháp (vinh.uet#gmail.com)', async ({
    page,
  }) => {
    await page.locator('input[name="email"]').fill('vinh.uet#gmail.com');
    await page.locator('input[name="password"]').fill('123456');
    await page.locator('button[type="submit"]').click();

    // type="email" built-in validation rejects malformed address
    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      'validity.valid',
      false,
    );
  });

  // ---- Negative – Locked account (is_active = false) ----
  test('Tài khoản bị khóa: Đăng nhập bằng User có is_active = false', async ({
    page,
  }) => {
    await submitLogin(page, 'volunteer24@gmail.com', '123456');

    await expect(page).toHaveURL(URL_LOGIN);
    await expect(
      page.locator('.MuiAlert-message').first(),
    ).toContainText('Tài khoản đã bị khóa', { timeout: 5_000 });
  });
});

// =====================================================================
// Part B – Tính năng "Remember Me"
// =====================================================================
// IMPORTANT: This describe block does NOT register an addInitScript that
// clears localStorage, because the whole point is to verify that
// credentials PERSIST. We manually clear state before each test instead.
test.describe('Login Page – Tính năng "Remember Me"', () => {
  test.beforeEach(async ({ page }) => {
    // ------------------------------------------------------------------
    // addInitScript clears localStorage ONLY on the very first page load
    // of this test (tracked via sessionStorage flag). Subsequent
    // navigations (login redirect → /, logout reload, about:blank round-
    // trip) must NOT re-clear storage so Remember Me data persists.
    // This also avoids the ExecutionContext race with React's useEffect
    // redirect on mount when a stale token exists.
    // ------------------------------------------------------------------
    await page.context().addInitScript(() => {
      const origin = window.location.origin || window.location.href;
      const flagKey = `__test_rm_init_${origin}`;
      if (!sessionStorage.getItem(flagKey)) {
        localStorage.clear();
        sessionStorage.setItem(flagKey, '1');
      }
    });

    await page.goto(`${BASE}/login`);

    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // --- Shared helpers ---
  async function checkRememberMe(page: any) {
    // MUI Checkbox rendered inside FormControlLabel
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.check();
  }

  async function uncheckRememberMe(page: any) {
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.uncheck();
  }

  async function loginWithRememberMe(
    page: any,
    email: string,
    password: string,
    remember: boolean,
  ) {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);

    if (remember) {
      await checkRememberMe(page);
    } else {
      await uncheckRememberMe(page);
    }

    await page.locator('button[type="submit"]').click();
    await page.waitForURL(URL_HOME, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_HOME);
  }

  async function logoutAndGoToLogin(page: any) {
    // Logout button (i18n key nav.logout → "Logout" in English)
    await page.getByRole('button', { name: /log ?out/i }).click();
    // handleLogout calls window.location.reload() → stays on /
    // Wait for reload to complete, then manually navigate to /login
    await page.waitForLoadState('domcontentloaded');
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({
      timeout: 10_000,
    });
  }

  // ---------------------------------------------------------------
  // Scenario 1: Remember Me → fields filled after logout
  // ---------------------------------------------------------------
  test('Kịch bản 1: Lưu thông tin thành công', async ({ page }) => {
    await loginWithRememberMe(page, 'volunteer1@gmail.com', '123456', true);

    await logoutAndGoToLogin(page);

    // Both fields must be pre-filled
    await expect(page.locator('input[name="email"]')).toHaveValue(
      'volunteer1@gmail.com',
    );
    await expect(page.locator('input[name="password"]')).toHaveValue(
      '123456',
    );
  });

  // ---------------------------------------------------------------
  // Scenario 2: NO Remember Me → fields empty after logout
  // ---------------------------------------------------------------
  test('Kịch bản 2: Không lưu thông tin', async ({ page }) => {
    await loginWithRememberMe(page, 'volunteer1@gmail.com', '123456', false);

    await logoutAndGoToLogin(page);

    // Both fields must be empty
    await expect(page.locator('input[name="email"]')).toHaveValue('');
    await expect(page.locator('input[name="password"]')).toHaveValue('');
  });

  // ---------------------------------------------------------------
  // Scenario 3: Overwrite previously saved credentials
  // ---------------------------------------------------------------
  test('Kịch bản 3: Ghi đè thông tin (Overwrite)', async ({ page }) => {
    // First login as volunteer1 with Remember Me
    await loginWithRememberMe(page, 'volunteer1@gmail.com', '123456', true);
    await logoutAndGoToLogin(page);

    // Verify volunteer1 data is pre-filled from step 1
    await expect(page.locator('input[name="email"]')).toHaveValue(
      'volunteer1@gmail.com',
    );

    // Now login as volunteer2 with Remember Me (overwrite)
    await loginWithRememberMe(page, 'volunteer2@gmail.com', '123456', true);
    await logoutAndGoToLogin(page);

    // Fields must now contain volunteer2 data, NOT volunteer1
    await expect(page.locator('input[name="email"]')).toHaveValue(
      'volunteer2@gmail.com',
    );
    await expect(page.locator('input[name="password"]')).toHaveValue(
      '123456',
    );
  });

  // ---------------------------------------------------------------
  // Scenario 4: Simulate closing & reopening the browser
  // ---------------------------------------------------------------
  test('Kịch bản 4: Trạng thái trình duyệt', async ({ page }) => {
    // Login with Remember Me
    await loginWithRememberMe(page, 'volunteer1@gmail.com', '123456', true);

    // Simulate "close browser tab" by navigating away to about:blank,
    // then "reopen" by going back to /login (same browser context).
    // localStorage persists across navigations within the same context.
    await logoutAndGoToLogin(page);

    await page.goto('about:blank');
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({
      timeout: 10_000,
    });

    // Credentials must still be pre-filled after "closing and reopening"
    await expect(page.locator('input[name="email"]')).toHaveValue(
      'volunteer1@gmail.com',
    );
    await expect(page.locator('input[name="password"]')).toHaveValue(
      '123456',
    );
  });
});