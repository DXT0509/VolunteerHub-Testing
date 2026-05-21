import { expect } from "@playwright/test";
import { createFlakyTest } from "./support/flakyTest";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const test = createFlakyTest(5);

const URL_REGISTER = /\/register\/?$/;
const URL_LOGIN = /\/login\/?$/;
const URL_REGISTER_SUCCESS = /\/register-success\/?$/;

const openRegisterSuccess = async (page: import("@playwright/test").Page) => {
  await page.route("**/auth/register", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: Date.now() }),
    });
  });

  const uniqueId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;

  await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /register/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.locator('input[name="full_name"]').fill("Register Success Test");
  await page.locator('input[name="phone"]').fill(`090${uniqueId.slice(-7)}`);
  await page.locator('input[name="email"]').fill(`success_${uniqueId}@gmail.com`);
  await page.locator('input[name="password"]').fill("test123456");
  await page.locator('input[type="checkbox"][name="agree"]').check();
  await page.getByRole("button", { name: /register/i }).click();

  await expect(page).toHaveURL(URL_REGISTER_SUCCESS);
};

test.describe("Register Success Page - Positive", () => {
  test("Hiển thị tiêu đề và thông báo thành công", async ({ page }) => {
    await openRegisterSuccess(page);

    await expect(
      page.getByRole("heading", { name: "Success", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/registered successfully|đăng ký.*thành công/i).first(),
    ).toBeVisible();
  });

  test('Nút "Quay lại trang đăng nhập" hiển thị rõ ràng', async ({ page }) => {
    await openRegisterSuccess(page);

    const backButton = page.getByRole("button", {
      name: /back to login|quay về.*đăng nhập/i,
    });

    await expect(backButton).toBeVisible();
    await expect(backButton).toBeEnabled();
  });

  test('Click "Quay lại trang đăng nhập" => điều hướng về /login', async ({ page }) => {
    await openRegisterSuccess(page);

    await page
      .getByRole("button", { name: /back to login|quay về.*đăng nhập/i })
      .click();

    await page.waitForURL(URL_LOGIN, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_LOGIN);
    await expect(
      page.getByRole("heading", { name: "Login", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Register Success Page - Guard", () => {
  test("Direct access without registration redirects to /register", async ({ page }) => {
    await page.goto(`${BASE}/register-success`);

    await page.waitForURL(URL_REGISTER, { timeout: 10_000 });
    await expect(page).toHaveURL(URL_REGISTER);
  });
});
