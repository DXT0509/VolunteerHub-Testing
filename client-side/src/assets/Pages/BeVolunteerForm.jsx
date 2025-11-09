import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, TextField, Typography, Button, Grid, Divider, CircularProgress } from '@mui/material';
import { useParams } from 'react-router-dom';
import './BeVolunteerForm.css';
import { useNavigate } from 'react-router-dom';
/**
 * BeVolunteerForm
 * A registration form for users to apply as volunteers for an event.
 * Fields: eventName, userName, email, phone, note
 */
const BeVolunteerForm = () => {
  const [form, setForm] = useState({
    eventName: '',
    userName: '',
    email: '',
    phone: '',
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  // Guard: must be logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      navigate('/login', { replace: true });
    } else {
      setAllowed(true);
    }
  }, [navigate]);
  useEffect(() => {
    
    if (!id) {
      setLoadingEvent(false);
      return;
    }
    setLoadingEvent(true);
    const userData = JSON.parse(localStorage.getItem('user') || '{}');

    setForm(prev => ({ ...prev, userName: userData.full_name || '' , email: userData.email || '' , phone: userData.phone || '' }));
    fetch(`http://localhost:4000/events/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Không lấy được dữ liệu sự kiện');
        return res.json();
      })
      .then(data => {
        setForm(prev => ({ ...prev, eventName: data.title || data.name || 'Không xác định' }));
        setLoadError(null);
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoadingEvent(false));
    
      
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const headerRef = useRef(null);
  const formRef = useRef(null);
  const cardRef = useRef(null);

  const validate = () => {
    const newErrors = {};
  // eventName được auto-fill và khóa chỉnh sửa, không cần validate bắt buộc
    if (!form.userName.trim()) newErrors.userName = 'Vui lòng nhập tên người dùng';
    if (!form.email.trim()) newErrors.email = 'Vui lòng nhập email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Email không hợp lệ';
    if (!form.phone.trim()) newErrors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^\+?[0-9]{7,15}$/.test(form.phone)) newErrors.phone = 'Số điện thoại không hợp lệ';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length === 0) {
      setSubmitted(true);
      // In real app: send to API
      console.log('Volunteer Registration:', form);
    }
  };

  useEffect(() => {
  const targets = [cardRef.current, headerRef.current, formRef.current].filter(Boolean);
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    targets.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <Box className="bvf-root">
      <Paper ref={cardRef} elevation={6} className="bvf-paper bvf-animate">
        <Box ref={headerRef} className="bvf-header bvf-animate">
          <Typography variant="h5" className="bvf-title">Đăng ký Làm Tình Nguyện Viên</Typography>
          <Typography variant="body2" className="bvf-subtitle">
            Điền thông tin bên dưới để tham gia hỗ trợ sự kiện.
          </Typography>
        </Box>
        <Box ref={formRef} component="form" onSubmit={handleSubmit} className="bvf-form bvf-animate">
          <Grid container spacing={3} direction="column">
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tên sự kiện"
                name="eventName"
                value={form.eventName}
                InputProps={{ readOnly: true }}
                helperText={loadingEvent ? 'Đang tải...' : (loadError ? loadError : 'Tự động điền từ sự kiện')}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tên người dùng"
                name="userName"
                value={form.userName}
                onChange={handleChange}
                error={!!errors.userName}
                InputProps={{ readOnly: true }}
                helperText={'Tự động điền từ tài khoản'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={!!errors.email}
                InputProps={{ readOnly: true }}
                helperText={'Tự động điền từ tài khoản'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Số điện thoại"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                error={!!errors.phone}
                InputProps={{ readOnly: true }}
                helperText={'Tự động điền từ tài khoản'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Ghi chú"
                name="note"
                value={form.note}
                onChange={handleChange}
                multiline
                minRows={3}
                placeholder="Thông tin thêm (tuỳ chọn)"
              />
            </Grid>
            <Grid item xs={12}>
              <Divider className="bvf-divider" />
              <Box className="bvf-actions">
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loadingEvent || !!loadError}
                  className="bvf-submit-btn"
                >
                  {loadingEvent ? (
                    <Box className="bvf-loading">
                      <CircularProgress size={20} color="inherit" />
                      <span>Đang tải sự kiện...</span>
                    </Box>
                  ) : 'Gửi đăng ký'}
                </Button>
              </Box>
              {submitted && (
                <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
                  Đã gửi đăng ký! Chúng tôi sẽ liên hệ sớm.
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default BeVolunteerForm;
