import { test, expect } from "@playwright/test";

// Use saved Admin storageState
test.use({ storageState: "playwright/.auth/admin.json" });

test.describe("Admin User Control - Khóa/Mở tài khoản người dùng", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the user management page
    await page.goto("/control-users");

    // Verify the page title to ensure we are on the User Management page
    await expect(
      page
        .locator("h2")
        .filter({ hasText: /Quản lý người dùng|User Management/i })
        .first(),
    ).toBeVisible({ timeout: 15000 });

    // Data loads async — the search input is rendered only after fetch completes.
    // Wait for it to appear as a signal that the table is ready.
    const searchInput = page.getByLabel(/Tìm kiếm người dùng|Search users/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test("Khóa và mở khóa tài khoản người dùng volunteer2", async ({ page }) => {
    const searchInput = page.getByLabel(/Tìm kiếm người dùng|Search users/i);

    // Search for "Volunteer 2" (Full Name) to isolate volunteer2 on page 0.
    // Press Enter to submit — the source handles onKeyDown Enter (ControlUser.jsx:261).
    // Using Enter avoids the suggestion dropdown Paper (zIndex:10) overlapping the
    // search button, which would cause actionability timeouts.
    await searchInput.fill("Volunteer 22");
    await searchInput.press("Enter");

    // 1. Find the table row containing the volunteer2 account
    const volunteerRow = page.locator("tr", {
      hasText: "volunteer22@gmail.com",
    });
    await expect(volunteerRow).toBeVisible();

    // 2. Check the initial status is active
    await expect(volunteerRow.locator("td")).toContainText([
      /Hiệu lực|Active/i,
    ]);

    // 3. Click the "Khóa" (Lock) button
    const lockButton = volunteerRow
      .locator("button")
      .filter({ hasText: /Khóa|Lock/i });
    await expect(lockButton).toBeVisible();
    await lockButton.click();

    // 4. Verify the locked snackbar message appears
    const snackbar = page.locator(".MuiAlert-message").first();
    await expect(snackbar).toContainText(/Đã khóa tài khoản|Locked account/i, {
      timeout: 10000,
    });

    // 5. Verify the status updates to locked and the button switches to "Mở" (Unlock)
    await expect(volunteerRow.locator("td")).toContainText([/Đã khóa|Locked/i]);
    const unlockButton = volunteerRow
      .locator("button")
      .filter({ hasText: /Mở|Unlock/i });
    await expect(unlockButton).toBeVisible();

    // 6. Click the "Mở" (Unlock) button to restore status
    await unlockButton.click();

    // 7. Verify the unlocked snackbar message appears
    await expect(snackbar).toContainText(
      /Đã mở khóa tài khoản|Unlocked account/i,
      { timeout: 10000 },
    );

    // 8. Verify the status updates back to active and the button switches to "Khóa" (Lock)
    await expect(volunteerRow.locator("td")).toContainText([
      /Hiệu lực|Active/i,
    ]);
    await expect(
      volunteerRow.locator("button").filter({ hasText: /Khóa|Lock/i }),
    ).toBeVisible();
  });
});
