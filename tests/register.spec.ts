import { expect } from "@playwright/test";
import { createFlakyTest } from "./support/flakyTest";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const test = createFlakyTest(5);

/**
 * Register Page – Luồng Đăng ký
 *
 * Covers:
 *   Positive:
 *     1. Register successfully → redirect to /register-success → login with new account
 *   Negative – Validation:
 *     2. Empty fields (Full Name, Phone, Email, Password)
 *     3. Invalid email format
 *     4. Invalid phone format (letters, special chars, too short)
 *     5. Weak password (under 6 characters)
 *     6. Terms checkbox unticked
 *   Business Logic:
 *     7. Duplicate email
 *     8. Full Name with only spaces
 *
 * Seed-data dependencies (prisma/seedUser.ts):
 *   - volunteer1@gmail.com : already exists (used for duplicate test)
 */

const URL_REGISTER = /\/register\/?$/;
const URL_REGISTER_SUCCESS = /\/register-success\/?$/;
const URL_LOGIN = /\/login\/?$/;
const BASE_URL_HOST = new URL(BASE).host;
const URL_HOME = new RegExp(
  `${BASE_URL_HOST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/?$`,
);

const NEW_FULL_NAME = "Test Register User";
const NEW_PASSWORD = "test123456";

const makeUniqueRegisterData = () => {
  const uniqueId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  return {
    email: `testregister_${uniqueId}@gmail.com`,
    phone: `090${uniqueId.slice(-7)}`,
  };
};

