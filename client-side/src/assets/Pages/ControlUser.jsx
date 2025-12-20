import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useNavigate } from 'react-router-dom';
import './ControlUser.css';
import { isTokenExpired, clearAuth } from '../utils/auth';
import { useTranslation } from 'react-i18next';

function ControlUser() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const [filter, setFilter] = useState('all'); // all | active | locked | role_volunteer | role_manager
  const [searchMode, setSearchMode] = useState('name'); // name | email | phone
  const [searchQuery, setSearchQuery] = useState('');
  const [applySearch, setApplySearch] = useState(false);
  const exportVolunteersCsv = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/admin/export?type=users&format=csv`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('manageUser.exportCsv.failed'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename=([^;]+)$/.exec(cd);
      const fallback = `users-${new Date().toISOString().split('T')[0]}.csv`;
      a.download = m ? m[1].replace(/"/g, '') : fallback;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      openSnack(t('manageUser.exportCsv.success'),'success');
    } catch (e) {
      openSnack(e.message || t('manageUser.exportCsv.failed'),'error');
    }
  };

  const filteredUsers = users.filter(u => {
    switch (filter) {
      case 'active':
        return !!u.is_active;
      case 'locked':
        return !u.is_active;
      case 'role_volunteer': {
        const roleName = (u.roles || []).map(r => r?.role?.name)[0];
        return roleName === 'VOLUNTEER';
      }
      case 'role_manager': {
        const roleName = (u.roles || []).map(r => r?.role?.name)[0];
        return roleName === 'EVENT_MANAGER';
      }
      default:
        return true;
    }
  });

  const makeField = (u) => {
    if (searchMode === 'name') return (u.full_name || '').toString();
    if (searchMode === 'email') return (u.email || '').toString();
    return (u.phone || '').toString();
  };

  const lowerQuery = searchQuery.trim().toLowerCase();
  const suggestedUsers = lowerQuery
    ? filteredUsers.filter(u => makeField(u).toLowerCase().includes(lowerQuery)).slice(0, 5)
    : [];

  const searchedUsers = applySearch && lowerQuery
    ? filteredUsers.filter(u => makeField(u).toLowerCase().includes(lowerQuery))
    : filteredUsers;

  const openSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });
  const closeSnack = () => setSnack(s => ({ ...s, open: false }));

  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 30);
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      navigate('/login', { replace: true });
      return () => clearTimeout(t);
    }
    if (isTokenExpired(token)) {
      clearAuth();
      navigate('/login', { replace: true });
      return () => clearTimeout(t);
    }
    setLoading(true);
    fetch('http://localhost:4000/admin', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || t('manageUser.errors.fetch'));
        }
        return res.json();
      })
      .then((data) => {
        const filtered = Array.isArray(data)
          ? data.filter(u => !(u.roles || []).some(r => r?.role?.name === 'ADMIN'))
          : [];
        setUsers(filtered);
        setError('');
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [navigate]);

  const handleView = (user) => {
    setSelected(user);
    setDetailOpen(true);
  };

  const handleToggleActive = async (user) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:4000/admin/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || t('manageUser.errors.statusUpdate'));
      }
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, is_active: updated.is_active } : u));
      openSnack(updated.is_active ? t('manageUser.success.unlocked') : t('manageUser.success.locked'), 'success');
    } catch (e) {
      openSnack(e.message || t('manageUser.errors.generic'), 'error');
    }
  };

  return (
    <Box className={"campaign-join-page py-16 font-qs"} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minHeight: 'calc(100vh - 66px)' }}>
      <Snackbar
        open={snack.open}
        autoHideDuration={1200}
        onClose={(_, r) => { if (r !== 'clickaway') closeSnack(); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ px: 2, py: 1 }}>
          {snack.msg}
        </Alert>
      </Snackbar>

      <div
        data-aos="fade-left"
        data-aos-anchor-placement="top-bottom"
        data-aos-easing="linear"
        data-aos-duration="1500"
        className="container mx-auto mb-6"
      >
        <h2 className="text-2xl md:text-5xl font-bold text-center ">{t('manageUser.title')}</h2>
        <p className="w-2/3 mx-auto md:text-lg mt-4 text-center leading-relaxed ">{t('manageUser.subtitle')}</p>
      </div>

      <div className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, mt: 2 }}>
          {/* Filters + search + total */}
          {loading ? (
            <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CircularProgress size={22} />
              <Typography>{t('manageUser.loading')}</Typography>
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: { xs: 220, sm: 260 }, ml: { xs: 2, sm: 15 } }}>
                <InputLabel id="user-filter-label">{t('manageUser.filter.label')}</InputLabel>
                <Select
                  labelId="user-filter-label"
                  id="user-filter"
                  value={filter}
                  label={t('manageUser.filter.label')}
                  onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                >
                  <MenuItem value="all">{t('manageUser.filter.options.all')}</MenuItem>
                  <MenuItem value="active">{t('manageUser.filter.options.active')}</MenuItem>
                  <MenuItem value="locked">{t('manageUser.filter.options.locked')}</MenuItem>
                  <MenuItem value="role_volunteer">{t('manageUser.filter.options.role_volunteer')}</MenuItem>
                  <MenuItem value="role_manager">{t('manageUser.filter.options.role_manager')}</MenuItem>
                </Select>
              </FormControl>
              <Button variant="outlined" color="secondary" onClick={exportVolunteersCsv} sx={{ textTransform: 'none' }}>
                {t('manageUser.exportCsv.button')}
              </Button>
              {/* Group search box and total together */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { xs: 0, sm: 'auto' }, flexWrap: 'nowrap' }}>
                <Box sx={{ position: 'relative', width: { xs: '100%', sm: 'auto' }, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    label={t('manageUser.search.label')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setApplySearch(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setApplySearch(true); setPage(0); } }}
                    sx={{ minWidth: { xs: '100%', sm: 380, md: 420 }, flex: 1 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ gap: 0.75 }}>
                          <Select
                            value={searchMode}
                            onChange={(e) => { setSearchMode(e.target.value); setApplySearch(false); setPage(0); }}
                            variant="standard"
                            disableUnderline
                            sx={{ minWidth: { xs: 80, sm: 90 }, fontSize: '.85rem' }}
                          >
                            <MenuItem value="name">{t('manageUser.search.modes.name')}</MenuItem>
                            <MenuItem value="email">{t('manageUser.search.modes.email')}</MenuItem>
                            <MenuItem value="phone">{t('manageUser.search.modes.phone')}</MenuItem>
                          </Select>
                          <Typography sx={{ color: '#64748b' }}>|</Typography>
                        </InputAdornment>
                      )
                    }}
                  />
                  {suggestedUsers.length > 0 && !applySearch && (
                    <Paper elevation={3} sx={{ position: 'absolute', top: '40px', right: 0, width: { xs: '100%', sm: 520 }, maxHeight: 300, overflowY: 'auto', zIndex: 10 }}>
                      {/* Suggestions list kept with MUI Paper for convenience */}
                      <Box>
                        {suggestedUsers.map(su => (
                          <Box key={`suggest-${su.id}`} sx={{ px: 1, py: 0.75, borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => { setSearchQuery(makeField(su)); setApplySearch(true); setPage(0); }}>
                            <Typography sx={{ fontSize: '.9rem' }}>{makeField(su)}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: '.8rem' }}>{su.full_name || su.username || `User #${su.id}`}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Paper>
                  )}
                  <Button variant="contained" color="primary" onClick={() => { setApplySearch(true); setPage(0); }} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
                    {t('manageUser.search.button')}
                  </Button>
                </Box>
                <Typography sx={{ fontSize: { xs: '.9rem', sm: '1rem' }, mr: { xs: 2, sm: 15 },color: '#334155', whiteSpace: 'nowrap' }}>
                  {t('manageUser.total', { count: searchedUsers.length })}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Tables */}
          {!loading && !error && (
            <div className="container mx-auto mt-6">
              {/* Desktop table */}
              <div className="hidden md:block p-4">
                <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                  <table className="min-w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                        <th className="px-4 py-3 text-left rounded-tl-xl">{t('manageUser.headers.index')}</th>
                        <th className="px-4 py-3 text-left">{t('manageUser.headers.name')}</th>
                        <th className="px-4 py-3 text-left">{t('manageUser.headers.email')}</th>
                        <th className="px-4 py-3 text-left">{t('manageUser.headers.status')}</th>
                        <th className="px-4 py-3 text-left">{t('manageUser.headers.role')}</th>
                        <th className="px-4 py-3 text-left">{t('manageUser.headers.createdAt')}</th>
                        <th className="px-4 py-3 text-center rounded-tr-xl">{t('manageUser.headers.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-gray-600">{t('manageUser.empty')}</td>
                        </tr>
                      ) : searchedUsers.slice(page * pageSize, page * pageSize + pageSize).map((u, idx) => {
                        const displayName = u.full_name || u.username || `User #${u.id}`;
                        const isActive = !!u.is_active;
                        const roleName = (u.roles || []).map(r => r?.role?.name)[0] || 'VOLUNTEER';
                        const roleLabel = roleName === 'VOLUNTEER' ? t('manageUser.roles.volunteer') : t('manageUser.roles.manager');
                        return (
                          <React.Fragment key={u.id}>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                              <td className="px-4 py-3 font-medium text-gray-700 text-left">{page * pageSize + idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-gray-800 text-left">{displayName}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{u.email || '—'}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{isActive ? t('manageUser.status.active') : t('manageUser.status.locked')}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{roleLabel}</td>
                              <td className="px-4 py-3 text-gray-700 text-left">{u.created_at ? new Date(u.created_at).toLocaleString('vi-VN') : '—'}</td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <div className="flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap overflow-x-auto">
                                  <Button size="small" variant="contained" onClick={() => handleView(u)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                                    {t('manageUser.buttons.view')}
                                  </Button>
                                  <FormControl size="small" sx={{ minWidth: 160, mt: 0.7}}>
                                    <InputLabel id={`role-select-label-${u.id}`}>{t('manageUser.roleSelect.label')}</InputLabel>
                                    <Select
                                      labelId={`role-select-label-${u.id}`}
                                      id={`role-select-${u.id}`}
                                      label={t('manageUser.roleSelect.label')}
                                      value={roleName}
                                      onChange={async (e) => {
                                        const newRole = e.target.value;
                                        const token = localStorage.getItem('token');
                                        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, roles: [{ role: { name: newRole } }] } : x));
                                        try {
                                          const res = await fetch(`http://localhost:4000/admin/${u.id}/role`, {
                                            method: 'PATCH',
                                            headers: {
                                              Authorization: `Bearer ${token}`,
                                              'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ new_role: newRole })
                                          });
                                          if (!res.ok) {
                                            const j = await res.json().catch(() => ({}));
                                            throw new Error(j?.error || t('manageUser.errors.roleUpdate'));
                                          }
                                          const updated = await res.json();
                                          const updatedRole = (updated.roles || []).map(r => r?.role?.name)[0] || newRole;
                                          setUsers(prev => prev.map(x => x.id === u.id ? { ...x, roles: [{ role: { name: updatedRole } }] } : x));
                                          openSnack(t('manageUser.success.roleUpdate'),'success');
                                        } catch (err) {
                                          setUsers(prev => prev.map(x => x.id === u.id ? { ...x, roles: [{ role: { name: roleName } }] } : x));
                                          openSnack(err.message || t('manageUser.errors.roleUpdate'),'error');
                                        }
                                      }}
                                    >
                                      <MenuItem value="VOLUNTEER">{t('manageUser.roles.volunteer')}</MenuItem>
                                      <MenuItem value="EVENT_MANAGER">{t('manageUser.roles.manager')}</MenuItem>
                                    </Select>
                                  </FormControl>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color={isActive ? 'error' : 'success'}
                                    startIcon={isActive ? <LockIcon /> : <LockOpenIcon />}
                                    sx={{ textTransform: 'none', fontWeight: 600, minWidth: 80 }}
                                    onClick={() => handleToggleActive(u)}
                                  >
                                    {isActive ? t('manageUser.buttons.lock') : t('manageUser.buttons.unlock')}
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
                        <th>{t('manageUser.headers.name')}</th>
                        <th>{t('manageUser.headers.status')}</th>
                        <th>{t('manageUser.headers.details')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-center">{t('manageUser.emptyMobile')}</td>
                        </tr>
                      ) : searchedUsers.slice(page * pageSize, page * pageSize + pageSize).map((u) => {
                        const displayName = u.full_name || u.username || `User #${u.id}`;
                        const isActive = !!u.is_active;
                        return (
                          <tr className="border border-gray-300" key={`m-${u.id}`}>
                            <td>{displayName}</td>
                            <td>{isActive ? t('manageUser.status.active') : t('manageUser.status.locked')}</td>
                            <td>
                              <Button size="small" variant="contained" onClick={() => handleView(u)} sx={{ textTransform: 'none', fontWeight: 600, minWidth: 70 }}>
                                {t('manageUser.buttons.view')}
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
          <IconButton size="small" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0} aria-label={t('manageUser.pagination.prev')}>
            <KeyboardArrowLeftIcon />
          </IconButton>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1}}>
            <Typography sx={{ fontSize: { xs: '.85rem', sm: '.9rem' } }}>
              {t('manageUser.pagination.pageXofY', { current: page + 1, total: Math.max(1, Math.ceil(searchedUsers.length / pageSize)) })}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPage(p => (p + 1 < Math.ceil(searchedUsers.length / pageSize) ? p + 1 : p))} disabled={page + 1 >= Math.ceil(searchedUsers.length / pageSize)} aria-label={t('manageUser.pagination.next')}>
            <KeyboardArrowRightIcon />
          </IconButton>
        </Box>
      </div>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)}>
        <DialogTitle
          sx={{
            bgcolor: '#2563eb',
            color: '#ffffff',
            fontWeight: 700,
            py: 3
            
          }}
        >
          {t('manageUser.detailDialog.title')}
        </DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Box sx={{ minWidth: 320, pt: 0.5 }}>
              <Typography><strong>{t('manageUser.detailDialog.labels.fullName')}:</strong> {selected.full_name || '—'}</Typography>
              <Typography><strong>{t('manageUser.detailDialog.labels.username')}:</strong> {selected.username}</Typography>
              <Typography><strong>{t('manageUser.detailDialog.labels.email')}:</strong> {selected.email}</Typography>
              <Typography><strong>{t('manageUser.detailDialog.labels.phone')}:</strong> {selected.phone || '—'}</Typography>
              <Typography><strong>{t('manageUser.detailDialog.labels.status')}:</strong> {selected.is_active ? t('manageUser.status.active') : t('manageUser.status.locked')}</Typography>
              <Typography><strong>{t('manageUser.detailDialog.labels.roles')}:</strong> {(selected.roles || []).map(r => r?.role?.name).join(', ') || '—'}</Typography>
              <Typography><strong>{t('manageUser.detailDialog.labels.createdAt')}:</strong> {new Date(selected.created_at).toLocaleString('vi-VN')}</Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)} variant="contained" sx={{ textTransform: 'none' }}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ControlUser;

