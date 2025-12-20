import React, { useRef } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar, Alert, Slide, CircularProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import './ShowCampaignDetail.css';
import { isTokenExpired, clearAuth } from '../utils/auth';
import { useTranslation } from 'react-i18next';
/**
 * ShowCampaignDetail
 * Props: { title, category, location, deadline, capacity, manager_name, manager_mail, banner_url }
 * Layout: left large banner image, right column with nicely formatted information.
 */
const SlideFromTop = React.forwardRef(function SlideFromTop(props, ref) {
  return <Slide ref={ref} {...props} direction="down" timeout={{ enter: 400, exit: 350 }} />;
});

function ShowCampaignDetail() {
  const { t } = useTranslation();
  const fmtDeadline = (d) => {
    if (!d) return t('event.noDeadline', 'Không có thời hạn');
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const weekday = dt.toLocaleDateString('vi-VN', { weekday: 'long' });
    const hour = dt.getHours(); // 0-23
    const dateStr = dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${hour} giờ, ${dateStr}`;
  };
  const fmtStartTime = (d) => {
    if (!d) return t('event.noStart', 'Không có thời gian bắt đầu');
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const weekday = dt.toLocaleDateString('vi-VN', { weekday: 'long' });
    const hour = dt.getHours();
    const dateStr = dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${hour} giờ, ${dateStr}`;
  };
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [userRegistrations, setUserRegistrations] = useState([]); 
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [warnSeverity, setWarnSeverity] = useState('error'); // 'error' | 'success'
  const [showWarn, setShowWarn] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Refs for animation targets (declare before any early return)
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  // Guard: only allow when logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) {
      navigate('/login', { replace: true });
    } else {
      if (isTokenExpired(token)) {
        clearAuth();
        navigate('/login', { replace: true });
        return;
      }
      setAllowed(true);
      
    }
  }, [navigate]);

  // Load event details when allowed
  useEffect(() => {
    if (!allowed) return;
   
    fetch(`http://localhost:4000/events/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Không tải được chi tiết sự kiện');
        return res.json();
      })
      .then(data => {
        // Redirect to home if event does not exist or not approved/active
        if (!data || String(data.status || '').toLowerCase() !== 'active') {
          navigate('/', { replace: true });
          return;
        }
        setEvent(data);
      })
      .catch(err => {
        console.error(err);
        navigate('/', { replace: true });
      });
  }, [id, allowed]);

  // Load user's registrations when allowed
  useEffect(() => {
    if (!allowed) return;
    fetch(`http://localhost:4000/registrations/my`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => setUserRegistrations(data))
      .catch(err => console.error(err));
  }, [allowed]);

  function getRegistrationStatus(eventId) {
    const registration = userRegistrations.find(reg => reg.event_id === eventId);
    return registration ? registration.status : 'not_registered';
  }

  async function handleCancel(eventId) {
    try {
      const resCancel = await fetch(`http://localhost:4000/registrations/${eventId}/register`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      // If server rejects (e.g., event already occurred), show its error message
      if (!resCancel.ok) {
        try {
          const errBody = await resCancel.json();
          setWarnMsg(errBody?.error || 'Hủy thất bại');
        } catch (e) {
          setWarnMsg('Hủy thất bại');
        }
        setWarnSeverity('error');
        setShowWarn(true);
        return;
      }

      // Refresh registrations list after successful cancellation
      const res = await fetch(`http://localhost:4000/registrations/my`,{
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setUserRegistrations(data);
      // show success alert
      setWarnMsg('Hủy đăng ký thành công');
      setWarnSeverity('success');
      setShowWarn(true);
    } catch (e) {
      console.error('Cancel failed', e);
      setWarnMsg('Lỗi khi hủy đăng ký');
      setWarnSeverity('error');
      setShowWarn(true);
    }
  }

  const openConfirm = () => setConfirmOpen(true);
  const closeConfirm = () => setConfirmOpen(false);
  const confirmCancel = async () => {
    setCancelling(true);
    // show loading for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    closeConfirm();
    await handleCancel(event.id);
    setCancelling(false);
  };


  const bannerFallback = (
    <div className="scd-fallback">
      <span>{t('event.noImage', 'Không có ảnh')}</span>
    </div>
  );
  // use the top-level forwardRef SlideFromTop for Snackbar transitions
  

  useEffect(() => {
    const targets = [leftRef.current, rightRef.current].filter(Boolean);
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
      { threshold: 0.15 }
    );
    targets.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [event]);

  if (!allowed) return null;
  if (!event) {
    return <div>{t('common.loading', 'Đang tải...')}</div>;
  }

  return (
    <div className="scd-container">
      {/* Top-center alert like Register.jsx */}
      <Snackbar
        open={showWarn}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setShowWarn(false);
        }}
        autoHideDuration={1000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideFromTop}
        sx={{ mt: 2 }}
      >
        <Alert
          severity={warnSeverity}
          variant="filled"
          sx={{
            px: 2,
            py: 1,
            borderRadius: 1.5,
            boxShadow: 2,
            width: '420px',
            backgroundColor: warnSeverity === 'success' ? '#16a34a' : '#facc15',
            color: warnSeverity === 'success' ? '#ffffff' : '#78350f',
            '& .MuiAlert-icon': { mr: 1 },
            '& .MuiAlert-message': { fontSize: '0.95rem', fontWeight: 500 },
          }}
        >
          {warnMsg}
        </Alert>
      </Snackbar>
      <title>{t('event.detailsTitle', 'Chi tiết sự kiện')}</title>
      <div ref={leftRef} className="scd-left scd-animate">
        {event.banner_url ? (
          <img src={event.banner_url} alt={event.title} className="scd-img" />
        ) : (
          bannerFallback
        )}
      </div>
      <div ref={rightRef} className="scd-right scd-animate">
        <div>
         <h1 className="scd-title text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {event.title}
        </h1>

        <div className="scd-category mb-3">
          <h4 className="text-base md:text-lg text-gray-700">
            {t('event.categoryLabel', 'Thể loại')}:{" "}
            <strong>
              {event.category?.name}
            </strong>
          </h4>
        </div>

        <div className="scd-desc mb-4">
          <span className="text-gray-700 leading-relaxed block">
            {event.description}
          </span>
        </div>

        <h5 className="scd-location text-base md:text-lg text-gray-800 mb-1">
          {t('event.locationLabel', 'Địa điểm')}:{" "}
          <span>
            <strong>
              {event.location?.name}
            </strong>
          </span>
        </h5>

        <span className="scd-location block text-sm md:text-base text-gray-600 mb-4">
          {event.location?.address_line}, {event.location?.district},{" "}
          {event.location?.province}, {event.location?.country}
        </span>

        <div className="scd-start-time mt-4 flex items-center gap-2">
          <span className="text-gray-900 font-semibold">
            {t('event.arrive', 'Có mặt')}
          </span>
          <span className="scd-start-time-box px-3 py-1 rounded bg-blue-100 text-blue-700 font-medium">
            {fmtStartTime(event.start_time)}
          </span>
        </div>

          <div className="scd-details">
            {/* Two-column grid: col 1 = Deadline & Contact, col 2 = Capacity & Manager */}
            <div className="scd-grid">
              {/* Row 1 */}
              <div>
                <div style={{ color: '#000', fontWeight: 600 }}>{t('event.leave', 'Ra về')}:</div>
                <div className="scd-start-time-box">{fmtDeadline(event.end_time)}</div>
              </div>
              <div>
                <div className="scd-label">{t('event.missingVolunteers', 'Số TNV còn thiếu')}</div>
                <div className="scd-capacity-row">
                  <div className="scd-badge" title="Total volunteers">
                    {typeof event.capacity === 'number' ? event.capacity : (event.capacity || '—')}
                  </div>
                  {t('event.volunteersLabel', 'tình nguyện viên')}
                </div>
              </div>

              {/* Row 2 */}
              <div>
                <div className="scd-label">{t('event.managerLabel', 'Người quản lý')}</div>
                <div className="scd-value">{event.manager?.full_name ?? '—'}</div>
              </div>
              <div>
                <div className="scd-label">{t('event.contactLabel', 'Liên hệ')}</div>
                {event.manager?.email ? (
                  <a href={`mailto:${event.manager.email}`} className="scd-link">{event.manager.email}</a>
                ) : (
                  <div className="scd-value">—</div>
                )}
              </div>
              
            </div>
          </div>
        </div>
        <div className="scd-actions">
          {(() => {
            // If viewer is event manager or admin, show status button instead of join
            let currentUserId = null;
            try {
              const u = localStorage.getItem('user');
              const parsed = u ? JSON.parse(u) : null;
              
              
               
              const roleStr = String(parsed.roles[0].role.name);
              
              var isPrivileged = roleStr === 'EVENT_MANAGER' || roleStr === 'ADMIN';
            } catch { currentUserId = null; }
            const now = new Date();
            const ended = event?.end_time ? (new Date(event.end_time).getTime() < now.getTime()) : false;
            if (isPrivileged) {
              return (
                <Button
                  className="scd-join-btn"
                  variant="contained"
                  sx={{
                    bgcolor: ended ? '#facc15' : '#16a34a',
                    color: ended ? '#78350f' : '#ffffff',
                    cursor: 'default',
                    textTransform: 'none',
                    '&:hover': { bgcolor: ended ? '#facc15' : '#16a34a' }
                  }}
                >
                  {ended ? t('event.ended', 'Sự kiện đã kết thúc') : t('event.ongoing', 'Sự kiện đang diễn ra')}
                </Button>
              );
            }

            const status = getRegistrationStatus(event.id);
            if (ended) {
              return (
                <Button
                  className="scd-join-btn"
                  variant="contained"
                  sx={{
                    bgcolor: '#facc15',
                    color: '#78350f',
                    cursor: 'default',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#facc15' }
                  }}
                >
                  {t('event.ended', 'Sự kiện đã kết thúc')}
                </Button>
              );
            }
            if (status === 'pending') {
              return (
                <Button
                  className="scd-join-btn"
                  variant="contained"
                  onClick={() => {setConfirmOpen(true);}}
                  sx={{
                    bgcolor: '#facc15',
                    color: '#78350f',
                    cursor: 'default',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#facc15' }
                  }}
                >
                  <WarningAmberIcon sx={{ mr: 1 }} /> {t('event.pending', 'Đang chờ duyệt đăng ký')}
                </Button>
              );
            }
            if (status === 'rejected') {
              return (
                <Button
                  className="scd-join-btn"
                  variant="contained"
                  sx={{
                    bgcolor: '#dc2626',
                    color: '#fff',
                    textTransform: 'none',
                    cursor: 'default',
                    '&:hover': { bgcolor: '#dc2626' }
                  }}
                >
                  <CancelIcon sx={{ mr: 1 }} /> {t('event.rejected', 'Bạn đã bị từ chối')}
                </Button>
              );
            }
            if (status === 'approved') {
              return (
                <Button
                  className="scd-join-btn"
                  variant="contained"
                  onClick={() => {setConfirmOpen(true);}}
                  sx={{
                    bgcolor: '#dc2626',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#b91c1c' }
                  }}
                >
                  <CancelIcon sx={{ mr: 1 }} /> {t('event.approvedCancel', 'Đã tham gia, hủy đăng ký')}
                </Button>
              );
            }
            return (
              <Button
                className="scd-join-btn"
                variant="contained"
                onClick={() => navigate(`/bevolunteer/${id}`)}
                sx={{ bgcolor: '#16a34a', textTransform: 'none', '&:hover': { bgcolor: '#15803d' } }}
              >
                {t('event.register', 'Đăng ký tham gia')}
              </Button>
            );
          })()}
          <Button
            style={{ marginLeft: '85px' }}
            variant="contained"
            onClick={() => {
              // Allow privileged roles to access even if not registered
              let isPrivileged = false;
              try {
                const u = localStorage.getItem('user');
                const parsed = u ? JSON.parse(u) : null;
                const roleStr = String(parsed?.roles?.[0]?.role?.name || '');
                isPrivileged = roleStr === 'EVENT_MANAGER' || roleStr === 'ADMIN';
              } catch {}
              const status = getRegistrationStatus(event.id);
              if (status !== 'approved' && !isPrivileged) {
                setWarnMsg(t('event.notJoined', 'Bạn chưa tham gia sự kiện'));
                setWarnSeverity('warning');
                setShowWarn(true);
                return;
              }
              navigate(`/exchange-channel/${id}`);
            }}
            sx={{
              ml: 2,
              bgcolor: '#8d919aff',
              textTransform: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': { bgcolor: '#767a7eff' }
            }}
          >
            <span style={{ fontWeight: 700 }}>→</span> {t('event.gotoExchange', 'Truy cập kênh trao đổi')}
          </Button>
        </div>
        {/* Confirm cancellation dialog */}
        <Dialog open={confirmOpen} onClose={closeConfirm}>
          <DialogTitle>{t('event.confirmCancelTitle', 'Xác nhận hủy đăng ký tham gia sự kiện')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('event.confirmCancelDesc', 'Bạn có chắc chắn muốn hủy đăng ký tham gia sự kiện này không?')}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirm} disabled={cancelling} variant="contained" sx={{ bgcolor: '#9ca3af', '&:hover': { bgcolor: '#6b7280' }, textTransform: 'none' }}>
              {t('common.cancel', 'Hủy')}
            </Button>
            <Button onClick={confirmCancel} disabled={cancelling} variant="contained" sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 1 }} autoFocus>
              {cancelling ? (
                <>
                  <CircularProgress size={18} color="inherit" />
                  <span>{t('event.cancelling', 'Đang hủy...')}</span>
                </>
              ) : t('common.confirm', 'Xác nhận')}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
}

export default ShowCampaignDetail;