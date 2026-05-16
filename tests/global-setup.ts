import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Đăng nhập bằng tài khoản EVENT_MANAGER
  // (dùng tài khoản đã seed sẵn trong DB)
  await page.goto('http://localhost:5173/login');

  await page.fill('input[type="email"]', 'thai@gmail.com'); // sửa đúng email seed
  await page.fill('input[type="password"]', '123456');           // sửa đúng password seed
  await page.click('button[type="submit"]');

  // Chờ đăng nhập xong (chờ URL đổi hoặc element xuất hiện)
  await page.waitForURL('**/'); // sửa đúng route sau login
  // Lưu trạng thái đăng nhập vào file
  await page.context().storageState({ path: 'playwright/.auth/manager.json' });

  await browser.close();
}

export default globalSetup;