import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Snackbar, Alert, Fade, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired, clearAuth } from '../utils/auth';
import { useTranslation } from 'react-i18next';

function approvalChip(status, t) {
  const s = (status || '').toLowerCase();
  if (s === 'active') {
    return { text: t('manageManager.status.approved'), color: 'success', variant: 'filled', icon: <CheckCircleIcon fontSize="small" /> };
  }
  if (s === 'rejected') {
    return { text: t('manageManager.status.rejected'), color: 'error', variant: 'filled', icon: <CancelIcon fontSize="small" /> };
  }
  return { text: t('manageManager.status.pending'), color: 'warning', variant: 'filled', icon: <HourglassBottomIcon fontSize="small" /> };
}

const ManageManagerCampaign = () => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | active | rejected
  // Search + suggestions (like NeedVolunteer)
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Role guard: only allow ADMIN to access
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      if (!token || !userStr) { navigate('/login', { replace: true }); return; }
      if (isTokenExpired(token)) { clearAuth(); navigate('/login', { replace: true }); return; }
      const user = JSON.parse(userStr);
      const roles =  String(user.roles[0].role.name);
      const isAdmin = roles.includes('ADMIN');
      if (!isAdmin) { navigate('/', { replace: true }); }
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 30);
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login', { replace: true }); return () => clearTimeout(t); }
    setLoading(true);
    fetch('http://localhost:4000/events/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
      .then(res => { if (!res.ok) throw new Error(t('manageManager.errors.fetch')); return res.json(); })
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setEvents(arr);
        setError('');
      })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [navigate]);

  // Load categories for display of current category name
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('http://localhost:4000/categories', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
  }, []);

  const refresh = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('http://localhost:4000/events/', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setEvents(arr);
    } catch {}
  };

  const exportEventsCsv = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setSnackbarMsg(t('manageManager.errors.auth') || 'Bạn cần đăng nhập'); setSnackbarSeverity('warning'); setSnackbarOpen(true); return; }
      const res = await fetch(`http://localhost:4000/admin/export?type=events&format=csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('manageManager.errors.export') || 'Xuất CSV thất bại');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `events-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSnackbarMsg(t('manageManager.success.export') || 'Đã tải CSV sự kiện');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (e) {
      setSnackbarMsg(e.message || t('manageManager.errors.export') || 'Xuất CSV thất bại');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  // Derived filtered list by status
  const filteredEvents = React.useMemo(() => {
    const arr = Array.isArray(events) ? events : [];
    const normalized = (s) => String(s || '').toLowerCase();
    switch (statusFilter) {
      case 'pending':
        return arr.filter(ev => normalized(ev.approval_status || ev.status) === 'pending');
      case 'active':
        return arr.filter(ev => normalized(ev.approval_status || ev.status) === 'active');
      case 'rejected':
        return arr.filter(ev => normalized(ev.approval_status || ev.status) === 'rejected');
      default:
        // apply search filter if present
        if (search && String(search).trim() !== '') {
          const q = String(search).trim().toLowerCase();
          return arr.filter(ev => (String(ev.title || ev.name || '')).toLowerCase().includes(q));
        }
        return arr;
    }
  }, [events, statusFilter, search]);

  // Build suggestions based on events titles when user types
  useEffect(() => {
    const q = (searchText || '').trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    const pool = Array.isArray(events) ? events : [];
    const uniqueTitles = Array.from(new Set(pool.map((v) => (v.title || v.name || '').trim()).filter(Boolean)));
    const hits = uniqueTitles.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
    setSuggestions(hits);
    setShowSuggestions(hits.length > 0);
    setActiveSuggestionIndex(hits.length > 0 ? 0 : -1);
  }, [searchText, events]);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [statusFilter]);

  const approveEvent = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:4000/admin/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('manageManager.errors.approve'));
      }
      setSnackbarMsg(t('manageManager.success.approve'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await refresh();
    } catch (e) {
      setSnackbarMsg(e.message || t('manageManager.errors.approve'));
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  const rejectEvent = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:4000/admin/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rejected' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('manageManager.errors.reject'));
      }
      setSnackbarMsg(t('manageManager.success.reject'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await refresh();
    } catch (e) {
      setSnackbarMsg(e.message || t('manageManager.errors.reject'));
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  const openDetail = (ev) => {
    setSelectedEvent(ev);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedEvent(null);
  };

  const openDeleteConfirm = () => setDeleteConfirmOpen(true);
  const closeDeleteConfirm = () => { if (!deleting) setDeleteConfirmOpen(false); };

  const deleteEvent = async (id) => {
    const token = localStorage.getItem('token');
    if (!id || !token) return;
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:4000/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        let msg = t('manageManager.errors.deleteFailed');
        try { const j = await res.json(); msg = j?.error || msg; } catch {}
        throw new Error(msg);
      }
      setSnackbarMsg(t('manageManager.success.delete'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDeleteConfirmOpen(false);
      setDetailOpen(false);
      setSelectedEvent(null);
      await refresh();
    } catch (e) {
      setSnackbarMsg(e.message || t('manageManager.errors.delete'));
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    } finally {
      setDeleting(false);
    }
  };

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
        <h2 className="text-2xl md:text-5xl font-bold text-center ">{t('manageManager.title')}</h2>
        <p className="w-2/3 mx-auto md:text-lg mt-4 text-center leading-relaxed ">{t('manageManager.subtitle')}</p>
      </div>

      <div className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, mt: 2 }}>
          {/* Filter + total count */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { xs: 2, sm: 15 } }}>
              <FormControl size="small" sx={{ minWidth: { xs: 220, sm: 260 } }}>
                <InputLabel id="status-filter-label">{t('manageManager.filter.label')}</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label={t('manageManager.filter.label')}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">{t('manageManager.filter.options.all')}</MenuItem>
                  <MenuItem value="pending">{t('manageManager.filter.options.pending')}</MenuItem>
                  <MenuItem value="active">{t('manageManager.filter.options.active')}</MenuItem>
                  <MenuItem value="rejected">{t('manageManager.filter.options.rejected')}</MenuItem>
                </Select>
              </FormControl>
              <Button variant="outlined" color="secondary" onClick={exportEventsCsv} sx={{ textTransform: 'none' }}>
                {t('manageManager.buttons.exportCsv')}
              </Button>
            </Box>
            <div className="flex items-center gap-4 mr-4">
              <div className="relative flex p-1 border rounded-lg focus-within:ring focus-within:ring-opacity-40 focus-within:border-blue-400 focus-within:ring-blue-300">
                <input
                  className="px-6 py-2 border-none text-gray-700 placeholder-gray-500 bg-white outline-none focus:placeholder-transparent"
                  type="text"
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (!showSuggestions || suggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter') {
                      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
                        e.preventDefault();
                        const val = suggestions[activeSuggestionIndex];
                        setSearchText(val);
                        setSearch(val);
                        setShowSuggestions(false);
                        setActiveSuggestionIndex(-1);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                      setActiveSuggestionIndex(-1);
                    }
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => { setTimeout(() => setShowSuggestions(false), 100); }}
                  value={searchText}
                  name="search"
                  placeholder={t('manageManager.searchPlaceholder')}
                  aria-label="Search events"
                />

                <button
                  onClick={() => { setSearch(searchText); setShowSuggestions(false); setActiveSuggestionIndex(-1); }}
                  type="button"
                  className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium uppercase leading-normal text-white shadow transition duration-150 ease-in-out hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 active:bg-blue-800"
                >
                  {t('manageManager.searchButton')}
                </button>

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-2 z-10 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow">
                    {suggestions.map((s, idx) => (
                      <li
                        key={`${s}-${idx}`}
                        className={(idx === activeSuggestionIndex ? 'bg-blue-50' : 'bg-white') + ' cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-blue-50'}
                        onMouseDown={() => {
                          setSearchText(s);
                          setSearch(s);
                          setShowSuggestions(false);
                          setActiveSuggestionIndex(-1);
                        }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Typography sx={{ fontSize: { xs: '.9rem', sm: '1rem' }, color: '#334155', mr: { xs: 2, sm: 15 } }}>
                {t('manageManager.total', { count: filteredEvents.length })}
              </Typography>
            </div>
          </Box>

          {/* Tables */}
          {loading ? (
            <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CircularProgress size={22} />
              <Typography>{t('manageManager.loading')}</Typography>
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <div className="container mx-auto mt-6">
              {/* Desktop table */}
              <div className="hidden md:block p-4">
                <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                  <table className="min-w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                        <th className="px-4 py-3 text-left rounded-tl-xl">{t('manageManager.headers.index')}</th>
                        <th className="px-4 py-3 text-left">{t('manageManager.headers.campaign')}</th>
                        <th className="px-4 py-3 text-left">{t('manageManager.headers.status')}</th>
                        <th className="px-4 py-3 text-left">{t('manageManager.headers.location')}</th>
                        <th className="px-4 py-3 text-center rounded-tr-xl">{t('manageManager.headers.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-600">{t('manageManager.empty')}</td>
                        </tr>
                      ) : filteredEvents.slice(page * pageSize, page * pageSize + pageSize).map((ev, idx) => {
                        const rawStatus = ev.approval_status || ev.status;
                        const st = approvalChip(rawStatus, t);
                        const title = ev.title || ev.name || `Sự kiện #${ev.id}`;
                        const locationName = ev.location?.name || '';
                        const sLower = String(rawStatus || '').toLowerCase();
                        return (
                          <React.Fragment key={ev.id}>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                              <td className="px-4 py-3 font-medium text-gray-700 text-left">{page * pageSize + idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-gray-800 text-left">{title}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{st.text}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{locationName || '—'}</td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <div className="flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap overflow-x-auto">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => openDetail(ev)}
                                    sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
                                  >
                                    {t('manageManager.buttons.view')}
                                  </Button>
                                  {sLower === 'pending' ? (
                                    <>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="success"
                                        onClick={() => approveEvent(ev.id)}
                                        startIcon={<DoneAllIcon />}
                                        sx={{ textTransform: 'none', fontWeight: 600 }}
                                      >
                                        {t('manageManager.buttons.approve')}
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => rejectEvent(ev.id)}
                                        startIcon={<CloseIcon />}
                                        sx={{ textTransform: 'none', fontWeight: 600 }}
                                      >
                                        {t('manageManager.buttons.reject')}
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="error"
                                      startIcon={<DeleteOutlineIcon />}
                                      onClick={() => { setSelectedEvent(ev); openDeleteConfirm(); }}
                                      sx={{ textTransform: 'none', fontWeight: 600 }}
                                    >
                                      {t('manageManager.buttons.delete')}
                                    </Button>
                                  )}
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
                        <th>{t('manageManager.headers.campaign')}</th>
                        <th>{t('manageManager.headers.status')}</th>
                        <th>{t('manageManager.headers.details')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-center">{t('manageManager.emptyMobile')}</td>
                        </tr>
                      ) : filteredEvents.slice(page * pageSize, page * pageSize + pageSize).map((ev) => {
                        const rawStatus = ev.approval_status || ev.status;
                        const st = approvalChip(rawStatus, t);
                        const title = ev.title || ev.name || `Sự kiện #${ev.id}`;
                        return (
                          <tr className="border border-gray-300" key={`m-${ev.id}`}>
                            <td>{title}</td>
                            <td>{st.text}</td>
                            <td>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => openDetail(ev)}
                                sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
                              >
                                {t('manageManager.buttons.view')}
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
          <IconButton size="small" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0} aria-label={t('manageManager.pagination.prev')}>
            <KeyboardArrowLeftIcon />
          </IconButton>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1}}>
            <Typography sx={{ fontSize: { xs: '.85rem', sm: '.9rem' } }}>
              {t('manageManager.pagination.pageXofY', { current: page + 1, total: Math.max(1, Math.ceil(filteredEvents.length / pageSize)) })}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPage(p => (p + 1 < Math.ceil(filteredEvents.length / pageSize) ? p + 1 : p))} disabled={page + 1 >= Math.ceil(filteredEvents.length / pageSize)} aria-label={t('manageManager.pagination.next')}>
            <KeyboardArrowRightIcon />
          </IconButton>
        </Box>
      </div>
      {/* Read-only detail dialog for ADMIN review; includes delete action for approved */}
      <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="md">
        <DialogTitle sx={{ bgcolor: '#0ea5e9', color: '#fff', px: 2, pt: 2.5, pb: 2 }}>{t('manageManager.detailDialog.title')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedEvent ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label={t('manageManager.labels.title')}
                value={selectedEvent.title || ''}
                InputLabelProps={{ shrink: true }}
                fullWidth
                InputProps={{ readOnly: true }}
                sx={{
                  '& .MuiInputBase-root': { opacity: 1 },
                  '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' },
                  '& .MuiInputLabel-root': { color: '#1f2937' },
                  mt:2
                }}
                
              />
              <FormControl fullWidth disabled sx={{
                '&.Mui-disabled': { opacity: 1 },
                '& .MuiInputLabel-root.Mui-disabled': { color: '#1f2937' },
                '& .MuiOutlinedInput-root.Mui-disabled': { opacity: 1 },
                '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: '#111827' }
              }}>
                <InputLabel id="detail-category-select-label" sx={{ mt: 2 }}>{t('manageManager.labels.category')}</InputLabel>
                {(() => {
                  const currentCategoryId = selectedEvent.category_id ?? selectedEvent.category?.id ?? '';
                  const currentCategoryName = selectedEvent.category?.name ?? (categories.find(c => String(c.id) === String(currentCategoryId))?.name) ?? '';
                  return (
                    <Select
                      labelId="detail-category-select-label"
                      label={t('manageManager.labels.category')}
                      sx={{ mt: 2 }}
                      value={currentCategoryId}
                      renderValue={(value) => currentCategoryName || '—'}
                    >
                      {categories.length > 0 ? (
                        categories.map((c) => (
                          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))
                      ) : (
                        currentCategoryId ? <MenuItem value={currentCategoryId}>{currentCategoryName || '—'}</MenuItem> : null
                      )}
                    </Select>
                  );
                })()}
              </FormControl>

              <TextField label={t('manageManager.labels.start')} value={selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleString('vi-VN') : ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />
              <TextField label={t('manageManager.labels.end')} value={selectedEvent.end_time ? new Date(selectedEvent.end_time).toLocaleString('vi-VN') : ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />

              <TextField label={t('manageManager.labels.capacity')} value={selectedEvent.capacity ?? ''} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />

              <TextField label={t('manageManager.labels.locationName')} value={selectedEvent.location?.name || ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />
              <TextField label={t('manageManager.labels.addressLine')} value={selectedEvent.location?.address_line || ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />
              <TextField label={t('manageManager.labels.district')} value={selectedEvent.location?.district || ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />
              <TextField label={t('manageManager.labels.province')} value={selectedEvent.location?.province || ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />
              <TextField label={t('manageManager.labels.country')} value={selectedEvent.location?.country || ''} InputLabelProps={{ shrink: true }} fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} />

              <TextField label={t('manageManager.labels.description')} value={selectedEvent.description || ''} multiline minRows={3} sx={{ gridColumn: { sm: '1 / -1' }, '& .MuiInputBase-root': { opacity: 1 }, '& .MuiInputBase-input': { WebkitTextFillColor: '#111827' }, '& .MuiInputLabel-root': { color: '#1f2937' } }} fullWidth InputProps={{ readOnly: true }} />

              <Box sx={{ gridColumn: { sm: '1 / -1' }, mt: 1 }}>
                {selectedEvent.banner_url ? (
                  <Box component="img" src={selectedEvent.banner_url} alt="banner" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1.5, border: '1px solid #e5e7eb' }} />
                ) : null}
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          {(() => {
            const st = String(selectedEvent?.status || selectedEvent?.approval_status || '').toLowerCase();
            return <Button onClick={closeDetail} variant='contained'>{t('common.close')}</Button>;
          })()}
        </DialogActions>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={deleteConfirmOpen} onClose={closeDeleteConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>{t('manageManager.deleteDialog.title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('manageManager.deleteDialog.message')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirm} disabled={deleting}>{t('common.cancel')}</Button>
          <Button onClick={() => deleteEvent(selectedEvent?.id)} color="error" variant="contained" disabled={deleting} startIcon={deleting ? undefined : <DeleteOutlineIcon />}>
            {deleting ? <CircularProgress size={18} color="inherit" /> : t('manageManager.deleteDialog.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageManagerCampaign;