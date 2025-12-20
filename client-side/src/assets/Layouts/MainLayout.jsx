import { Outlet, ScrollRestoration } from "react-router-dom";
import Navbar from "../Components/Navbar/Navbar";
import Footer from "../Components/Footer/Footer";

const MainLayout = () => (
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

export default MainLayout;
