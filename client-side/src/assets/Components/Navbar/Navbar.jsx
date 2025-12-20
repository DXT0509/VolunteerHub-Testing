import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "./logo.png"; // thay bằng logo của bạn
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Dropdown } from "../dropdown/Dropdown";
import { DropdownItem } from "../dropdown/DropdownItem";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [isOpen, setIsOpen] = useState(false);
  const { i18n, t } = useTranslation();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = React.useRef(null);
  const [openManageMobile, setOpenManageMobile] = useState(false);
  const [openAdminMobile, setOpenAdminMobile] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const NOTIFICATIONS_URL =
    import.meta.env.VITE_NOTIFICATIONS_URL ||
    (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/notifications` : undefined);

  const normalizeNotificationCount = (data) => {
    // Hỗ trợ nhiều dạng phản hồi: array, {count}, {data: []}
    if (Array.isArray(data)) {
      // Nếu có trường read, đếm chưa đọc; nếu không, đếm tất cả
      const unread = data.filter((n) => n && typeof n === 'object' ? !n.is_read : true).length;
      return unread;
    }
    if (data && typeof data === 'object') {
      if (typeof data.count === 'number') return data.count;
      if (Array.isArray(data.data)) {
        const unread = data.data.filter((n) => n && typeof n === 'object' ? !n.is_read : true).length;
        return unread;
      }
    }
    return 0;
  };

  const normalizeNotificationList = (data) => {
    // Trả về mảng thông báo: hỗ trợ nhiều dạng phản hồi
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      if (Array.isArray(data.data)) return data.data;
      if (Array.isArray(data.items)) return data.items;
    }
    return [];
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const token = localStorage.getItem('token');
      const data = await fetch("http://localhost:4000/notifications/my", {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
      const count = normalizeNotificationCount(data);
      const list = normalizeNotificationList(data);
      setNotificationCount(count);
      setNotifications(list);
      return list;
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      return [];
    } finally {
      setNotifLoading(false);
    }
  };

  const markAllNotificationsAsRead = async (items) => {
    try {
      const token = localStorage.getItem('token');
      const ids = (Array.isArray(items) ? items : notifications)
        .filter((n) => n && typeof n === 'object' && (n.read !== true && n.is_read !== true))
        .map((n) => n.id)
        .filter((id) => typeof id === 'number' || typeof id === 'string');
      if (ids.length === 0) {
        setNotificationCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
        return;
      }
      await Promise.all(ids.map((id) =>
        fetch(`http://localhost:4000/notifications/${id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }).then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      ));
      // Update local state to reflect read status
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
      setNotificationCount(0);
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll mỗi 30s
    return () => clearInterval(interval);
  }, []);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const onClickOutside = (e) => {
      if (!notifOpen) return;
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [notifOpen]);

  // Derive role from server user object
  const deriveRole = (u) => {
    try {
      const rolesArr = u?.roles || [];
      const names = rolesArr.map(r => String(r?.role?.name || r?.name || '').toUpperCase());
      if (names.some(n => n.includes('ADMIN'))) return 'admin';
      if (names.some(n => n.includes('MANAGER'))) return 'manager';
      if (names.some(n => n.includes('VOLUNTEER'))) return 'volunteer';
    } catch {}
    return 'guest';
  };

  // Load real user from localStorage (or fallback to guest)
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const raw = JSON.parse(userStr);
        let photo = raw?.avatar_url || raw?.photoURL || null;
        if (photo && typeof photo === 'string' && photo.startsWith('/uploads/')) {
          photo = `http://localhost:4000${photo}`;
        }
        const normalized = {
          displayName: raw?.full_name || raw?.name || raw?.username || 'User',
          email: raw?.email || '',
          photoURL: photo,
          roles: raw?.roles || [],
        };
        setUser(normalized);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Listen for profile updates to refresh avatar/name immediately
  useEffect(() => {
    const onUserUpdated = (e) => {
      try {
        const payload = e?.detail;
        if (payload && typeof payload === 'object') {
          let photo = payload?.avatar_url || null;
          if (photo && typeof photo === 'string' && photo.startsWith('/uploads/')) {
            photo = `http://localhost:4000${photo}`;
          }
          const normalized = {
            displayName: payload?.full_name || payload?.username || 'User',
            email: payload?.email || user?.email || '',
            photoURL: photo,
            roles: payload?.roles || user?.roles || [],
          };
          setUser(normalized);
          return;
        }
        // Fallback: re-read localStorage if no payload
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const raw = JSON.parse(userStr);
          let photo = raw?.avatar_url || raw?.photoURL || null;
          if (photo && typeof photo === 'string' && photo.startsWith('/uploads/')) {
            photo = `http://localhost:4000${photo}`;
          }
          const normalized = {
            displayName: raw?.full_name || raw?.name || raw?.username || 'User',
            email: raw?.email || '',
            photoURL: photo,
            roles: raw?.roles || [],
          };
          setUser(normalized);
        }
      } catch {}
    };
    window.addEventListener('user:updated', onUserUpdated);
    return () => window.removeEventListener('user:updated', onUserUpdated);
  }, [user]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {}
    setUser(null);
    // Force a full page refresh so the app state resets
    try {
      window.location.reload();
    } catch {}
  };
  const role = deriveRole(user);

  // Smooth scroll to #contact across routes
  const handleContactClick = async (e) => {
    try {
      e.preventDefault();
      const goScroll = () => {
        const el = document.getElementById('contact');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };

      if (location.pathname !== '/') {
        navigate('/#contact');
        // Wait for route to render, then attempt scroll
        setTimeout(() => {
          // try a few times in case of async content
          let attempts = 0;
          const timer = setInterval(() => {
            attempts += 1;
            if (goScroll() || attempts >= 10) clearInterval(timer);
          }, 50);
        }, 0);
        return;
      }

      // Already on home, just scroll
      goScroll();
    } catch {}
  };

  return (
    <nav className="bg-white shadow-md relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 pt-6">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/">
              <img src={logo} alt="Logo" className="h-16 md:h-20 w-auto object-contain" />
            </Link>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex md:space-x-20 items-center text-xl font-medium">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? "text-blue-600 font-semibold"
                  : "text-gray-700 hover:text-blue-600"
              }
            >
              {t('nav.home')}
            </NavLink>
            {/* <NavLink
              to="/mycampaigns"
              className={({ isActive }) =>
                isActive
                  ? "text-blue-600 font-semibold"
                  : "text-gray-700 hover:text-blue-600"
              }
            >
              My Campaign
            </NavLink> */}
            <Link
              to="/#contact"
              onClick={handleContactClick}
              className="text-gray-700 hover:text-blue-600"
            >
              {t('nav.contact')}
            </Link>
            <NavLink
              to="/support"
              className={({ isActive }) =>
                isActive
                  ? "text-blue-600 font-semibold"
                  : "text-gray-700 hover:text-blue-600"
              }
            >
              {t('nav.support')}
            </NavLink>
            {/* Volunteer extra */}
            {role === 'volunteer' && (
              <NavLink
                to="/mycampaigns"
                className={({ isActive }) =>
                  isActive
                    ? "text-blue-600 font-semibold"
                    : "text-gray-700 hover:text-blue-600"
                }
              >
                {t('nav.myCampaign')}
              </NavLink>
            )}
            {/* Manager dropdown */}
            {role === 'manager' && (
              <div
                className="relative"
                onMouseEnter={() => setManageOpen(true)}
                onMouseLeave={() => setManageOpen(false)}
              >
                <button
                  className="dropdown-toggle text-gray-700 hover:text-blue-600"
                  aria-haspopup="true"
                  aria-expanded={manageOpen}
                >
                  {t('nav.manage')}
                </button>
                <Dropdown isOpen={manageOpen} onClose={() => setManageOpen(false)} className="right-0 w-48">
                  <DropdownItem tag="a" to="/manage-my-campaigns">{t('manage.ManageMyCamapaign')}</DropdownItem>
                  <DropdownItem tag="a" to="/manage-pending-registrations">{t('manage.ManageRegistration')}</DropdownItem>
                  <DropdownItem tag="a" to="/show-volunteers">{t('manage.SeeVolunteers')}</DropdownItem>
                  <DropdownItem tag="a" to="/check-out-volunteer">{t('manage.FinishVolunteers')}</DropdownItem>
                </Dropdown>
              </div>
            )}
            {/* Admin dropdown */}
            {role === 'admin' && (
              <div
                className="relative"
                onMouseEnter={() => setAdminOpen(true)}
                onMouseLeave={() => setAdminOpen(false)}
              >
                <button
                  className="dropdown-toggle text-gray-700 hover:text-blue-600"
                  aria-haspopup="true"
                  aria-expanded={adminOpen}
                >
                  {t('nav.admin')}
                </button>
                <Dropdown isOpen={adminOpen} onClose={() => setAdminOpen(false)} className="right-0 w-44">
                  <DropdownItem tag="a" to="/manage-manager-campaigns">{t('adminMenu.ManageManagerCampaign')}</DropdownItem>
                  <DropdownItem tag="a" to="/control-users">{t('adminMenu.ManageUser')}</DropdownItem>
                </Dropdown>
              </div>
            )}
          </div>

          {/* User Info / Login + Language */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {/* Language Switcher (Buttons) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i18n.changeLanguage('vi')}
                className={`${i18n.language.startsWith('vi') ? 'bg-orange-500 text-white' : 'bg-black text-white'} px-2.5 py-1 rounded text-xs font-semibold`}
                aria-pressed={i18n.language.startsWith('vi')}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => i18n.changeLanguage('en')}
                className={`${i18n.language.startsWith('vi') ? 'bg-black text-white' : 'bg-orange-500 text-white'} px-2.5 py-1 rounded text-xs font-semibold`}
                aria-pressed={!i18n.language.startsWith('vi')}
              >
                EN
              </button>
            </div>
            {/* Nút thông báo + Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={async () => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) {
                    const list = await fetchNotifications();
                    await markAllNotificationsAsRead(list);
                  }
                }}
                className="relative p-2 rounded-full hover:bg-gray-100"
                aria-haspopup="true"
                aria-expanded={notifOpen}
                aria-label="Notifications"
              >
                <svg
                  className="h-6 w-6 text-gray-700"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14V11a6 6 0 10-12 0v3c0 .386-.146.735-.405 1.001L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {/* Badge thông báo (ẩn nếu 0) */}
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {notificationCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 max-w-[22rem] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 z-50"
                  role="menu"
                  aria-label="Notifications dropdown"
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('nav.notifications') || 'Notifications'}</p>
                    {notifLoading && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
                    )}
                  </div>
                  <ul className="max-h-80 overflow-auto">
                    {notifications.length === 0 && !notifLoading && (
                      <li className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">{t('nav.noNotifications') || 'No notifications'}</li>
                    )}
                    {notifications.map((n, idx) => (
                      <li key={n.id || idx} className="px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex items-start gap-2">
                          <div className={`mt-1 h-2 w-2 rounded-full ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{n.body || n.message || n.text || 'New notification'}</p>
                            {n.time && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{n.time}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  
                </div>
              )}
            </div>
            {user ? (
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                    {user.displayName[0]}
                  </div>
                )}
                <Link
                  to="/user-profile"
                  state={{
                    username: (user.displayName || "").toLowerCase().replace(/\s+/g, ""),
                    email: user.email || undefined,
                    full_name: user.displayName || undefined,
                    avatar_url: user.photoURL || undefined,
                    phone: undefined,
                  }}
                  className="text-gray-700 hover:text-blue-600"
                  aria-label="Go to user profile"
                >
                  {user.displayName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-2 pt-2 pb-3 space-y-1 bg-white shadow">
          {/* Language Switcher (Mobile Buttons) */}
          <div className="px-3 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('vi')}
              className={`${i18n.language.startsWith('vi') ? 'bg-orange-500 text-white' : 'bg-black text-white'} px-3 py-1 rounded text-xs font-semibold`}
              aria-pressed={i18n.language.startsWith('vi')}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`${i18n.language.startsWith('vi') ? 'bg-black text-white' : 'bg-orange-500 text-white'} px-3 py-1 rounded text-xs font-semibold`}
              aria-pressed={!i18n.language.startsWith('vi')}
            >
              EN
            </button>
          </div>
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "block px-3 py-2 text-blue-600 font-semibold rounded"
                : "block px-3 py-2 text-gray-700 hover:text-blue-600 rounded"
            }
            onClick={() => setIsOpen(false)}
          >
            {t('nav.home')}
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive
                ? "block px-3 py-2 text-blue-600 font-semibold rounded"
                : "block px-3 py-2 text-gray-700 hover:text-blue-600 rounded"
            }
            onClick={() => setIsOpen(false)}
          >
            {t('nav.about')}
          </NavLink>
          <Link
            to="/#contact"
            onClick={(e) => { handleContactClick(e); setIsOpen(false); }}
            className="block px-3 py-2 text-gray-700 hover:text-blue-600 rounded"
          >
            {t('nav.contact')}
          </Link>
          <NavLink
            to="/support"
            className={({ isActive }) =>
              isActive
                ? "block px-3 py-2 text-blue-600 font-semibold rounded"
                : "block px-3 py-2 text-gray-700 hover:text-blue-600 rounded"
            }
            onClick={() => setIsOpen(false)}
          >
            {t('nav.support')}
          </NavLink>
          {/* Volunteer extra (mobile) */}
          {role === 'volunteer' && (
            <NavLink
              to="/mycampaigns"
              className={({ isActive }) =>
                isActive
                  ? "block px-3 py-2 text-blue-600 font-semibold rounded"
                  : "block px-3 py-2 text-gray-700 hover:text-blue-600 rounded"
              }
              onClick={() => setIsOpen(false)}
            >
              {t('nav.myCampaign')}
            </NavLink>
          )}
          {/* Manager submenu (mobile) */}
          {role === 'manager' && (
            <div className="px-3 py-2">
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100"
                onClick={() => setOpenManageMobile((v) => !v)}
              >
                {t('nav.manage')}
              </button>
              {openManageMobile && (
                <div className="mt-1 space-y-1">
                  <Link to="/manage/dashboard" className="block px-4 py-2 rounded hover:bg-gray-100" onClick={() => setIsOpen(false)}>{t('manage.dashboard')}</Link>
                  <Link to="/manage/volunteers" className="block px-4 py-2 rounded hover:bg-gray-100" onClick={() => setIsOpen(false)}>{t('manage.volunteers')}</Link>
                  <Link to="/manage/campaigns" className="block px-4 py-2 rounded hover:bg-gray-100" onClick={() => setIsOpen(false)}>{t('manage.campaigns')}</Link>
                  <Link to="/manage/reports" className="block px-4 py-2 rounded hover:bg-gray-100" onClick={() => setIsOpen(false)}>{t('manage.reports')}</Link>
                </div>
              )}
            </div>
          )}
          {/* Admin submenu (mobile) */}
          {role === 'admin' && (
            <div className="px-3 py-2">
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100"
                onClick={() => setOpenAdminMobile((v) => !v)}
              >
                {t('nav.admin')}
              </button>
              {openAdminMobile && (
                <div className="mt-1 space-y-1">
                  <Link to="/admin/panel" className="block px-4 py-2 rounded hover:bg-gray-100" onClick={() => setIsOpen(false)}>{t('adminMenu.panel')}</Link>
                  <Link to="/admin/settings" className="block px-4 py-2 rounded hover:bg-gray-100" onClick={() => setIsOpen(false)}>{t('adminMenu.settings')}</Link>
                </div>
              )}
            </div>
          )}
          {user ? (
            <div className="px-3 py-2 border-t border-gray-200 flex flex-col space-y-1">
              <Link
                to="/user-profile"
                state={{
                  username: (user.displayName || "").toLowerCase().replace(/\s+/g, ""),
                  email: user.email || undefined,
                  full_name: user.displayName || undefined,
                  avatar_url: user.photoURL || undefined,
                  phone: undefined,
                }}
                className="text-gray-700 hover:text-blue-600"
                onClick={() => setIsOpen(false)}
                aria-label="Go to user profile"
              >
                {user.displayName}
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="block px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setIsOpen(false)}
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;