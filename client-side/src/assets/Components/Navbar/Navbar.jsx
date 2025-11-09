import React, { useEffect, useState } from 'react';

const Navbar = () => {
  const [loggedIn, setLoggedIn] = useState(false);

  const checkAuth = () => {
    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('token') ||
        sessionStorage.getItem('accessToken');
      if (token && token !== 'undefined' && token !== 'null') return true;

      const userStr =
        localStorage.getItem('user') ||
        sessionStorage.getItem('user');
      if (userStr && userStr !== 'undefined' && userStr !== 'null') return true;
    } catch (_) {
      // ignore
    }
    return false;
  };

  useEffect(() => {
    setLoggedIn(checkAuth());
    const onStorage = () => setLoggedIn(checkAuth());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleLogout = () => {
    try {
      ['token', 'accessToken', 'user', 'Authorization'].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } catch (_) {}
    setLoggedIn(false);
    window.location.href = '/login';
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-danger px-4 justify-content-between w-100 bg-pink">
      <div className="d-flex align-items-center">
        <img
          src="https://userpic.codeforces.org/1657001/title/7b916a641c436c8c.jpg"
          alt="logo"
          width="50"
          height="50"
          className="rounded-circle me-3"
        />
        <span
          className="text-white fw-bold mx-3"
          style={{ cursor: 'pointer' }}
          onClick={() => (window.location.href = '/')}
        >
          Trang chủ
        </span>
      </div>

      <div>
        {loggedIn ? (
          <span
            className="text-white fw-semibold"
            style={{ cursor: 'pointer' }}
            onClick={handleLogout}
          >
            Đăng xuất
          </span>
        ) : (
          <>
            <span
              className="text-white me-2 fw-semibold"
              style={{ cursor: 'pointer' }}
              onClick={() => (window.location.href = '/login')}
            >
              Đăng nhập /
            </span>
            <span
              className="text-white fw-semibold"
              style={{ cursor: 'pointer' }}
              onClick={() => (window.location.href = '/register')}
            >
              Đăng ký
            </span>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;