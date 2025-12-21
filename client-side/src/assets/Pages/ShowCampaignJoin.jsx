import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Snackbar, Alert, Fade, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './ShowCampaignJoin.css';
import { isTokenExpired, clearAuth } from '../utils/auth';
import { useTranslation } from 'react-i18next';

function statusLabel(status, t) {
  switch (status) {
    case 'approved':
      return { text: t('join.status.approved', 'Đã tham gia'), color: 'success', variant: 'filled', icon: <CheckCircleIcon fontSize="small" /> };
    case 'pending':
      return { text: t('join.status.pending', 'Đang chờ duyệt'), color: 'warning', variant: 'filled' };
    case 'rejected':
      return { text: t('join.status.rejected', 'Bị từ chối'), color: 'error', variant: 'filled' };
    case 'completed':
      return { text: t('join.status.completed', 'Hoàn thành'), color: 'success', variant: 'contained', icon: <DoneAllIcon fontSize="small" /> };
    case 'Absent':
      return { text: t('join.status.absent', 'Vắng mặt'), color: 'error', variant: 'outlined' };
    default:
      return { text: status || t('join.status.unknown', 'Không xác định'), color: 'default', variant: 'outlined' };
  }
}

const ShowCampaignJoin = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('warning');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState('');
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
    if (isTokenExpired(token)) {
      clearAuth();
      navigate('/login', { replace: true });
      return;
    }
    // Role guard: only VOLUNTEER can access this page
    try {
      const user = JSON.parse(userStr);
      const roles = String(user?.roles?.[0]?.role?.name || '');
      const isVolunteer = roles.includes('VOLUNTEER');
      if (!isVolunteer) { navigate('/', { replace: true }); return; }
    } catch {
      navigate('/', { replace: true });
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
        if (!res.ok) throw new Error(t('join.fetchError', 'Không lấy được danh sách tham gia'));
        return res.json();
      })
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const filtered = arr.filter(r => String(r.status || '').toLowerCase() !== 'cancelled');
        setRegistrations(filtered);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [navigate, location.key]);

  // Derived list by status filter
  const normalized = (s) => String(s || '').toLowerCase();
  const statusFilterLabel = (val) => {
    switch (val) {
      case 'pending': return t('join.status.pending', 'Đang chờ duyệt');
      case 'approved': return t('join.status.approved', 'Đã tham gia');
      case 'rejected': return t('join.status.rejected', 'Bị từ chối');
      case 'completed': return t('join.status.completed', 'Hoàn thành');
      case 'absent': return t('join.status.absent', 'Vắng mặt');
      default: return t('common.all', 'Tất cả');
    }
  };
  const filteredRegs = registrations.filter((r) => {
    if (!statusFilter) return true;
    const st = normalized(r.status);
    switch (statusFilter) {
      case 'pending': return st === 'pending';
      case 'approved': return st === 'approved';
      case 'rejected': return st === 'rejected';
      case 'completed': return st === 'completed';
      case 'absent': return st === 'absent' || st === 'absent';
      default: return true;
    }
  });

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [statusFilter]);

  const cancelRegistration = async (eventId) => {
    const token = localStorage.getItem('token');
    if (!token || !eventId) return;
    try {
      setCanceling(true);
      const cancelReq = fetch(`http://localhost:4000/registrations/${eventId}/register`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const delay = new Promise((resolve) => setTimeout(resolve, 2000));
      const [res] = await Promise.all([cancelReq, delay]);
      if (!res.ok) {
        let msg = t('join.cancelFailed', 'Hủy thất bại');
        try {
          const errBody = await res.json();
          msg = errBody?.error || msg;
        } catch {}
        setSnackbarMsg(msg);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      // Refresh registrations list and exclude cancelled
      const resList = await fetch('http://localhost:4000/registrations/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resList.ok) {
        const data = await resList.json();
        const arr = Array.isArray(data) ? data : [];
        const filtered = arr.filter(r => String(r.status || '').toLowerCase() !== 'cancelled');
        setRegistrations(filtered);
      } else {
        // Fallback: remove locally
        setRegistrations(list => list.filter(r => r.event_id !== eventId));
      }
      setConfirmOpen(false);
      setConfirmTarget(null);
      setSnackbarMsg(t('join.cancelSuccess', 'Hủy đăng ký thành công'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (e) {
      setSnackbarMsg(t('join.cancelError', 'Lỗi khi hủy đăng ký'));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setCanceling(false);
    }
  };

  const openCancelConfirm = (eventId) => {
    setConfirmTarget(eventId);
    setConfirmOpen(true);
  };

  const closeCancelConfirm = () => {
    if (canceling) return;
    setConfirmOpen(false);
    setConfirmTarget(null);
  };

  return (
    <Box className={"campaign-join-page py-16 font-qs"} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minHeight: 'calc(100vh - 66px)' }}>
      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={(_, reason) => { if (reason === 'clickaway') return; setSnackbarOpen(false); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={Fade}
        transitionDuration={{ enter: 250, exit: 200 }}
        sx={{ top: 4 }}
      >
        <Alert severity={snackbarSeverity} variant="filled" sx={{ px: 2, py: 1, borderRadius: 1.5, boxShadow: 2 }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
      <div
        data-aos="fade-left"
        data-aos-anchor-placement="top-bottom"
        data-aos-easing="linear"
        data-aos-duration="1500"
        className="container mx-auto mb-6"
      >
        <h2 className="text-2xl md:text-5xl font-bold text-center ">
          {t('join.title', 'Các chiến dịch bạn đã đăng ký')}
        </h2>
        <p className="w-2/3 mx-auto md:text-lg mt-4 text-center leading-relaxed ">
          {t('join.subtitle', 'Các chiến dịch bạn đã đăng ký sẽ được hiển thị ở đây. Bạn có thể xem trạng thái tham gia của mình và hủy đăng ký nếu cần.')}
        </p>
      </div>
      
      <div className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
        {/* Filter row: left status filter, right total */}
        <Box sx={{ px: { xs: 1.5, sm: 2 }, mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 220, ml: { xs: 2, sm: 15 } }}>
            <InputLabel id="status-filter-label" shrink>
              {t('join.filterByStatus', 'Lọc theo trạng thái')}
            </InputLabel>
            <Select
              labelId="status-filter-label"
              label={t('join.filterByStatus', 'Lọc theo trạng thái')}
              value={statusFilter}
              displayEmpty
              renderValue={(value) => statusFilterLabel(value)}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">{t('common.all', 'Tất cả')}</MenuItem>
              <MenuItem value="pending">{t('join.status.pending', 'Đang chờ duyệt')}</MenuItem>
              <MenuItem value="approved">{t('join.status.approved', 'Đã tham gia')}</MenuItem>
              <MenuItem value="completed">{t('join.status.completed', 'Hoàn thành')}</MenuItem>
              <MenuItem value="absent">{t('join.status.absent', 'Vắng mặt')}</MenuItem>
              <MenuItem value="rejected">{t('join.status.rejected', 'Bị từ chối')}</MenuItem>
            </Select>
          </FormControl>
          <Typography sx={{ fontWeight: 600, mr: { xs: 2, sm: 15 } }}>
            {t('common.total', 'Tổng')}: {filteredRegs.length} {t('join.campaigns', 'chiến dịch')}
          </Typography>
        </Box>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {loading ? (
          <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={22} />
            <Typography>{t('common.loading', 'Đang tải...')}</Typography>
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : registrations.length === 0 ? (
          <div className="container mx-auto mt-6">
            <div className="hidden md:block p-2">
              <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                <table className="min-w-full border-collapse bg-white">
                  <thead>
                    <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                      <th className="px-4 py-3 text-left rounded-tl-xl">#</th>
                      <th className="px-4 py-3 text-left">{t('join.headers.event', 'Sự kiện')}</th>
                      <th className="px-4 py-3 text-left">{t('join.headers.status', 'Trạng thái')}</th>
                      <th className="px-4 py-3 text-left">{t('join.headers.time', 'Thời gian')}</th>
                      <th className="px-4 py-3 text-left">{t('join.headers.location', 'Địa điểm')}</th>
                      <th className="px-4 py-3 text-center rounded-tr-xl">{t('join.headers.actions', 'Thao tác')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-600">{t('join.noEvents', 'Chưa có sự kiện nào.')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Mobile compact table */}
            <div className="md:hidden">
              <div className="overflow-x-auto">
                <table className="table border-collapse border border-gray-400">
                  <thead>
                    <tr className="text-white raleway text-base bg-[#DE00DF]">
                      <th>{t('join.headers.event', 'Sự kiện')}</th>
                      <th>{t('join.headers.time', 'Thời gian')}</th>
                      <th>{t('join.headers.details', 'Chi tiết')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center">{t('join.noEvents', 'Chưa có sự kiện nào.')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="container mx-auto mt-6">
            {filteredRegs.length === 0 ? (
              <div className="container mx-auto mt-6">
                <div className="hidden md:block p-2">
                  <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                    <table className="min-w-full border-collapse bg-white">
                      <thead>
                        <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                          <th className="px-4 py-3 text-left rounded-tl-xl">#</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.event', 'Sự kiện')}</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.status', 'Trạng thái')}</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.time', 'Thời gian')}</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.location', 'Địa điểm')}</th>
                          <th className="px-4 py-3 text-center rounded-tr-xl">{t('join.headers.actions', 'Thao tác')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-600">{t('join.emptyForStatus', 'Không có sự kiện nào mà bạn')} {statusFilterLabel(statusFilter)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Mobile compact table */}
                <div className="md:hidden">
                  <div className="overflow-x-auto">
                    <table className="table border-collapse border border-gray-400">
                      <thead>
                        <tr className="text-white raleway text-base bg-[#DE00DF]">
                          <th>{t('join.headers.event', 'Sự kiện')}</th>
                          <th>{t('join.headers.time', 'Thời gian')}</th>
                          <th>{t('join.headers.details', 'Chi tiết')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-center">{t('join.emptyForStatus', 'Không có sự kiện nào mà bạn')} {statusFilterLabel(statusFilter)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden md:block p-2">
                  <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                    <table className="min-w-full border-collapse bg-white">
                      <thead>
                        <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                          <th className="px-4 py-3 text-left rounded-tl-xl">#</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.event', 'Sự kiện')}</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.status', 'Trạng thái')}</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.time', 'Thời gian')}</th>
                          <th className="px-4 py-3 text-left">{t('join.headers.location', 'Địa điểm')}</th>
                          <th className="px-4 py-3 text-center rounded-tr-xl">{t('join.headers.actions', 'Thao tác')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRegs
                          .slice(page * pageSize, page * pageSize + pageSize)
                          .map((reg, i) => {
                            const st = statusLabel(reg.status, t);
                            const title = reg.event?.title || reg.event?.name || `Sự kiện #${reg.event_id}`;
                            const locationName = reg.event?.location?.name || '';
                            return (
                              <tr key={`${reg.event_id}-${reg.id || reg.status}`} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                                <td className="px-4 py-3 font-medium text-gray-700 text-left">
                                  {page * pageSize + i + 1}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-800 text-left">
                                  {title}
                                </td>
                                <td className="px-4 py-3 text-gray-700 text-left">
                                  {st.text}
                                </td>
                                <td className="px-4 py-3 text-gray-700 text-left">
                                  {reg.event?.start_time ? fmtStartTime(reg.event.start_time) : ''}
                                </td>
                                <td className="px-4 py-3 text-gray-700 text-left">
                                  {locationName}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <Link to={`/events/${reg.event_id}`}>
                                      <button
                                        type="button"
                                        sx = {{width: '100%'}}
                                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:bg-green-800 transition"
                                      >
                                        {t('common.viewDetails', 'Xem chi tiết')}
                                      </button>
                                    </Link>
                                    {(String(reg.status || '').toLowerCase() === 'pending' || (new Date(reg.event.start_time) > new Date() && reg.status !== "rejected")) && (
                                      <button
                                        type="button"
                                        onClick={() => openCancelConfirm(reg.event_id)}
                                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 active:bg-red-800 transition"
                                      >
                                        {t('join.buttons.cancel', 'Hủy đăng ký')}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Small (mobile) */}
                <div className="md:hidden">
                  <div className="overflow-x-auto">
                    <table className="table border-collapse border border-gray-400">
                      <thead>
                        <tr className="text-white raleway text-base bg-[#DE00DF]">
                          <th>{t('join.headers.event', 'Sự kiện')}</th>
                          <th>{t('join.headers.time', 'Thời gian')}</th>
                          <th>{t('join.headers.details', 'Chi tiết')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRegs
                          .slice(page * pageSize, page * pageSize + pageSize)
                          .map((reg) => {
                            const title = reg.event?.title || reg.event?.name || `Sự kiện #${reg.event_id}`;
                            return (
                              <tr className="border border-gray-300" key={`${reg.event_id}-${reg.id || reg.status}-m`}>
                                <td>{title}</td>
                                <td>{reg.event?.start_time ? fmtStartTime(reg.event.start_time) : ''}</td>
                                <td>
                                  <Link to={`/events/${reg.event_id}`}>
                                    <button
                                      type="button"
                                      className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:bg-green-800"
                                    >
                                      {t('common.viewDetails', 'Xem chi tiết')}
                                    </button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </Box>
        {/* Bottom pagination controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5 }}>
          <IconButton
            size="small"
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            aria-label={t('common.prevPage', 'Trang trước')}
          >
            <KeyboardArrowLeftIcon />
          </IconButton>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1 }}>
            <Typography sx={{ fontSize: { xs: '.85rem', sm: '.9rem' } }}>
              {t('common.page', 'Trang')} {page + 1} / {Math.max(1, Math.ceil(filteredRegs.length / pageSize))}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setPage((p) => (p + 1 < Math.ceil(filteredRegs.length / pageSize) ? p + 1 : p))}
            disabled={page + 1 >= Math.ceil(filteredRegs.length / pageSize)}
            aria-label={t('common.nextPage', 'Trang sau')}
          >
            <KeyboardArrowRightIcon />
          </IconButton>
        </Box>
      </div>
      {/* Confirm cancel dialog */}
      <Dialog open={confirmOpen} onClose={closeCancelConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>{t('join.dialog.title', 'Hủy đăng ký')}</DialogTitle>
        <DialogContent>
          <Typography>{t('join.dialog.desc', 'Bạn có chắc chắn muốn hủy đăng ký không?')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCancelConfirm} disabled={canceling}>{t('common.cancel', 'Hủy')}</Button>
          <Button onClick={() => cancelRegistration(confirmTarget)} color="error" variant="contained" disabled={canceling}>
            {canceling ? <CircularProgress size={18} color="inherit" /> : t('join.dialog.confirm', 'Xác nhận')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShowCampaignJoin;