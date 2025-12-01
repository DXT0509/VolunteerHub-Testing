import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Chip, Button, CircularProgress, List, ListItem, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNavigate, useLocation } from 'react-router-dom';
import './ShowCampaignJoin.css';

function statusLabel(status) {
  switch (status) {
    case 'approved':
      return { text: 'Đã tham gia', color: 'success', variant: 'filled', icon: <CheckCircleIcon fontSize="small" /> };
    case 'pending':
      return { text: 'Đang chờ duyệt', color: 'warning', variant: 'filled' };
    case 'rejected':
      return { text: 'Bị từ chối', color: 'error', variant: 'filled' };
    case 'completed':
      return { text: 'Hoàn thành', color: 'success', variant: 'outlined', icon: <DoneAllIcon fontSize="small" /> };
    case 'absent':
      return { text: 'Vắng mặt', color: 'error', variant: 'outlined' };
    default:
      return { text: status || 'Không xác định', color: 'default', variant: 'outlined' };
  }
}

const ShowCampaignJoin = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fmtStartTime = (d) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const weekday = dt.toLocaleDateString('vi-VN', { weekday: 'long' });
    const hour = dt.getHours();
    const dateStr = dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${hour} giờ, ${dateStr}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      navigate('/login', { replace: true });
      return;
    }
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 30);
    setLoading(true);
    fetch('http://localhost:4000/registrations/my', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Không lấy được danh sách tham gia');
        return res.json();
      })
      .then(data => {
        setRegistrations(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [navigate, location.key]);

  return (
    <Box className={`campaign-join-page`} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 66px)' }}>
      <Paper sx={{ p: 0, borderRadius: 2, maxWidth: 1200, width: '100%', mx: 'auto' }} className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
        <Typography
          variant="h4"
          sx={{
            backgroundColor: '#16a34a',
            color: '#ffffff',
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            m: 0
          }}
        >
          Sự kiện đã đăng ký
        </Typography>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {loading ? (
          <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={22} />
            <Typography>Đang tải...</Typography>
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : registrations.length === 0 ? (
          <Typography>Chưa có sự kiện nào.</Typography>
        ) : (
          <List>
            {registrations.map((reg) => {
              const st = statusLabel(reg.status);
              const title = reg.event?.title || reg.event?.name || `Sự kiện #${reg.event_id}`;
              const locationName = reg.event?.location?.name || '';
              return (
                <React.Fragment key={`${reg.event_id}-${reg.id || reg.status}`}>
                  <ListItem
                    className={`scj-item scj-${reg.status}`}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => navigate(`/events/${reg.event_id}`)}
                        sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
                      >
                        Xem chi tiết
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                          {reg.event?.banner_url ? (
                            <Box component="img" src={reg.event.banner_url} alt={title} sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                          ) : (
                            <Box sx={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontWeight: 700, border: '1px solid #e2e8f0' }} aria-label="no-thumbnail">
                              {String(title).trim().charAt(0).toUpperCase()}
                            </Box>
                          )}
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{title}</Typography>
                          <Chip size="small" label={st.text} color={st.color} variant={st.variant} icon={st.icon} sx={{ fontWeight: 500 }} />
                        </Box>
                      }
                      secondary={
                        locationName ? (
                          <Typography sx={{ color: '#475569', mt: 0.25, fontSize: '.84rem' }}>
                            Địa điểm: <strong>{locationName}</strong>
                            {reg.event?.start_time ? <span>{' — vào '}{fmtStartTime(reg.event.start_time)}</span> : null}
                          </Typography>
                        ) : undefined
                      }
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ShowCampaignJoin;