import React, { useEffect, useState } from 'react';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Box, Paper, Typography, Chip, Button, CircularProgress, List, ListItem, ListItemText, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Fade, IconButton, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useLocation } from 'react-router-dom';
import './ShowCampaignJoin.css';

function approvalLabel(status) {
	const s = (status || '').toLowerCase();
	if (s === 'active') {
		return { text: 'Đã duyệt', color: 'success', variant: 'filled', icon: <CheckCircleIcon fontSize="small" /> };
	}
	if (s === 'rejected') {
		return { text: 'Bị từ chối', color: 'error', variant: 'filled', icon: <CancelIcon fontSize="small" /> };
	}
	return { text: 'Đang chờ duyệt', color: 'warning', variant: 'filled', icon: <HourglassBottomIcon fontSize="small" /> };
}

// Format start time to: weekday, hour, dd/mm/yyyy (vi-VN)
const fmtStartTime = (d) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const weekday = dt.toLocaleDateString('vi-VN', { weekday: 'long' });
    const hour = dt.getHours();
    const dateStr = dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${hour} giờ, ${dateStr}`;
};

const ManageMyCampaign = () => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [campaigns, setCampaigns] = useState([]);
	const [mounted, setMounted] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [editOpen, setEditOpen] = useState(false);
	const [form, setForm] = useState({
		title: '',
		description: '',
		category_id: '',
		location_id: '',
		start_time: '',
		end_time: '',
		capacity: '',
		banner_url: '',
	});
	const [saving, setSaving] = useState(false);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMsg, setSnackbarMsg] = useState('');
	const navigate = useNavigate();
	const location = useLocation();

	// Pagination: show max 3 events per page
	const [page, setPage] = useState(0);
	const pageSize = 3;

	// Delete controls
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteId, setDeleteId] = useState(null);
	const [deleting, setDeleting] = useState(false);

	// Create new campaign dialog state
	const [createOpen, setCreateOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [createForm, setCreateForm] = useState({
		title: '',
		description: '',
		category_id: '',
		location: {
			name: '',
			address_line: '',
			district: '',
			province: '',
			country: 'Việt Nam',
		},
		start_time: '',
		end_time: '',
		capacity: '',
	});
	const [bannerFile, setBannerFile] = useState(null);
	const [bannerPreview, setBannerPreview] = useState('');

	useEffect(() => {
		if (!bannerFile) {
			if (bannerPreview) {
				try { URL.revokeObjectURL(bannerPreview); } catch {}
			}
			setBannerPreview('');
			return;
		}
		const url = URL.createObjectURL(bannerFile);
		setBannerPreview((prev) => {
			if (prev) { try { URL.revokeObjectURL(prev); } catch {} }
			return url;
		});
		return () => { try { URL.revokeObjectURL(url); } catch {} };
	}, [bannerFile]);

	const openCreateDialog = () => setCreateOpen(true);
	const closeCreateDialog = () => { setCreateOpen(false); setCreating(false); setBannerFile(null); };

	const onCreateChange = (field, value) => {
		if (field.startsWith('location.')) {
			const key = field.split('.')[1];
			setCreateForm((p) => ({ ...p, location: { ...p.location, [key]: value } }));
		} else {
			setCreateForm((p) => ({ ...p, [field]: value }));
		}
	};

	const submitCreate = async () => {
		try {
			setCreating(true);
			const token = localStorage.getItem('token');
			const delay = new Promise((res) => setTimeout(res, 2000));
			// Build multipart/form-data with flat fields so controllers using req.body work even without req.body.data
			const form = new FormData();
			form.append('title', createForm.title || '');
			form.append('description', createForm.description || '');
			if (createForm.category_id) form.append('category_id', String(Number(createForm.category_id)));
			// Send location as JSON string; backend can JSON.parse
			form.append('location', JSON.stringify(createForm.location || {}));
			if (createForm.start_time) form.append('start_time', createForm.start_time);
			if (createForm.end_time) form.append('end_time', createForm.end_time);
			if (createForm.capacity) form.append('capacity', String(Number(createForm.capacity)));
			if (bannerFile) form.append('banner', bannerFile);

			const respPromise = fetch('http://localhost:4000/events', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: form,
			});
			const [resp] = await Promise.all([respPromise, delay]);
			if (!resp.ok) {
				const t = await resp.text();
				throw new Error(t || 'Tạo sự kiện thất bại');
			}
			setSnackbarMsg('Tạo sự kiện thành công');
			setSnackbarOpen(true);
			closeCreateDialog();
			await fetchMyEvents();
		} catch (e) {
			setSnackbarMsg(e.message || 'Có lỗi khi tạo sự kiện');
			setSnackbarOpen(true);
			setCreating(false);
		}
	};

	// Using built-in Fade for snackbar transitions

	useEffect(() => {
		const token = localStorage.getItem('token');
		const userStr = localStorage.getItem('user');
		if (!token || !userStr) {
			navigate('/login', { replace: true });
			return;
		}
		let currentUserId = null;
		try {
			const parsed = JSON.parse(userStr);
			currentUserId = parsed?.id ?? null;
		} catch {}
		setMounted(false);
		const t = setTimeout(() => setMounted(true), 30);
		setLoading(true);
		// Assumed endpoint for campaigns created by current user
		fetch('http://localhost:4000/events/', {
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		})
			.then(res => {
				if (!res.ok) throw new Error('Không lấy được danh sách chiến dịch của bạn');
				return res.json();
			})
			.then(data => {
				const arr = Array.isArray(data) ? data : [];
				// Client-side filter: only events owned/created by current user
				const mine = arr.filter((ev) => {
					const managerId = ev?.manager?.id ?? ev?.manager_id ?? null;
					const creatorId = ev?.creator_id ?? ev?.created_by ?? ev?.user_id ?? null;
					return (currentUserId && (managerId === currentUserId || creatorId === currentUserId));
				});
				setCampaigns(mine);
				setError(null);
			})
			.catch(err => setError(err.message))
			.finally(() => setLoading(false));
		return () => clearTimeout(t);
	}, [navigate, location.key]);

	const fetchMyEvents = async () => {
		try {
			const token = localStorage.getItem('token');
			const userStr = localStorage.getItem('user');
			if (!token) return;
			const res = await fetch('http://localhost:4000/events/', {
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});
			if (!res.ok) return;
			const data = await res.json();
			let currentUserId = null;
			try { const parsed = userStr ? JSON.parse(userStr) : null; currentUserId = parsed?.id ?? null; } catch {}
			const arr = Array.isArray(data) ? data : [];
			const mine = arr.filter((ev) => {
				const managerId = ev?.manager?.id ?? ev?.manager_id ?? null;
				const creatorId = ev?.creator_id ?? ev?.created_by ?? ev?.user_id ?? null;
				return (currentUserId && (managerId === currentUserId || creatorId === currentUserId));
			});
			setCampaigns(mine);
		} catch (_) {}
	};

	const startEditing = (ev) => {
		setEditingId(ev.id);
		setForm({
			title: ev.title || '',
			description: ev.description || '',
			category_id: ev.category_id ?? ev.category?.id ?? '',
			location_id: ev.location_id ?? ev.location?.id ?? '',
			start_time: ev.start_time ? new Date(ev.start_time).toISOString().slice(0,16) : '',
			end_time: ev.end_time ? new Date(ev.end_time).toISOString().slice(0,16) : '',
			capacity: ev.capacity ?? '',
			banner_url: ev.banner_url ?? '',
		});
		setEditOpen(true);
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditOpen(false);
		setForm({
			title: '', description: '', category_id: '', location_id: '', start_time: '', end_time: '', capacity: '', banner_url: ''
		});
	};

	const onFormChange = (field, value) => {
		setForm((f) => ({ ...f, [field]: value }));
	};

	const openDeleteConfirm = (id) => {
		setDeleteId(id);
		setDeleteOpen(true);
	};

	const closeDeleteConfirm = () => {
		if (deleting) return;
		setDeleteOpen(false);
		setDeleteId(null);
	};

	const confirmDelete = async () => {
		const token = localStorage.getItem('token');
		if (!token) {
			navigate('/login', { replace: true });
			return;
		}
		if (!deleteId) return;
		setDeleting(true);
		try {
			const requestPromise = (async () => {
				const res = await fetch(`http://localhost:4000/events/${deleteId}`, {
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				});
				if (!res.ok) {
					const msg = await res.text();
					throw new Error(msg || 'Xóa thất bại');
				}
				return true;
			})();
			const delayPromise = new Promise((resolve) => setTimeout(resolve, 2000));
			await Promise.all([requestPromise, delayPromise]);
			setCampaigns((list) => list.filter((e) => e.id !== deleteId));
			setSnackbarMsg('Xóa chiến dịch thành công');
			setSnackbarOpen(true);
			setDeleteOpen(false);
			setDeleteId(null);
			await fetchMyEvents();
		} catch (err) {
			setError(err.message);
		} finally {
			setDeleting(false);
		}
	};

	const saveChanges = async (id) => {
		const token = localStorage.getItem('token');
		if (!token) {
			navigate('/login', { replace: true });
			return;
		}
		if (!form.title || !form.category_id || !form.location_id || !form.start_time || !form.end_time) {
			setError('Vui lòng điền đầy đủ các trường bắt buộc.');
			return;
		}
		setSaving(true);
		try {
			const payload = {
				title: form.title,
				description: form.description,
				category_id: Number(form.category_id),
				location_id: Number(form.location_id),
				start_time: new Date(form.start_time).toISOString(),
				end_time: new Date(form.end_time).toISOString(),
				capacity: form.capacity ? Number(form.capacity) : undefined,
				banner_url: form.banner_url,
			};
			const requestPromise = (async () => {
				const res = await fetch(`http://localhost:4000/events/${id}`, {
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});
				if (!res.ok) {
					const msg = await res.text();
					throw new Error(msg || 'Cập nhật thất bại');
				}
				return res.json();
			})();
			const delayPromise = new Promise((resolve) => setTimeout(resolve, 2000));
			const [updated] = await Promise.all([requestPromise, delayPromise]);
			setCampaigns((list) => list.map((e) => (e.id === id ? { ...e, ...updated } : e)));
			setError(null);
			setEditingId(null);
			setEditOpen(false);
			setSnackbarMsg('Cập nhật chiến dịch thành công');
			setSnackbarOpen(true);
			await fetchMyEvents();
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Box className={`campaign-join-page`} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 'calc(100vh - 66px)' }}>
			<Snackbar
				open={snackbarOpen}
				autoHideDuration={2000}
				onClose={(_, reason) => { if (reason === 'clickaway') return; setSnackbarOpen(false); }}
				anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
				TransitionComponent={Fade}
				transitionDuration={{ enter: 250, exit: 200 }}
				sx={{ top: 4 }}
			>
				<Alert severity="success" variant="filled" sx={{ px: 2, py: 1, borderRadius: 1.5, boxShadow: 2 }}>
					{snackbarMsg}
				</Alert>
			</Snackbar>
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
					Chiến dịch của tôi
				</Typography>
				<Box sx={{ position: 'relative' }}>
					<Box sx={{ position: 'absolute', top: 12, right: 12 }}>
						<Button variant="contained" color="primary" onClick={openCreateDialog} sx={{ textTransform: 'none', fontWeight: 600 }}>
							Tạo chiến dịch mới
						</Button>
					</Box>
				</Box>
				<Box sx={{ p: { xs: 1.5, sm: 2 },mt: 4 }}>
					
				{loading ? (
					<Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
						<CircularProgress size={22} />
						<Typography>Đang tải...</Typography>
					</Box>
				) : error ? (
					<Typography color="error">{error}</Typography>
				) : campaigns.length === 0 ? (
					<Typography>Chưa có chiến dịch nào.</Typography>
				) : (
					<List>
						{campaigns.slice(page * pageSize, page * pageSize + pageSize).map((ev) => {
							const rawStatus = ev.approval_status || ev.status;
							const st = approvalLabel(rawStatus);
							const title = ev.title || ev.name || `Chiến dịch #${ev.id}`;
							const locationName = ev.location?.name || '';
							return (
								<React.Fragment key={ev.id}>
									<ListItem
										className={`scj-item scj-${(rawStatus || '').toLowerCase()}`}
										sx={{ position: 'relative' }}
										secondaryAction={
											<Box sx={{ display: 'flex', gap: 1 }}>
												<Button
													size="small"
													variant="contained"
													onClick={() => navigate(`/events/${ev.id}`)}
													sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
												>
													Xem chi tiết
												</Button>
												{/* Only allow edit for campaigns owned by current user */}
												{(() => {
													let canEdit = false;
													try {
														const u = localStorage.getItem('user');
														const parsed = u ? JSON.parse(u) : null;
														const currentUserId = parsed?.id ?? null;
														const managerId = ev?.manager?.id ?? ev?.manager_id ?? null;
														const creatorId = ev?.creator_id ?? ev?.created_by ?? ev?.user_id ?? null;
														canEdit = currentUserId && (managerId === currentUserId || creatorId === currentUserId);
													} catch {}
													if (!canEdit) return null;
													return editingId === ev.id ? (
														<Button size="small" variant="outlined" startIcon={<CloseIcon />} disabled={saving} onClick={cancelEditing} sx={{ textTransform: 'none', fontWeight: 600 }}>
															Đóng
														</Button>
													) : (
														<Button
															size="small"
															variant="outlined"
															startIcon={<EditIcon />}
															onClick={() => startEditing(ev)}
															sx={{ textTransform: 'none', fontWeight: 600 }}
														>
															Chỉnh sửa
														</Button>
													);
												})()}
											</Box>
										}
									>
										{/* Only allow delete for campaigns owned by current user */}
										{(() => {
											let canDelete = false;
											try {
												const u = localStorage.getItem('user');
												const parsed = u ? JSON.parse(u) : null;
												const currentUserId = parsed?.id ?? null;
												const managerId = ev?.manager?.id ?? ev?.manager_id ?? null;
												const creatorId = ev?.creator_id ?? ev?.created_by ?? ev?.user_id ?? null;
												canDelete = currentUserId && (managerId === currentUserId || creatorId === currentUserId);
											} catch {}
											if (!canDelete) return null;
											return (
												<Tooltip title="Xóa chiến dịch">
													<IconButton
														size="small"
														onClick={() => openDeleteConfirm(ev.id)}
														sx={{ position: 'absolute', top: 6, right: 6, color: '#b91c1c', '&:hover': { bgcolor: '#fecaca' } }}
													>
														<CloseIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											);
										})()}
										<ListItemText
											primary={
												<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
													{ev.banner_url ? (
														<Box component="img" src={ev.banner_url} alt={title} sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
													) : (
														<Box sx={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontWeight: 700, border: '1px solid #e2e8f0' }} aria-label="no-thumbnail">
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
														{ev.start_time ? <span>{' — vào '}{fmtStartTime(ev.start_time)}</span> : null}
													</Typography>
												) : undefined
											}
										/>
									</ListItem>
									{editingId === ev.id && (
										<Dialog open={editOpen} onClose={cancelEditing} fullWidth maxWidth="md" PaperProps={{ sx: { overflow: 'visible' } }}>
											<DialogTitle sx={{ bgcolor: '#0ea5e9', color: '#fff', px: 2, pt: 2.5, pb: 3, mb: 0 }}>Chỉnh sửa chiến dịch</DialogTitle>
											<DialogContent sx={{ mt: 2, pt: 3 }}>
												<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, overflow: 'visible' }}>
													<TextField label="Tiêu đề" value={form.title} onChange={(e) => onFormChange('title', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth sx={{ mt: 1.5 }} />
													<TextField label="Thể loại (category_id)" value={form.category_id} onChange={(e) => onFormChange('category_id', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth sx={{ mt: 1.5 }} />
													<TextField label="Địa điểm (location_id)" value={form.location_id} onChange={(e) => onFormChange('location_id', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label="Số lượng" value={form.capacity} onChange={(e) => onFormChange('capacity', e.target.value)} fullWidth />
													<TextField label="Banner URL" value={form.banner_url} onChange={(e) => onFormChange('banner_url', e.target.value)} fullWidth />
													<TextField label="Bắt đầu" type="datetime-local" value={form.start_time} onChange={(e) => onFormChange('start_time', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label="Kết thúc" type="datetime-local" value={form.end_time} onChange={(e) => onFormChange('end_time', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label="Mô tả" value={form.description} onChange={(e) => onFormChange('description', e.target.value)} multiline minRows={3} sx={{ gridColumn: { sm: '1 / -1' } }} fullWidth />
												</Box>
												<Typography sx={{ color: 'error.main', mt: 1 }}>{error}</Typography>
											</DialogContent>
											<DialogActions>
												<Button onClick={cancelEditing} startIcon={<CloseIcon />} disabled={saving}>Hủy</Button>
												<Button onClick={() => saveChanges(ev.id)} variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <DoneAllIcon />} disabled={saving}>
													{saving ? 'Đang lưu...' : 'Lưu'}
												</Button>
											</DialogActions>
										</Dialog>
									)}
								</React.Fragment>
							);
						})}
					</List>
				)}
				</Box>
			{/* Bottom pagination controls */}
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5 }}>
				<IconButton
					size="small"
					onClick={() => setPage(p => Math.max(p - 1, 0))}
					disabled={page === 0}
					aria-label="Trang trước"
				>
					<KeyboardArrowLeftIcon />
				</IconButton>
				<Box sx={{ px: 1, py: 0.5, borderRadius: 1}}>
					<Typography sx={{ fontSize: { xs: '.85rem', sm: '.9rem' } }}>
						Trang {page + 1} / {Math.max(1, Math.ceil(campaigns.length / pageSize))}
					</Typography>
				</Box>
				<IconButton
					size="small"
					onClick={() => setPage(p => (p + 1 < Math.ceil(campaigns.length / pageSize) ? p + 1 : p))}
					disabled={page + 1 >= Math.ceil(campaigns.length / pageSize)}
					aria-label="Trang sau"
				>
					<KeyboardArrowRightIcon />
				</IconButton>
			</Box>
			</Paper>
			{/* Create new 	campaign dialog */}
			<Dialog open={createOpen} onClose={closeCreateDialog} fullWidth maxWidth="md">
				<DialogTitle sx={{ bgcolor: '#0ea5e9', color: '#fff', px: 2, pt: 2.5, pb: 2, mb: 0 }}>Tạo chiến dịch mới</DialogTitle>
				<DialogContent sx={{ pt: 2 }}>
					<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
						<TextField label="Tiêu đề" value={createForm.title} onChange={(e) => onCreateChange('title', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mt: 2 }}/>
						<TextField label="Thể loại (category_id)" type="number" value={createForm.category_id} onChange={(e) => onCreateChange('category_id', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mt: 2 }} />
						<TextField label="Ngày bắt đầu" type="datetime-local" value={createForm.start_time} onChange={(e) => onCreateChange('start_time', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Ngày kết thúc" type="datetime-local" value={createForm.end_time} onChange={(e) => onCreateChange('end_time', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Sức chứa" type="number" value={createForm.capacity} onChange={(e) => onCreateChange('capacity', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Địa điểm - Tên" value={createForm.location.name} onChange={(e) => onCreateChange('location.name', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Địa điểm - Số đường" value={createForm.location.address_line} onChange={(e) => onCreateChange('location.address_line', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Quận/Huyện" value={createForm.location.district} onChange={(e) => onCreateChange('location.district', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Tỉnh/Thành phố" value={createForm.location.province} onChange={(e) => onCreateChange('location.province', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label="Quốc gia" value={createForm.location.country} onChange={(e) => onCreateChange('location.country', e.target.value)} InputLabelProps={{ shrink: true }} />
					</Box>
					<TextField sx={{ mt: 2 }} multiline minRows={3} label="Mô tả" value={createForm.description} onChange={(e) => onCreateChange('description', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
					{/* Banner upload moved below description */}
					<Box sx={{ mt: 2 }}>
						<Typography variant="subtitle2" sx={{ mb: 0.5 }}>Ảnh banner</Typography>
						<input
							id="banner-input"
							type="file"
							accept="image/*"
							style={{ display: 'none' }}
							onChange={(e) => {
								const files = e.target.files ? Array.from(e.target.files) : [];
								setBannerFile(files[0] || null);
							}}
						/>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<Button variant="outlined" onClick={() => document.getElementById('banner-input')?.click()} sx={{ textTransform: 'none' }}>
								Chọn ảnh
							</Button>
							{bannerFile && (
								<Button variant="text" color="error" sx={{ textTransform: 'none' }} onClick={() => setBannerFile(null)}>
									Xóa ảnh
								</Button>
							)}
						</Box>
						{bannerPreview && (
							<Box sx={{ mt: 1 }}>
								<Box component="img" src={bannerPreview} alt="banner-preview" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1.5, border: '1px solid #e5e7eb' }} />
							</Box>
						)}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeCreateDialog} disabled={creating}>Hủy</Button>
					<Button onClick={submitCreate} variant="contained" disabled={creating}>
						{creating ? <CircularProgress size={20} /> : 'Tạo'}
					</Button>
				</DialogActions>
			</Dialog>
			<Dialog open={deleteOpen} onClose={closeDeleteConfirm} maxWidth="xs" fullWidth>
				<DialogTitle>Xóa chiến dịch</DialogTitle>
				<DialogContent>
					<Typography>Bạn có chắc chắn muốn xóa không?</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeDeleteConfirm} disabled={deleting}>Hủy</Button>
					<Button onClick={confirmDelete} color="error" variant="contained" disabled={deleting} startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}>
						{deleting ? 'Đang xóa...' : 'Xóa'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>

			
			
	);
};

export default ManageMyCampaign;