test.describe("Register Page – Luồng Đăng ký", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage ONLY on /register to prevent stale auth redirects.
    // Must NOT clear on subsequent page loads (e.g., /login, /) — the Register
    // success test later logs in and the token would be wiped by an unconditional clear.
    await page.context().addInitScript(() => {
      if (
        window.location.pathname === "/register" ||
        window.location.pathname === "/register/"
      ) {
        localStorage.clear();
      }
    });

    await page.goto(`${BASE}/register`);

    // Wait for the <h2>Register</h2> heading (default i18n is English).
    // This also guarantees the 1s CSS fade-in animation has completed.
    await expect(page.getByRole("heading", { name: /register/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------
  async function fillRegisterForm(
    page: ReturnType<typeof test.info> extends never ? never : any,
    fullName: string,
    phone: string,
    email: string,
    password: string,
  ) {
    await page.locator('input[name="full_name"]').fill(fullName);
    await page.locator('input[name="phone"]').fill(phone);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
  }

  async function tickAgreement(page: any) {
    await page.locator('input[type="checkbox"][name="agree"]').check();
  }

  async function submitRegisterForm(page: any) {
    await page.getByRole("button", { name: /register/i }).click();
  }

  // ===================================================================
  // Positive – Register successfully
  // ===================================================================
  test("Đăng ký thành công với đầy đủ thông tin hợp lệ", async ({ page }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      newUser.phone,
      newUser.email,
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    // On success, the app navigates to /register-success
    await page.waitForURL(URL_REGISTER_SUCCESS, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_REGISTER_SUCCESS);

    // Verify the success message is displayed
    await expect(
      page.getByRole("heading", { name: /^(success|thành công)$/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Click the "Back to login" / "Quay về trang đăng nhập" button
    await page
      .getByRole("button", { name: /back to login|quay về|đăng nhập/i })
      .click();

    // Should land on the Login page
    await page.waitForURL(URL_LOGIN, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_LOGIN);
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible({
      timeout: 10_000,
    });

    // Now verify the newly registered account can login
    await page.locator('input[name="email"]').fill(newUser.email);
    await page.locator('input[name="password"]').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Login should succeed → redirect to home
    await page.waitForURL(URL_HOME, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_HOME);

    // Token must be present
    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();
  });

  // ===================================================================
  // Negative – Empty fields (browser HTML5 validation)
  // ===================================================================

  test("Để trống trường Full Name", async ({ page }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(page, "", newUser.phone, newUser.email, NEW_PASSWORD);
    await tickAgreement(page);
    await submitRegisterForm(page);

    // Browser validation blocks submission
    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="full_name"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  test("Để trống trường Phone", async ({ page }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(page, NEW_FULL_NAME, "", newUser.email, NEW_PASSWORD);
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="phone"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  test("Để trống trường Email", async ({ page }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(page, NEW_FULL_NAME, newUser.phone, "", NEW_PASSWORD);
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  test("Để trống trường Password", async ({ page }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(page, NEW_FULL_NAME, newUser.phone, newUser.email, "");
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="password"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // ===================================================================
  // Negative – Invalid email format (browser type="email" validation)
  // ===================================================================

  test("Định dạng Email sai: thiếu @", async ({ page }) => {
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      makeUniqueRegisterData().phone,
      "invalidemail.com",
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  test("Định dạng Email sai: thiếu .com", async ({
    page,
  }) => {
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      makeUniqueRegisterData().phone,
      "user@domain",
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="email"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // ===================================================================
  // Negative – Invalid phone format (pattern="^[0-9]{9,12}$")
  // ===================================================================

  test("Định dạng Phone sai: có chữ cái", async ({ page }) => {
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      "0901abc789",
      makeUniqueRegisterData().email,
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    // pattern mismatch → validity.valid === false
    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="phone"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  test("Định dạng Phone sai: quá ngắn (dưới 9 số)", async ({ page }) => {
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      "0901",
      makeUniqueRegisterData().email,
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="phone"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  test("Định dạng Phone sai: ký tự đặc biệt", async ({ page }) => {
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      "0901-567-89",
      makeUniqueRegisterData().email,
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator('input[name="phone"]')).toHaveJSProperty(
      "validity.valid",
      false,
    );
  });

  // ===================================================================
  // Negative – Weak password (under 6 characters)
  // ===================================================================

  test("Password quá ngắn: dưới 6 ký tự", async ({ page }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(page, NEW_FULL_NAME, newUser.phone, newUser.email, "12345");
    await tickAgreement(page);
    await submitRegisterForm(page);

    // JS validation sets passwordError → shown as helperText on the TextField
    await expect(page.locator(".MuiFormHelperText-root").first()).toContainText(
      /ít nhất 6|at least 6/i,
      { timeout: 5_000 },
    );
  });

  // ===================================================================
  // Negative – Terms checkbox unticked
  // ===================================================================

  test('Không tick checkbox "I agree to terms & conditions"', async ({
    page,
  }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      newUser.phone,
      newUser.email,
      NEW_PASSWORD,
    );
    // Deliberately do NOT tick the checkbox
    await submitRegisterForm(page);

    // JS validation: "Bạn phải đồng ý với điều khoản & điều kiện"
    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      /đồng ý|điều khoản|agree|terms/i,
      { timeout: 5_000 },
    );
  });

  // ===================================================================
  // Business Logic – Duplicate email
  // ===================================================================

  test("Trùng Email: sử dụng Email đã tồn tại trong DB", async ({ page }) => {
    // volunteer1@gmail.com already exists from seed data
    await fillRegisterForm(
      page,
      NEW_FULL_NAME,
      makeUniqueRegisterData().phone,
      "volunteer1@gmail.com",
      NEW_PASSWORD,
    );
    await tickAgreement(page);
    await submitRegisterForm(page);

    // API returns 400 with "Email đã được sử dụng"
    await expect(page).toHaveURL(URL_REGISTER);
    await expect(page.locator(".MuiAlert-message").first()).toContainText(
      "Email đã được sử dụng",
      { timeout: 5_000 },
    );
  });

  // ===================================================================
  // Business Logic – Full Name with only spaces
  // ===================================================================
  // NOTE: The current Register component uses the HTML5 `required` attribute
  // which accepts whitespace-only input as "not empty". This test documents
  // the expected behavior from the spec; it will fail until server-side or
  // client-side trim validation is implemented.

  test("Xử lý khoảng trắng: Nhập Full Name chỉ toàn dấu cách", async ({
    page,
  }) => {
    const newUser = makeUniqueRegisterData();
    await fillRegisterForm(page, " ", newUser.phone, newUser.email, NEW_PASSWORD);
    await tickAgreement(page);
    await submitRegisterForm(page);

    // Assert: must stay on /register and show an error
    await expect(page).toHaveURL(URL_REGISTER, { timeout: 3_000 });
    await expect(
      page
        .locator(".MuiAlert-message, .MuiFormHelperText-root")
        .filter({ hasText: /.+/ })
        .first(),
    ).toBeVisible({ timeout: 3_000 });
  });
});
