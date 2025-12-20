import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Snackbar, Alert, Fade, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired, clearAuth } from '../utils/auth';
import { useTranslation } from 'react-i18next';

function approvalLabel(status, t) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return t('managePending.status.approved', 'Đã chấp nhận');
  if (s === 'rejected') return t('managePending.status.rejected', 'Đã từ chối');
  return t('managePending.status.pending', 'Đang chờ duyệt');
}

const ManagePendingRegistration = () => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regs, setRegs] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const navigate = useNavigate();

  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [campaignFilter, setCampaignFilter] = useState('all'); // 'all' | 'mine' | eventId
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myCampaigns, setMyCampaigns] = useState([]);

  // Role guard: only allow EVENT_MANAGER to access
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      if (!token || !userStr) { navigate('/login', { replace: true }); return; }
      if (isTokenExpired(token)) { clearAuth(); navigate('/login', { replace: true }); return; }
      const user = JSON.parse(userStr);
      const roleName = String(user.roles?.[0]?.role?.name || '');
      setCurrentUserId(user?.id ?? user?.user_id ?? null);
      if (roleName !== 'EVENT_MANAGER') { navigate('/', { replace: true }); }
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Fetch all my campaigns so the filter can list campaigns even with no registrations
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) return;
    let uid = null;
    try { const u = JSON.parse(userStr); uid = u?.id ?? u?.user_id ?? null; } catch {}
    fetch('http://localhost:4000/events/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const mine = arr.filter((ev) => {
          const managerId = ev?.manager?.id ?? ev?.manager_id ?? null;
          const creatorId = ev?.creator_id ?? ev?.created_by ?? ev?.user_id ?? null;
          const status = ev?.status;
          return (uid && status === "active" && (String(managerId) === String(uid) || String(creatorId) === String(uid)));
        });
        setMyCampaigns(mine);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 30);
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login', { replace: true }); return () => clearTimeout(t); }
    setLoading(true);
    // Backend should return pending registrations for events managed by current EVENT_MANAGER
    fetch('http://localhost:4000/registrations/pending', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
      .then(res => { if (!res.ok) throw new Error(t('managePending.fetchError', 'Không lấy được danh sách đơn đăng ký')); return res.json(); })
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        // normalize shape: expect each item contains { id, status, event, user }
        setRegs(arr);
        setError('');
      })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [navigate]);

  const refresh = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('http://localhost:4000/registrations/pending', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setRegs(arr);
    } catch (e) {
      // ignore refresh errors silently to keep UI responsive
      console.warn('refresh registrations failed', e);
    }
  };

  // Build campaign list from registrations
  const campaigns = React.useMemo(() => {
    const map = new Map();
    (regs || []).forEach(r => {
      const ev = r.event || {};
      const id = ev.id ?? r.event_id;
      const title = ev.title || ev.name || (id != null ? `Sự kiện #${id}` : '—');
      if (id != null && !map.has(id)) {
        map.set(id, { id, title, created_at: ev.created_at || null, start_time: ev.start_time || null });
      }
    });
    return Array.from(map.values());
  }, [regs]);

  // Event IDs created by current user
  const myCampaignIds = React.useMemo(() => {
    if (!currentUserId) return new Set();
    const ids = new Set();
    (regs || []).forEach(r => {
      const ev = r.event || {};
      const creator = ev.created_by ?? ev.creator_id ?? ev.owner_id ?? ev.organizer_id ?? ev.manager_id ?? null;
      const id = ev.id ?? r.event_id;
      if (id != null && creator != null && String(creator) === String(currentUserId)) {
        ids.add(String(id));
      }
    });
    return ids;
  }, [regs, currentUserId]);

  const filteredRegs = React.useMemo(() => {
    if (campaignFilter === 'all') return regs;
    if (campaignFilter === 'mine') {
      if (!myCampaignIds.size) return [];
      return (regs || []).filter(r => {
        const ev = r.event || {};
        const id = ev.id ?? r.event_id;
        return myCampaignIds.has(String(id));
      });
    }
    const targetId = campaignFilter;
    if (targetId == null) return regs;
    return (regs || []).filter(r => {
      const ev = r.event || {};
      const id = ev.id ?? r.event_id;
      return String(id) === String(targetId);
    });
  }, [regs, campaignFilter, myCampaignIds]);

  const approveReg = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:4000/registrations/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('managePending.approveFailed', 'Chấp nhận đơn đăng ký thất bại'));
      }
      setSnackbarMsg(t('managePending.approveSuccess', 'Đã chấp nhận đơn đăng ký'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await refresh();
    } catch (e) {
      setSnackbarMsg(e.message || t('managePending.approveError', 'Có lỗi khi chấp nhận'));
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  const rejectReg = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:4000/registrations/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('managePending.rejectFailed', 'Từ chối đơn đăng ký thất bại'));
      }
      setSnackbarMsg(t('managePending.rejectSuccess', 'Đã từ chối đơn đăng ký'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await refresh();
    } catch (e) {
      setSnackbarMsg(e.message || t('managePending.rejectError', 'Có lỗi khi từ chối'));
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  const openEventDetail = (ev) => { setSelectedEvent(ev); setEventDetailOpen(true); };
  const closeEventDetail = () => { setEventDetailOpen(false); setSelectedEvent(null); };
  const openUserDetail = (u) => { setSelectedUser(u); setUserDetailOpen(true); };
  const closeUserDetail = () => { setUserDetailOpen(false); setSelectedUser(null); };

  return (
    <Box className={"campaign-join-page py-16 font-qs"} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minHeight: 'calc(100vh - 66px)' }}>
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
        <h2 className="text-2xl md:text-5xl font-bold text-center ">{t('managePending.title', 'Duyệt đơn đăng ký tham gia')}</h2>
        <p className="w-2/3 mx-auto md:text-lg mt-4 text-center leading-relaxed ">{t('managePending.subtitle', 'Xem, chấp nhận hoặc từ chối các đơn đăng ký tham gia chiến dịch của bạn.')}</p>
      </div>
      <div className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, mt: 2 }}>
          {/* Filter + total count */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: { xs: 220, sm: 260 }, ml: { xs: 2, sm: 15 }}}>
              <InputLabel id="campaign-filter-label" >{t('managePending.filterByCampaign', 'Lọc theo chiến dịch')}</InputLabel>
              <Select
                labelId="campaign-filter-label"
                id="campaign-filter"
                label={t('managePending.filterByCampaign', 'Lọc theo chiến dịch')}
                value={campaignFilter}
                onChange={(e) => { setCampaignFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value="all">{t('managePending.all', 'Tất cả')}</MenuItem>
                {myCampaigns.map(ev => (
                  <MenuItem key={ev.id} value={ev.id}>{ev.title || ev.name || `Sự kiện #${ev.id}`}</MenuItem>
                ))}
                {campaigns
                  .filter(c => !myCampaigns.some(ev => String(ev.id) === String(c.id)))
                  .map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Typography sx={{ fontSize: { xs: '.9rem', sm: '1rem' }, color: '#334155', mr: { xs: 2, sm: 15 } }}>
              {t('common.total', 'Tổng')}: <strong>{filteredRegs.length}</strong> {t('common.all', 'Tất cả').toLowerCase()}
            </Typography>
          </Box>
          {loading ? (
            <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CircularProgress size={22} />
              <Typography>{t('managePending.loading', 'Đang tải...')}</Typography>
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          )  : (
            <div className="container mx-auto mt-6">
              {/* Desktop table */}
              <div className="hidden md:block p-4">
                <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                  <table className="min-w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                        <th className="px-4 py-3 text-left rounded-tl-xl">{t('managePending.headers.index', '#')}</th>
                        <th className="px-4 py-3 text-left">{t('managePending.headers.volunteer', 'Tình nguyện viên')}</th>
                        <th className="px-4 py-3 text-left">{t('managePending.headers.campaign', 'Chiến dịch')}</th>
                        <th className="px-4 py-3 text-left">{t('managePending.headers.status', 'Trạng thái')}</th>
                        <th className="px-4 py-3 text-left">{t('managePending.headers.time', 'Đăng ký lúc')}</th>
                        <th className="px-4 py-3 text-center rounded-tr-xl">{t('managePending.headers.actions', 'Thao tác')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-600">{t('managePending.empty', 'Không có đơn đăng ký đang chờ duyệt.')}</td>
                        </tr>
                      ) : filteredRegs.slice(page * pageSize, page * pageSize + pageSize).map((r, idx) => {
                        const volunteerName = r.user?.username;
                        const eventTitle = r.event?.title || r.event?.name || `Sự kiện #${r.event_id}`;
                        const stText = approvalLabel(r.status, t);
                        return (
                          <React.Fragment key={r.id}>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                              <td className="px-4 py-3 font-medium text-gray-700 text-left">{page * pageSize + idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-gray-800 text-left">{volunteerName}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{eventTitle}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{stText}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '—'}</td>
                              <td className="px-4 py-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => openEventDetail(r.event)}
                                    fullWidth
                                    sx={{ width: '100%', bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
                                  >
                                    {t('managePending.buttons.eventDetail', 'Chi tiết sự kiện')}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    onClick={() => approveReg(r.id)}
                                    startIcon={<DoneAllIcon />}
                                    fullWidth
                                    sx={{ width: '100%', textTransform: 'none', fontWeight: 600 }}
                                  >
                                    {t('managePending.buttons.approve', 'Chấp nhận')}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => openUserDetail(r.user)}
                                    fullWidth
                                    sx={{ width: '100%', textTransform: 'none', fontWeight: 600 }}
                                  >
                                    {t('managePending.buttons.userDetail', 'Chi tiết TNV')}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => rejectReg(r.id)}
                                    startIcon={<CloseIcon />}
                                    fullWidth
                                    sx={{ width: '100%', textTransform: 'none', fontWeight: 600 }}
                                  >
                                    {t('managePending.buttons.reject', 'Từ chối')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
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
                        <th>{t('managePending.headers.volunteerShort', 'TNV')}</th>
                        <th>{t('managePending.headers.campaign', 'Chiến dịch')}</th>
                        <th>{t('managePending.buttons.view', 'Chi tiết')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegs.slice(page * pageSize, page * pageSize + pageSize).map((r) => {
                        const volunteerName = r.user?.username;
                        const eventTitle = r.event?.title || r.event?.name || `Sự kiện #${r.event_id}`;
                        return (
                          <tr className="border border-gray-300" key={`m-${r.id}`}>
                            <td>{volunteerName}</td>
                            <td>{eventTitle}</td>
                            <td>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => openEventDetail(r.event)}
                                sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
                              >
                                {t('managePending.buttons.view', 'Xem')}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Box>
        {/* Bottom pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5 }}>
          <IconButton size="small" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0} aria-label={t('common.prevPage', 'Trang trước')}>
            <KeyboardArrowLeftIcon />
          </IconButton>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1}}>
            <Typography sx={{ fontSize: { xs: '.85rem', sm: '.9rem' } }}>
              {t('common.page', 'Trang')} {page + 1} / {Math.max(1, Math.ceil(filteredRegs.length / pageSize))}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPage(p => (p + 1 < Math.ceil(filteredRegs.length / pageSize) ? p + 1 : p))} disabled={page + 1 >= Math.ceil(filteredRegs.length / pageSize)} aria-label={t('common.nextPage', 'Trang sau')}>
            <KeyboardArrowRightIcon />
          </IconButton>
        </Box>
      </div>

      {/* Event detail dialog (read-only, same style as ManagePendingCampaign) */}
      <Dialog open={eventDetailOpen} onClose={closeEventDetail} fullWidth maxWidth="md">
        <DialogTitle sx={{ bgcolor: '#2563eb', color: '#fff', px: 2, pt: 2.5, pb: 2 , fontWeight: 700}}>{t('managePending.eventDetailTitle', 'Chi tiết sự kiện')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedEvent ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mt: 1, color: '#1f2937' }}>
                {t('volunteers.fields.title', 'Tiêu đề')}: <strong>{selectedEvent.title || selectedEvent.name || '—'}</strong>
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1, color: '#1f2937' }}>
                {t('volunteers.fields.category', 'Thể loại')}: <strong>{selectedEvent.category?.name || selectedEvent.category_name || (selectedEvent.category_id ? `#${selectedEvent.category_id}` : '—')}</strong>
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1, color: '#1f2937' }}>
                {t('volunteers.fields.start', 'Bắt đầu')}: <strong>{selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleString('vi-VN') : '—'}</strong>
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1, color: '#1f2937' }}>
                {t('volunteers.fields.end', 'Kết thúc')}: <strong>{selectedEvent.end_time ? new Date(selectedEvent.end_time).toLocaleString('vi-VN') : '—'}</strong>
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1, color: '#1f2937' }}>
                {t('volunteers.fields.capacity', 'Số lượng')}: <strong>{selectedEvent.total_joined+selectedEvent.capacity ?? '—'}</strong>
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1, color: '#1f2937', gridColumn: { sm: '1 / -1' } }}>
                {(() => {
                  const loc = selectedEvent.location || null;
                  const name = loc?.name || selectedEvent.location_name || '';
                  const address = loc?.address_line || '';
                  const district = loc?.district || '';
                  const province = loc?.province || '';
                  const country = loc?.country || '';
                  const parts = [name, address, district, province, country].filter(p => !!String(p).trim());
                  const combined = parts.length ? parts.join(', ') : '—';
                  return (
                    <>{t('volunteers.fields.location', 'Địa điểm')}: <strong>{combined}</strong></>
                  );
                })()}
              </Typography>
              <Typography variant="subtitle2" sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, color: '#1f2937' }}>
                {t('volunteers.fields.description', 'Mô tả')}: <span style={{ fontWeight: 600, color: '#111827' }}>{selectedEvent.description || '—'}</span>
              </Typography>
              <Box sx={{ gridColumn: { sm: '1 / -1' }, mt: 1 }}>
                {selectedEvent.banner_url ? (
                  <Box component="img" src={selectedEvent.banner_url} alt="banner" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1.5, border: '1px solid #e5e7eb' }} />
                ) : null}
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEventDetail} variant='contained'>{t('managePending.close', 'Đóng')}</Button>
        </DialogActions>
      </Dialog>

      {/* Volunteer detail dialog (mirrors ControlUser detail) */}
      <Dialog open={userDetailOpen} onClose={closeUserDetail}>
        <DialogTitle sx={{ bgcolor: '#2563eb', color: '#ffffff', fontWeight: 700, py: 3 }}>
          {t('managePending.userDetailTitle', 'Thông tin tình nguyện viên')}
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser ? (
            <Box sx={{ minWidth: 320, pt: 0.5 }}>
              <Typography><strong>{t('volunteers.userFields.fullName', 'Họ tên')}:</strong> {selectedUser.full_name || '—'}</Typography>
              <Typography><strong>{t('volunteers.userFields.username', 'Tên đăng nhập')}:</strong> {selectedUser.username || '—'}</Typography>
              <Typography><strong>{t('volunteers.userFields.email', 'Email')}:</strong> {selectedUser.email || '—'}</Typography>
              <Typography><strong>{t('volunteers.userFields.phone', 'Số điện thoại')}:</strong> {selectedUser.phone || '—'}</Typography>
              {selectedUser.created_at ? (
                <Typography><strong>{t('volunteers.userFields.createdAt', 'Tạo lúc')}:</strong> {new Date(selectedUser.created_at).toLocaleString('vi-VN')}</Typography>
              ) : null}
              
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUserDetail} variant="contained" sx={{ textTransform: 'none' }}>{t('managePending.close', 'Đóng')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagePendingRegistration;
