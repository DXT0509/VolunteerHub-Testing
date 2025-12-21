import { useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import Navbar from "../Components/Navbar/Navbar";
import Footer from "../Components/Footer/Footer";

const MainLayout = () => {
  const location = useLocation();
  // Reload toàn bộ trang một lần khi mở tab lần đầu,
  // đảm bảo Navbar và mọi phần được nạp lại từ đầu.
  useEffect(() => {
    try {
      const key = "firstLoadDone";
      const hasReloaded = sessionStorage.getItem(key);
      if (!hasReloaded) {
        sessionStorage.setItem(key, "true");
        // Full reload (hard refresh) để đảm bảo mọi thứ đồng bộ
        window.location.reload();
      }
    } catch (e) {
      // Bỏ qua nếu sessionStorage không khả dụng
    }
  }, []);

  // Đặt tiêu đề mặc định cho mỗi lần đổi route.
  // Các page có logic riêng sẽ override sau đó.
  useEffect(() => {
    const DEFAULT_TITLE = "VolunteerHub";
    document.title = DEFAULT_TITLE;
  }, [location.pathname]);

  return (
    <div>
      {/* Navbar */}
      <Navbar></Navbar>

      {/* Outlet */}
      <div>
        <Outlet></Outlet>
      </div>

      {/* Footer */}
      <Footer></Footer>
    </div>
  );
};

export default MainLayout;
