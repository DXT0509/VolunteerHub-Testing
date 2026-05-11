import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4173";

/**
 * Forget Password Page – /forget-password
 *
 * Three phases:
 *   Stage 1 — Verify identity (email + phone)
 *   Stage 2 — Reset password (new + confirm)
 *   Stage 3 — Post-reset login verification
 *
 * Seed-data dependencies (prisma/seedUser.ts, password always "123456"):
 *   - volunteer1@gmail.com  : phone 0980000001, is_active = true
 *   - volunteer24@gmail.com : phone 0980000024, is_active = false
 */

const URL_FORGOT = /\/forget-password\/?$/;
const URL_LOGIN = /\/login\/?$/;

test.describe("Forget Password – Stage 1: Verify", () => {
  test.beforeEach(async ({ page }) => {
    // Clean slate on every test
    await page.context().addInitScript(() => {
      const origin = window.location.origin || window.location.href;
      const flagKey = `__test_fp_init_${origin}`;
      if (!sessionStorage.getItem(flagKey)) {
        localStorage.clear();
        sessionStorage.setItem(flagKey, "1");
      }
    });

    await page.goto(`${BASE}/forget-password`);
    await expect(
      page.getByRole("heading", { name: /forgot password|quên mật khẩu/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ---- Verify helper ----
  async function fillVerifyForm(page: any, email: string, phone: string) {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill(phone);
  }

  async function clickVerify(page: any) {
    await page.getByRole("button", { name: /verify|xác thực/i }).click();
  }

  // -------------------------------------------------------------------
  // Positive – Correct email + phone → reveals reset box
  // -------------------------------------------------------------------
  test("Nhập đúng Email + Phone → hiển thị form đặt lại mật khẩu", async ({
    page,
  }) => {
    await fillVerifyForm(page, "volunteer1@gmail.com", "0980000001");
    await clickVerify(page);

    // The verify form disappears; the reset form's "New Password" field appears.
    // Use input[name="password"] to avoid ambiguity with "Confirm New Password".
    await expect(page.locator('input[name="password"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  // -------------------------------------------------------------------
  // Negative – Wrong phone (correct email)
  // -------------------------------------------------------------------
  test("Sai thông tin: Email đúng nhưng Phone sai", async ({ page }) => {
    await fillVerifyForm(page, "volunteer1@gmail.com", "0999999999");
    await clickVerify(page);

    // API returns null → client shows error
    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      /không tồn tại|not found/i,
      { timeout: 5_000 },
    );
  });

  // -------------------------------------------------------------------
  // Negative – Wrong email (correct phone)
  // -------------------------------------------------------------------
  test("Sai thông tin: Phone đúng nhưng Email sai", async ({ page }) => {
    await fillVerifyForm(page, "wrong@example.com", "0980000001");
    await clickVerify(page);

    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      /không tồn tại|not found/i,
      { timeout: 5_000 },
    );
  });

  // -------------------------------------------------------------------
  // Negative – Email + Phone not registered
  // -------------------------------------------------------------------
  test("Không tồn tại: Email + Phone chưa đăng ký", async ({ page }) => {
    await fillVerifyForm(page, "ghost@example.com", "0999999999");
    await clickVerify(page);

    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      /không tồn tại|not found/i,
      { timeout: 5_000 },
    );
  });

  // -------------------------------------------------------------------
  // Negative – Empty Email
  // -------------------------------------------------------------------
  test("Để trống Email khi Verify", async ({ page }) => {
    await fillVerifyForm(page, "", "0980000001");
    await clickVerify(page);

    // Browser HTML5 required validation blocks submission
    await expect(page).toHaveURL(URL_FORGOT);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // -------------------------------------------------------------------
  // Negative – Empty Phone
  // -------------------------------------------------------------------
  test("Để trống Phone khi Verify", async ({ page }) => {
    await fillVerifyForm(page, "volunteer1@gmail.com", "");
    await clickVerify(page);

    await expect(page).toHaveURL(URL_FORGOT);
    await expect(page.locator('input[name="phone"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // -------------------------------------------------------------------
  // Negative – Invalid email format
  // -------------------------------------------------------------------
  test("Sai định dạng Email (thiếu @)", async ({ page }) => {
    await fillVerifyForm(page, "bademail.com", "0980000001");
    await clickVerify(page);

    await expect(page).toHaveURL(URL_FORGOT);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // -------------------------------------------------------------------
  // Negative – Invalid phone format (letters)
  // -------------------------------------------------------------------
  test("Sai định dạng Phone (có chữ cái)", async ({ page }) => {
    await fillVerifyForm(page, "volunteer1@gmail.com", "0980abc001");
    await clickVerify(page);

    await expect(page).toHaveURL(URL_FORGOT);
    await expect(page.locator('input[name="phone"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // -------------------------------------------------------------------
  // Negative – Locked account
  // -------------------------------------------------------------------
  // NOTE: The current backend `getUserByEmailAndPhone` does NOT check
  // is_active. This test will fail until that guard is implemented.
  test("User bị khóa: không cho phép reset password", async ({ page }) => {
    await fillVerifyForm(page, "volunteer24@gmail.com", "0980000024");
    await clickVerify(page);

    // Expected: error message about locked account, verify box stays visible
    await expect(page).toHaveURL(URL_FORGOT);
    const errorOrForm = await Promise.race([
      page
        .locator(".MuiAlert-message")
        .filter({ hasText: /khóa|locked|banned/i })
        .first()
        .isVisible()
        .catch(() => false),
      page
        .locator('input[name="email"]')
        .isVisible()
        .then(() => "form_still_visible"),
    ]);

    if (errorOrForm === "form_still_visible") {
      // The verify form is still visible — check if reset box appeared (bad)
      const resetVisible = await page
        .locator('input[name="password"]')
        .isVisible()
        .catch(() => false);
      expect(
        resetVisible,
        "Expected locked account to be rejected, but the reset password form appeared. is_active check is missing in getUserByEmailAndPhone.",
      ).toBe(false);
    } else {
      expect(errorOrForm).toBe(true);
    }
  });
});

// =====================================================================
// Stage 2 – Reset Password
// =====================================================================
test.describe("Forget Password – Stage 2: Reset Password", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addInitScript(() => {
      const origin = window.location.origin || window.location.href;
      const flagKey = `__test_fp_init_${origin}`;
      if (!sessionStorage.getItem(flagKey)) {
        localStorage.clear();
        sessionStorage.setItem(flagKey, "1");
      }
    });

    await page.goto(`${BASE}/forget-password`);
    await expect(
      page.getByRole("heading", { name: /forgot password|quên mật khẩu/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Execute Stage 1 successfully to reveal the reset form
    await page.locator('input[name="email"]').fill("volunteer1@gmail.com");
    await page.locator('input[name="phone"]').fill("0980000001");
    await page.getByRole("button", { name: /verify|xác thực/i }).click();

    // Wait for the reset form's "New Password" field to appear
    await expect(page.locator('input[name="password"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  // ---- Helpers ----
  async function fillResetForm(page: any, password: string, confirm: string) {
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="confirm"]').fill(confirm);
  }

  async function clickReset(page: any) {
    await page
      .getByRole("button", { name: /reset password|đặt lại mật khẩu/i })
      .click();
  }

  // -------------------------------------------------------------------
  // Positive – Valid new password + confirm match
  // -------------------------------------------------------------------
  test("Đặt lại mật khẩu thành công với mật khẩu mới hợp lệ", async ({
    page,
  }) => {
    await fillResetForm(page, "newpass123", "newpass123");
    await clickReset(page);

    // Success dialog appears: "Password reset successful"
    await expect(page.getByText(/reset successful|thành công/i)).toBeVisible({
      timeout: 5_000,
    });

    // Auto-navigates to /login after 3s; wait for it
    await page.waitForURL(URL_LOGIN, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------
  // Negative – Confirm password mismatch
  // -------------------------------------------------------------------
  test('Nhập "Mật khẩu mới" và "Xác nhận mật khẩu" khác nhau', async ({
    page,
  }) => {
    await fillResetForm(page, "newpass123", "different456");
    await clickReset(page);

    // JS validation: "Mật khẩu xác nhận không khớp"
    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      /không khớp|do not match/i,
      { timeout: 5_000 },
    );
  });

  // -------------------------------------------------------------------
  // Negative – Password too short (under 6 characters)
  // -------------------------------------------------------------------
  test("Mật khẩu mới quá ngắn (dưới 6 ký tự)", async ({ page }) => {
    await fillResetForm(page, "abc12", "abc12");
    await clickReset(page);

    // JS validation: "Mật khẩu phải có ít nhất 6 ký tự"
    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      /ít nhất 6|at least 6/i,
      { timeout: 5_000 },
    );
  });

  // -------------------------------------------------------------------
  // Negative – Empty password fields
  // -------------------------------------------------------------------
  test("Để trống các trường mật khẩu và nhấn Reset", async ({ page }) => {
    // Leave both fields empty and click submit
    await clickReset(page);

    // Browser HTML5 required validation blocks submission
    await expect(page).toHaveURL(URL_FORGOT);
    await expect(page.locator('input[name="password"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // -------------------------------------------------------------------
  // Edge Case – New password same as old password
  // -------------------------------------------------------------------
  // NOTE: The current backend `resetPassword` does NOT compare old vs new
  // passwords; it will silently accept the same password. This test
  // documents the expected behavior from the spec and will fail until
  // that guard is implemented.
  test("Nhập mật khẩu mới giống hệt mật khẩu cũ", async ({ page }) => {
    await fillResetForm(page, "123456", "123456");
    await clickReset(page);

    // Spec expects: error / rejection
    // Current behavior: success dialog appears
    const successDialog = page.getByText(/reset successful|thành công/i);
    const isSuccess = await successDialog.isVisible().catch(() => false);

    if (isSuccess) {
      // Gap: server accepted same password — fail with clear message
      expect(
        false,
        "Expected old-password reuse to be rejected, but the reset succeeded. Server-side old/new password comparison is not implemented in resetPassword.",
      ).toBe(true);
    } else {
      // Server rejected it — check for an appropriate error
      await expect(page.locator(".MuiAlert-message").first()).toContainText(
        /.+/,
        { timeout: 3_000 },
      );
    }
  });
});

// =====================================================================
// Stage 3 – Post-reset login verification (End-to-End)
// =====================================================================
test.describe("Forget Password – Stage 3: Post-reset Login", () => {
  let NEW_PASSWORD: string;

  test.beforeEach(async ({ page }) => {
    // Generate a unique password so each test run is isolated
    NEW_PASSWORD = `reset_${Date.now()}`;

    await page.context().addInitScript(() => {
      const origin = window.location.origin || window.location.href;
      const flagKey = `__test_fp_init_${origin}`;
      if (!sessionStorage.getItem(flagKey)) {
        localStorage.clear();
        sessionStorage.setItem(flagKey, "1");
      }
    });

    // --- Step 1: Go through full forget-password flow ---
    await page.goto(`${BASE}/forget-password`);
    await expect(
      page.getByRole("heading", { name: /forgot password|quên mật khẩu/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Stage 1 – Verify
    await page.locator('input[name="email"]').fill("volunteer1@gmail.com");
    await page.locator('input[name="phone"]').fill("0980000001");
    await page.getByRole("button", { name: /verify|xác thực/i }).click();
    await expect(page.locator('input[name="password"]')).toBeVisible({
      timeout: 5_000,
    });

    // Stage 2 – Reset to new password
    await page.locator('input[name="password"]').fill(NEW_PASSWORD);
    await page.locator('input[name="confirm"]').fill(NEW_PASSWORD);
    await page
      .getByRole("button", { name: /reset password|đặt lại mật khẩu/i })
      .click();

    // Wait for auto-navigate to /login
    await page.waitForURL(URL_LOGIN, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_LOGIN);
  });

  // -------------------------------------------------------------------
  // Positive – Login with new password succeeds
  // -------------------------------------------------------------------
  test("Đăng nhập với mật khẩu mới → thành công", async ({ page }) => {
    await page.locator('input[name="email"]').fill("volunteer1@gmail.com");
    await page.locator('input[name="password"]').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/localhost:5173\/?$/, { timeout: 10_000 });
    await expect(page).toHaveURL(/localhost:5173\/?$/);

    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();
  });

  // -------------------------------------------------------------------
  // Negative – Login with old password fails
  // -------------------------------------------------------------------
  test("Đăng nhập với mật khẩu cũ (123456) → báo sai mật khẩu", async ({
    page,
  }) => {
    await page.locator('input[name="email"]').fill("volunteer1@gmail.com");
    await page.locator('input[name="password"]').fill("123456");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      "Sai mật khẩu",
      { timeout: 5_000 },
    );
  });
});
