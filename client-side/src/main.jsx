import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { App } from './App.jsx'
import Login from './assets/Pages/Login.jsx'
import Register from './assets/Pages/Register.jsx'
import RegisterSuccess from './assets/Pages/RegisterSuccess.jsx'
import MainLayout from './assets/Layouts/MainLayout/MainLayout.jsx'
import ShowCampaignDetail from './assets/Pages/ShowCampaignDetail.jsx'
import BeVolunteerForm from './assets/Pages/BeVolunteerForm.jsx'
import ShowChannel from './assets/Pages/ShowChannel.jsx'
import RegistrationSuccess from './assets/Pages/RegistrationSuccess.jsx'
import ShowCampaignJoin from './assets/Pages/ShowCampaignJoin.jsx'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-success" element={<RegisterSuccess />} />
          <Route path = '/events/:id' element={<ShowCampaignDetail />} />
          <Route path = '/bevolunteer/:id' element={<BeVolunteerForm />} />
          <Route path="/registration-success" element={<RegistrationSuccess />} />
          <Route path = '/exchange-channel/:id' element={<ShowChannel />} />
          <Route path='/mycampaigns' element={<ShowCampaignJoin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
