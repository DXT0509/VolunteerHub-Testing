import React, { useEffect, useState } from "react";
import "./Login.css";
import { IonIcon } from "@ionic/react";
import { mail, lockClosed } from "ionicons/icons";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button, Checkbox, FormControlLabel, TextField, InputAdornment, Box, Grid, Alert, Slide, Fade, Snackbar } from "@mui/material";
import { useTranslation } from 'react-i18next';
function SlideFromTop(props) {
  // Always slide in from the top ('down'); on exit, MUI slides in the opposite direction -> up
  return <Slide {...props} direction="down" timeout={600} />;
}
const Login = () => {
    const navigate = useNavigate();
  const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showAlert, setShowAlert] = useState(false);
    const [animateForm, setAnimateForm] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [emailValue, setEmailValue] = useState("");
    const [passwordValue, setPasswordValue] = useState("");

    // Trigger slide-in animation after mount
    useEffect(() => {
      const t = requestAnimationFrame(() => setAnimateForm(true));
      return () => cancelAnimationFrame(t);
    }, []);
    // Helper to check JWT expiration (exp in seconds)
    const isTokenValid = (token) => {
      try {
        const parts = String(token).split('.');
        if (parts.length !== 3) return false;
        const base64Url = parts[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const json = atob(base64);
        const payload = JSON.parse(json);
        if (!payload || typeof payload.exp !== 'number') return false;
        return payload.exp * 1000 > Date.now();
      } catch {
        return false;
      }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
          if (isTokenValid(token)) {
            navigate('/', { replace: true });
            return;
          }
          // Clear stale token if expired/invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        // Load remembered credentials if present
        const rem = localStorage.getItem('rememberMe') === 'true';
        const remEmail = localStorage.getItem('rememberEmail') || '';
        const remPass = localStorage.getItem('rememberPassword') || '';
        if (rem) {
          setRememberMe(true);
          setEmailValue(remEmail);
          setPasswordValue(remPass);
        }
      }, [navigate]);
    const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const email = emailValue.trim();
    const password = passwordValue.trim();
    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Đăng nhập thất bại");
        
      }
      // Lưu token & user
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Nếu chọn ghi nhớ đăng nhập, lưu email & mật khẩu để tự điền lại lần sau
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('rememberEmail', email);
        localStorage.setItem('rememberPassword', password);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('rememberEmail');
        localStorage.removeItem('rememberPassword');
      }
      // Điều hướng về trang chủ
      setShowAlert(false);
      window.location.href = "/";

    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
      setShowAlert(true);
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
                <Snackbar
                    open={showAlert}
                    onClose={(_, reason) => {
                      if (reason === 'clickaway') return;
                      setShowAlert(false);
                    }}
                    autoHideDuration={1000}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    TransitionComponent={SlideFromTop}
                    sx={{ mt: 2 }}
                  >
                    <Alert
                      severity="error"
                      variant="filled"
                      
                      sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 1.5,
                        boxShadow: 2,
                        width: '420px', // tăng chiều rộng alert
                        backgroundColor: '#facc15', // vàng tươi (giống Tailwind yellow-400),
                        color: '#78350f', // chữ nâu đậm cho dễ đọc,
                        '& .MuiAlert-icon': { mr: 1 },
                        '& .MuiAlert-message': { fontSize: '0.95rem', fontWeight: 500 },
                      }}
                    >
                      {error}
                    </Alert>
                  </Snackbar>
      <div className={`wrapper auth-animate ${animateForm ? 'in-view' : ''}`}>
        <div className="form-box login">
          <h2>{t('auth.login.title', 'Đăng nhập')}</h2>
              <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
                <Grid container spacing={3} direction="column">
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="email"
                      label={t('auth.login.email', 'Email')}
                      type="email"
                      required
                      variant="outlined"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IonIcon icon={mail} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sx={{ mt: 3.5 }}>
                    <TextField
                      fullWidth
                      name="password"
                      label={t('auth.login.password', 'Mật khẩu')}
                      type="password"
                      required
                      variant="outlined"
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IonIcon icon={lockClosed} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} >
                    <div className="remember-forgot">
                      <FormControlLabel
                        control={<Checkbox color="success" size="small" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
                        label={t('auth.login.remember', 'Ghi nhớ đăng nhập')}
                      />
                      <a href="/forget-password">{t('auth.login.forgot', 'Quên mật khẩu?')}</a>
                    </div>
                  </Grid>
                  <Grid item xs={12}>
                    <Button type="submit" variant="contained" fullWidth className="btn">
                      {t('auth.login.submit', 'Đăng nhập')}
                    </Button>
                  </Grid>
                  <Grid item xs={12}>
                    <div className="login-register">
                      <p>
                        {t('auth.login.noAccount', 'Chưa có tài khoản?')} <Link to="/register" className="register-link" >{t('auth.login.register', 'Đăng ký')}</Link>
                      </p>
                    </div>
                    <div id="noti" style={{ color: "red", marginTop: "6px", minHeight: "18px" }}></div>
                  </Grid>
                  
                </Grid>
              </Box>
        </div>
      </div>
    </div>
  );
};

export default Login;
