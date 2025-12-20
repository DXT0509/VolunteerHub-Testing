import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useLocation, useNavigate } from 'react-router-dom';
import '../Pages/Login.css';
import { useTranslation } from 'react-i18next';

const RegisterSuccess = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const fromState = location.state && location.state.fromRegister;
    const fromStorage = sessionStorage.getItem('registrationSuccess') === 'true';
    if (fromState || fromStorage) {
      setAllowed(true);
      // tiêu thụ cờ để không thể refresh vào lại
      sessionStorage.removeItem('registrationSuccess');
      // Optionally clear history state
      window.history.replaceState({}, document.title);
    } else {
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  if (!allowed) return null;
  return (
    <div className="auth-page">
      <div className="wrapper" style={{ minHeight: 260 }}>
        <div className="form-box" style={{ background: 'linear-gradient(#16a34a 0 90px, #ffffff 90px 100%)', padding: '0 28px 24px' }}>
          <h2>{t('registrationSuccess.title', 'Thành công')}</h2>
          <Box display="flex" flexDirection="column" alignItems="center" mt={4} gap={3}>
            <Typography variant="h6" align="center" sx={{ fontWeight: 600, color: '#166534' }}>
                {t('registrationSuccess.message', 'Gửi đơn xin tình nguyện thành công!')}
            </Typography>
            <Button
              variant="contained"
              color="success"
              onClick={() => navigate('/')}
              startIcon={<CheckCircleIcon />}
              className="btn"
              sx={{ mt: 1, fontWeight: 600 }}
            >
              {t('common.takeMeHome', 'Về trang chủ')}
            </Button>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default RegisterSuccess;
