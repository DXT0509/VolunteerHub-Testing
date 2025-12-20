import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import router from "./assets/Routes/Routes.jsx";
import './i18n';
import AOS from 'aos';
import 'aos/dist/aos.css';
AOS.init({
  duration: 800,
  easing: 'ease-in-out',
  once: true,
});
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
