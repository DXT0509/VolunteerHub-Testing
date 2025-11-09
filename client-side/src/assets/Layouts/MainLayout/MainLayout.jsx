import { Outlet, ScrollRestoration } from "react-router-dom";
import Navbar from "../../Components/Navbar/Navbar.jsx";
import Footer from "../../Components/Footer/Footer.jsx";
import {App,Login} from "../../../App.jsx";
const MainLayout = () => (
  <div>
    <Navbar />

    <div className="min-h-[calc(100vh-363px)]">
      <Outlet />
    </div>

    {/* Footer */}
  </div>
);

export default MainLayout;