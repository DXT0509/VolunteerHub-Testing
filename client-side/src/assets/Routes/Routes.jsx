import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../Layouts/MainLayout.jsx";

// Pages của BẠN
import { App } from "../../App.jsx";
import Login from "../Pages/Login.jsx";
import Register from "../Pages/Register.jsx";
import RegisterSuccess from "../Pages/RegisterSuccess.jsx";
import ShowCampaignDetail from "../Pages/ShowCampaignDetail.jsx";
import BeVolunteerForm from "../Pages/BeVolunteerForm.jsx";
import ShowChannel from "../Pages/ShowChannel.jsx";
import RegistrationSuccess from "../Pages/RegistrationSuccess.jsx";
import ShowCampaignJoin from "../Pages/ShowCampaignJoin.jsx";
import ControlUser from "../Pages/ControlUser.jsx";
import ManageMyCampaign from "../Pages/ManageMyCampaign.jsx";
import ManageManagerCampaign from "../Pages/ManageManagerCampaign.jsx";
import ManagePendingRegistration from "../Pages/ManagePendingRegistration.jsx";
import ForgetPassword from "../Pages/ForgetPassword.jsx";
import ShowVolunteer from "../Pages/ShowVolunteer.jsx";
import CheckOutVolunteer from "../Pages/CheckOutVolunteer.jsx";

// Pages của BẠN BÈ
import Home from "../Pages/HomePage/Home/Home.jsx";
import NeedVolunteer from "../Pages/HomePage/NeedVolunteer/NeedVolunteer.jsx";
import FaqPage from "../Pages/HomePage/VolunteerNeeds/FaqPage.jsx";
import ErrorPage from "../Pages/ErrorPage/ErrorPage.jsx";
import UserProfileStandalone from "../Pages/UserProfile/UserProfiles";
import Article from "../Pages/HomePage/Blog/Article.tsx";
const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, path: "/", element: <Home title="Home" /> }, // hoặc <Home />
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "register-success", element: <RegisterSuccess /> },
      { path: "events/:id", element: <ShowCampaignDetail /> },
      { path: "bevolunteer/:id", element: <BeVolunteerForm /> },
      { path: "registration-success", element: <RegistrationSuccess /> },
      { path: "exchange-channel/:id", element: <ShowChannel /> },
      { path: "mycampaigns", element: <ShowCampaignJoin /> },
      { path: "control-users", element: <ControlUser /> },
      { path: "manage-my-campaigns", element: <ManageMyCampaign /> },
      { path: "manage-manager-campaigns", element: <ManageManagerCampaign /> },
      { path: "manage-pending-registrations", element: <ManagePendingRegistration /> },
      { path: "forget-password", element: <ForgetPassword /> },
      { path: "show-volunteers", element: <ShowVolunteer /> },
      { path: "check-out-volunteer", element: <CheckOutVolunteer /> },

      // Route của bạn bè
      { path: "need-volunteer", element: <NeedVolunteer /> },
      { path: "support", element: <FaqPage /> },
      { path: "user-profile", element: <UserProfileStandalone /> },
      {
        path: "article/:id",
        element: <Article />,
      },
    ],
  },
]);

export default router;
