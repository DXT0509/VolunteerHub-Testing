import { test, expect } from "@playwright/test";

// Use saved Volunteer storageState
test.use({ storageState: "playwright/.auth/volunteer.json" });

test.describe("User Profile - Xem và Cập nhật hồ sơ", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the user profile page
    await page.goto("/user-profile");

    // Verify we are on the Profile page
    await expect(
      page
        .locator("h3")
        .filter({ hasText: /Hồ sơ|Profile/i })
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("Hiển thị thông tin hồ sơ và cho phép cập nhật thông tin cá nhân", async ({
    page,
  }) => {
    // 1. Target form input fields
    const fullNameInput = page
      .locator("div.flex")
      .filter({
        has: page.locator("span").filter({ hasText: /Họ tên|Full name/i }),
      })
      .locator("input");
    const emailInput = page
      .locator("div.flex")
      .filter({ has: page.locator("span").filter({ hasText: /Email/i }) })
      .locator("input");
    const phoneInput = page
      .locator("div.flex")
      .filter({
        has: page.locator("span").filter({ hasText: /Số điện thoại|Phone/i }),
      })
      .locator("input");
    const usernameInput = page
      .locator("div.flex")
      .filter({
        has: page
          .locator("span")
          .filter({ hasText: /Tên đăng nhập|Username/i }),
      })
      .locator("input");
    const saveButton = page
      .locator('button[type="submit"]')
      .filter({ hasText: /Lưu thay đổi|Save changes/i });

    // 2. Verify inputs are loaded with initial volunteer data
    await expect(fullNameInput).toBeVisible();
    await expect(emailInput).toHaveValue("volunteer1@gmail.com");
    await expect(emailInput).toBeDisabled(); // Email is read-only

    // Save initial values to restore later
    const originalName = await fullNameInput.inputValue();
    const originalPhone = await phoneInput.inputValue();

    // 3. Fill new values to update profile
    const testName = "Volunteer One Updated";
    const testPhone = "0981111222";

    await fullNameInput.fill(testName);
    await phoneInput.fill(testPhone);

    // 4. Submit the profile changes
    await saveButton.click();

    // 5. The page will trigger window.location.reload() after the PUT succeeds.
    // Playwright's auto-retrying expect handles the reload timing.
    // Wait for the Profile heading to re-appear after the full-page reload.
    await expect(
      page
        .locator("h3")
        .filter({ hasText: /Hồ sơ|Profile/i })
        .first(),
    ).toBeVisible({ timeout: 15000 });

    // 6. Verify that updated values are correctly loaded after page refresh
    await expect(
      page
        .locator("div.flex")
        .filter({
          has: page.locator("span").filter({ hasText: /Họ tên|Full name/i }),
        })
        .locator("input"),
    ).toHaveValue(testName);
    await expect(
      page
        .locator("div.flex")
        .filter({
          has: page.locator("span").filter({ hasText: /Số điện thoại|Phone/i }),
        })
        .locator("input"),
    ).toHaveValue(testPhone);

    // 7. Cleanup/Revert to original values to keep the database in seed state
    const currentFullNameInput = page
      .locator("div.flex")
      .filter({
        has: page.locator("span").filter({ hasText: /Họ tên|Full name/i }),
      })
      .locator("input");
    const currentPhoneInput = page
      .locator("div.flex")
      .filter({
        has: page.locator("span").filter({ hasText: /Số điện thoại|Phone/i }),
      })
      .locator("input");
    const currentSaveButton = page
      .locator('button[type="submit"]')
      .filter({ hasText: /Lưu thay đổi|Save changes/i });

    await currentFullNameInput.fill(originalName);
    await currentPhoneInput.fill(originalPhone);
    await currentSaveButton.click();

    // Verify it was successfully reverted
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page
        .locator("div.flex")
        .filter({
          has: page.locator("span").filter({ hasText: /Họ tên|Full name/i }),
        })
        .locator("input"),
    ).toHaveValue(originalName);
    await expect(
      page
        .locator("div.flex")
        .filter({
          has: page.locator("span").filter({ hasText: /Số điện thoại|Phone/i }),
        })
        .locator("input"),
    ).toHaveValue(originalPhone);
  });
});
