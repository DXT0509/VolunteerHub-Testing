import { test, expect } from '@playwright/test';

// Use saved Admin storageState
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Admin Event Management - Duyệt/Xóa sự kiện từ Manager', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the event management page
    await page.goto('/manage-manager-campaigns');
    
    // Verify the page title to ensure we are on the Event Management page
    await expect(page.locator('h2').filter({ hasText: /Quản lý sự kiện|Event Management/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test('Duyệt sự kiện đang chờ xử lý (status pending)', async ({ page }) => {
    // Wait for the loading to finish and the search input to be visible
    const searchInput = page.getByPlaceholder(/Tìm kiếm sự kiện|Search events/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // 1. Find the first row containing a pending event (indicated by "(WAITING)" in title)
    const pendingRow = page.locator('tr', { hasText: '(WAITING)' }).first();
    await expect(pendingRow).toBeVisible();

    // 2. Click the "Chấp nhận" (Approve) button
    const approveBtn = pendingRow.locator('button').filter({ hasText: /Chấp nhận|Approve/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 3. Verify success snackbar notification
    const snackbar = page.locator('.MuiAlert-message').first();
    await expect(snackbar).toContainText(/Đã duyệt sự kiện|Approved event/i, { timeout: 10000 });

    // 4. Verify status updates to "Đã duyệt"
    await expect(pendingRow.locator('td')).toContainText([/Đã duyệt|Approved/i]);
  });

  test('Xóa sự kiện đã bị từ chối (status rejected)', async ({ page }) => {
    // Wait for the loading to finish and the search input to be visible
    const searchInput = page.getByPlaceholder(/Tìm kiếm sự kiện|Search events/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // 1. Find the first row containing a rejected event (indicated by "(REJECTED)" in title)
    const rejectedRow = page.locator('tr', { hasText: '(REJECTED)' }).first();
    await expect(rejectedRow).toBeVisible();

    // Get the title of the event to verify deletion later
    const eventTitleText = await rejectedRow.locator('td').nth(1).innerText();

    // 2. Click the "Xóa" (Delete) button
    const deleteBtn = rejectedRow.locator('button').filter({ hasText: /Xóa|Delete/i });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 3. The confirmation dialog should open, click "Xóa" inside it
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('button').filter({ hasText: /Xóa|Delete/i }).click();

    // 4. Verify success snackbar notification
    const snackbar = page.locator('.MuiAlert-message').first();
    await expect(snackbar).toContainText(/Đã xóa sự kiện|Deleted event/i, { timeout: 10000 });

    // 5. Verify the event with that title is no longer present in the table
    await expect(page.locator('tr', { hasText: eventTitleText })).not.toBeVisible();
  });
});
