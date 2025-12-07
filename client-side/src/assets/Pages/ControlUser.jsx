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
  List,
  ListItem,
  ListItemText
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

function ControlUser() {
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
          throw new Error(j?.error || 'Không tải được danh sách người dùng');
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
        throw new Error(j?.error || 'Cập nhật trạng thái thất bại');
      }
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, is_active: updated.is_active } : u));
      openSnack(updated.is_active ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', 'success');
    } catch (e) {
      openSnack(e.message || 'Có lỗi xảy ra', 'error');
    }
  };

  return (
    <Box className="control-user-page" sx={{ p: { xs: 1.5, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 'calc(100vh - 66px)' }}>
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

      <Paper sx={{ p: 0, borderRadius: 2, maxWidth: 1200, width: '100%', mx: 'auto', overflow: 'hidden' }} className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
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
          Quản lý người dùng
        </Typography>
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={24} />
            <Typography>Đang tải...</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="user-filter-label">Bộ lọc người dùng</InputLabel>
                <Select
                  labelId="user-filter-label"
                  id="user-filter"
                  value={filter}
                  label="Bộ lọc người dùng"
                  onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="active">Tài khoản đang hiệu lực</MenuItem>
                  <MenuItem value="locked">Tài khoản đang bị cấm</MenuItem>
                  <MenuItem value="role_volunteer">Vai trò: Tình nguyện viên</MenuItem>
                  <MenuItem value="role_manager">Vai trò: Quản lý sự kiện</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', position: 'relative' }}>
                <TextField
                  size="small"
                  label="Tìm kiếm người dùng"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setApplySearch(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { setApplySearch(true); setPage(0); }
                  }}
                  sx={{ minWidth: 420 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ gap: 0.75 }}>
                        <Select
                          value={searchMode}
                          onChange={(e) => { setSearchMode(e.target.value); setApplySearch(false); setPage(0); }}
                          variant="standard"
                          disableUnderline
                          sx={{ minWidth: 90, fontSize: '.85rem' }}
                        >
                          <MenuItem value="name">Họ tên</MenuItem>
                          <MenuItem value="email">Email</MenuItem>
                          <MenuItem value="phone">SĐT</MenuItem>
                        </Select>
                        <Typography sx={{ color: '#64748b' }}>|</Typography>
                      </InputAdornment>
                    )
                  }}
                />
                {suggestedUsers.length > 0 && !applySearch && (
                  <Paper elevation={3} sx={{ position: 'absolute', top: '40px', right: 0, width: { xs: '100%', sm: 520 }, zIndex: 10 }}>
                    <List>
                      {suggestedUsers.map(su => (
                        <ListItem
                          button
                          key={`suggest-${su.id}`}
                          onClick={() => { setSearchQuery(makeField(su)); setApplySearch(true); setPage(0); }}
                        >
                          <ListItemText
                            primary={makeField(su)}
                            secondary={(su.full_name || su.username || `User #${su.id}`)}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => { setApplySearch(true); setPage(0); }}
                  sx={{ textTransform: 'none' }}
                >
                  Tìm kiếm
                </Button>
              </Box>
            </Box>
            <List>
              {searchedUsers.slice(page * pageSize, page * pageSize + pageSize).map((u) => {
                const displayName = u.full_name || u.username || `User #${u.id}`;
                const avatar = u.avatar_url;
                const isActive = !!u.is_active;
                const roleName = (u.roles || []).map(r => r?.role?.name)[0] || 'VOLUNTEER';
                const roleLabel = roleName === 'EVENT_MANAGER' ? 'Quản lý sự kiện' : 'Tình nguyện viên';
                return (
                  <ListItem
                    key={u.id}
                    className={`cu-item ${u.is_active ? 'cu-active' : 'cu-locked'}`}
                    secondaryAction={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '.82rem', color: '#16a34a', fontWeight: 700 }}>{roleLabel}</Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          sx={{ textTransform: 'none' }}
                          onClick={() => handleView(u)}
                        >
                          Xem
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color={isActive ? 'error' : 'success'}
                          startIcon={isActive ? <LockIcon /> : <LockOpenIcon />}
                          sx={{ textTransform: 'none' }}
                          onClick={() => handleToggleActive(u)}
                        >
                          {isActive ? 'Khóa' : 'Mở'}
                        </Button>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                          {avatar ? (
                            <Box component="img" src={avatar} alt={displayName} sx={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                          ) : (
                            <Box sx={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontWeight: 700, border: '1px solid #e2e8f0' }} aria-label="no-avatar">
                              {String(displayName).trim().charAt(0).toUpperCase()}
                            </Box>
                          )}
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{displayName}</Typography>
                          <Box
                            sx={{
                              ml: 1,
                              px: 1,
                              py: 0.25,
                              borderRadius: '999px',
                              fontSize: '.78rem',
                              fontWeight: 700,
                              color: '#ffffff',
                              backgroundColor: isActive ? '#16a34a' : '#dc2626',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            aria-label={isActive ? 'Hiệu lực' : 'Bị khóa'}
                          >
                            {isActive ? 'Hiệu lực' : 'Bị khóa'}
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Typography sx={{ color: '#475569', mt: 0.25, fontSize: '.84rem' }}>
                          Email: <strong>{u.email}</strong>
                          {u.phone ? <span>{' · SĐT: '}{u.phone}</span> : null}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 2 }}>
              <IconButton
                size="small"
                onClick={() => setPage(p => Math.max(p - 1, 0))}
                disabled={page === 0}
                aria-label="Trang trước"
              >
                <KeyboardArrowLeftIcon />
              </IconButton>
              <Typography sx={{ fontSize: '.9rem', mx: 0.5 }}>
                Trang {page + 1} / {Math.max(1, Math.ceil(searchedUsers.length / pageSize))}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setPage(p => (p + 1 < Math.ceil(searchedUsers.length / pageSize) ? p + 1 : p))}
                disabled={page + 1 >= Math.ceil(searchedUsers.length / pageSize)}
                aria-label="Trang sau"
              >
                <KeyboardArrowRightIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </Paper>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)}>
        <DialogTitle
          sx={{
            bgcolor: '#2563eb',
            color: '#ffffff',
            fontWeight: 700,
            py: 3
            
          }}
        >
          Thông tin người dùng
        </DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Box sx={{ minWidth: 320, pt: 0.5 }}>
              <Typography><strong>Họ tên:</strong> {selected.full_name || '—'}</Typography>
              <Typography><strong>Tên đăng nhập:</strong> {selected.username}</Typography>
              <Typography><strong>Email:</strong> {selected.email}</Typography>
              <Typography><strong>Số điện thoại:</strong> {selected.phone || '—'}</Typography>
              <Typography><strong>Trạng thái:</strong> {selected.is_active ? 'Đang hoạt động' : 'Đã khóa'}</Typography>
              <Typography><strong>Quyền:</strong> {(selected.roles || []).map(r => r?.role?.name).join(', ') || '—'}</Typography>
              <Typography><strong>Tạo lúc:</strong> {new Date(selected.created_at).toLocaleString('vi-VN')}</Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)} variant="contained" sx={{ textTransform: 'none' }}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ControlUser;

