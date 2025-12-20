import React, { useState, useEffect } from "react";
import "./Login.css";
import { IonIcon } from "@ionic/react";
import { mail, lockClosed, person, call } from "ionicons/icons";
import { Link, useNavigate } from "react-router-dom";
import { Button, Checkbox, FormControlLabel, TextField, InputAdornment, Box, Grid, Alert, Slide, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from "@mui/material";
import { useTranslation } from 'react-i18next';
function SlideFromTop(props) {
  // Always slide in from the top ('down'); on exit, MUI slides in the opposite direction -> up
  return <Slide {...props} direction="down" timeout={600} />;
}
const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Local state for future integration with API (optional enhancement)
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    phone: "",
    email: "",
    password: "",
    agree: false,
  });
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  // Chỉ hiển thị placeholder số điện thoại khi focus
  const [phonePlaceholder, setPhonePlaceholder] = useState("");
  const [animateForm, setAnimateForm] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // Auto show alert when error changes; hide handled by Snackbar autoHideDuration
  useEffect(() => {
    if (error) {
      setShowAlert(true);
    }
  }, [error]);

  // Trigger slide-up animation after mount
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
  }, [navigate]);
  const handleSubmit = async(e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const {full_name, phone, email, password, agree } = form;
    if (!agree) {
      setError("Bạn phải đồng ý với điều khoản & điều kiện");
      setShowAlert(true);
      setLoading(false);
      return;
    }
    // simple validation: password length at least 6
    if (!form.password || String(form.password).length < 6) {
      setPasswordError('Mật khẩu phải có ít nhất 6 kí tự');
      setLoading(false);
      return;
    }
    setPasswordError('');
    try {
        const res = await fetch("http://localhost:4000/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, full_name, phone })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Đăng ký thất bại");
        }
        // Đặt cờ đã đăng ký thành công (sessionStorage) để bảo vệ route
        sessionStorage.setItem('registeredSuccess', 'true');
        // Điều hướng tới trang thông báo thành công kèm state để tăng độ tin cậy
        navigate('/register-success', { state: { fromRegister: true } });
    }
  catch (err) {
    setError(err.message || "Có lỗi xảy ra");
    setShowAlert(true);
        const noti = document.getElementById("noti");
        if (noti) noti.textContent = err.message || "Có lỗi xảy ra";
    }
    finally {
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
        <div className="form-box register">
          <h2>{t('auth.register.title', 'Đăng ký')}</h2>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={3} direction="column">
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="full_name"
                  label={t('auth.register.fullName', 'Họ và Tên')}
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IonIcon icon={person} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="phone"
                  label={t('auth.register.phone', 'Số điện thoại')}
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  inputProps={{ pattern: "^[0-9]{9,12}$" }}
                  placeholder={phonePlaceholder}
                  onFocus={() => setPhonePlaceholder(t('auth.register.phoneExample', 'VD: 0912345678'))}
                  onBlur={() => setPhonePlaceholder("")}
                  required
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IonIcon icon={call} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="email"
                  label={t('auth.register.email', 'Email')}
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IonIcon icon={mail} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="password"
                  label={t('auth.register.password', 'Mật khẩu')}
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IonIcon icon={lockClosed} />
                      </InputAdornment>
                    ),
                  }}
                   error={Boolean(passwordError)}
                   helperText={passwordError || ''}
                />
              </Grid>

              <Grid item xs={12}>
                <div className="remember-forgot">
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="success"
                        size="small"
                        name="agree"
                        checked={form.agree}
                        onChange={handleChange}
                      />
                    }
                    label={
                      <span>
                        {t('auth.register.agreePrefix', 'Tôi đồng ý với')} <span style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setTermsOpen(true)}>{t('auth.register.terms', 'điều khoản & điều kiện')}</span>
                      </span>
                    }
                  />
                </div>
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" fullWidth className="btn">
                  {t('auth.register.submit', 'Đăng ký')}
                </Button>
              </Grid>
              <Grid item xs={12} >
                <div className="login-register">
                  <p>
                    {t('auth.register.hasAccount', 'Đã có tài khoản?')} <Link to="/login" className="login-link">{t('auth.register.login', 'Đăng nhập')}</Link>
                  </p>
                </div>
              </Grid>
              {/* Snackbar top-center alert */}
            </Grid>
          </Box>
          
        </div>
      </div>
      <Dialog open={termsOpen} onClose={() => setTermsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('auth.register.termsTitle', 'Các điều khoản & điều kiện')}</DialogTitle>
        <DialogContent dividers>
          <Typography component="div" sx={{ whiteSpace: 'pre-line' }}>
  {`Các điều khoản và điều kiện người dùng phải chấp nhận:
  1. Phải đồng ý rằng giao diện VolunteerHub rất đẹp
  2. Phải đồng ý rằng web VolunteerHub rất dễ dùng
  
  3. Phải đồng ý rằng web này xứng đáng được 10 điểm bài tập lớn
  4. J4F`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTermsOpen(false)} variant="contained">{t('common.close', 'Đóng')}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Register;
