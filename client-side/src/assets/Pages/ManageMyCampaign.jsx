import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Box, Typography, Button, CircularProgress, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Fade, IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CloseIcon from '@mui/icons-material/Close';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { useNavigate, useLocation } from 'react-router-dom';
import { isTokenExpired, clearAuth } from '../utils/auth';
import './ShowCampaignJoin.css';

// Using shared auth helpers from ../utils/auth

// Helper: format a UTC datetime string into 'YYYY-MM-DDTHH:MM' at GMT+7 for input[type="datetime-local"]
function formatInputGmtPlus7(utcLike) {
	if (!utcLike) return '';
	const d = new Date(utcLike);
	if (Number.isNaN(d.getTime())) return '';
	// shift to GMT+7 by adding 7 hours to the UTC time
	const shifted = new Date(d.getTime() + 7 * 60 * 60 * 1000);
	const pad = (n) => String(n).padStart(2, '0');
	const yyyy = shifted.getUTCFullYear();
	const mm = pad(shifted.getUTCMonth() + 1);
	const dd = pad(shifted.getUTCDate());
	const hh = pad(shifted.getUTCHours());
	const mi = pad(shifted.getUTCMinutes());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function approvalLabel(status, t) {
	const s = (status || '').toLowerCase();
	if (s === 'active') {
		return { text: t('manageMy.status.approved'), color: 'success', variant: 'filled', icon: <CheckCircleIcon fontSize="small" /> };
	}
	if (s === 'rejected') {
		return { text: t('manageMy.status.rejected'), color: 'error', variant: 'filled', icon: <CancelIcon fontSize="small" /> };
	}
	return { text: t('manageMy.status.pending'), color: 'warning', variant: 'filled', icon: <HourglassBottomIcon fontSize="small" /> };
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
	const { t } = useTranslation();
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
	const [snackbarSeverity, setSnackbarSeverity] = useState('success'); // 'success' or 'warning'
	// Local errors to keep forms open and avoid replacing list UI
	const [createError, setCreateError] = useState('');
	const [editError, setEditError] = useState('');
	const navigate = useNavigate();
	const location = useLocation();

	// Role guard: only allow EVENT_MANAGER to access this page
	useEffect(() => {
		try {
			const token = localStorage.getItem('token');
			const userStr = localStorage.getItem('user');
			if (!token || !userStr) {
				navigate('/login', { replace: true });
				return;
			}
			// Redirect to login if token is expired
			if (isTokenExpired(token)) {
				clearAuth();
				navigate('/login', { replace: true });
				return;
			}
			const user = JSON.parse(userStr);
			const roles =  String(user.roles[0].role.name);
			const isEventManager = roles.includes('EVENT_MANAGER');
			if (!isEventManager) {
				navigate('/', { replace: true });
			}
		} catch {
			navigate('/', { replace: true });
		}
	}, [navigate]);

	// Pagination: show max 3 events per page
	const [page, setPage] = useState(0);
	const pageSize = 10;

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
	const [categories, setCategories] = useState([]);
	// Edit dialog banner + location fields (to mirror create)
	const [editBannerFile, setEditBannerFile] = useState(null);
	const [editBannerPreview, setEditBannerPreview] = useState('');
	const [editLocation, setEditLocation] = useState({ name: '', address_line: '', district: '', province: '', country: 'Việt Nam' });

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

	// Preview for edit banner
	useEffect(() => {
		if (!editBannerFile) {
			if (editBannerPreview) {
				try { URL.revokeObjectURL(editBannerPreview); } catch {}
			}
			setEditBannerPreview('');
			return;
		}
		const url = URL.createObjectURL(editBannerFile);
		setEditBannerPreview((prev) => {
			if (prev) { try { URL.revokeObjectURL(prev); } catch {} }
			return url;
		});
		return () => { try { URL.revokeObjectURL(url); } catch {} };
	}, [editBannerFile]);

	const openCreateDialog = () => { setCreateOpen(true); setCreateError(''); };
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
			setCreateError('');
			// Front-end required validation (all fields except banner)
			const requiredCreateFields = [
				createForm.title?.trim(),
				createForm.description?.trim(),
				createForm.category_id,
				createForm.start_time,
				createForm.end_time,
				createForm.capacity,
				createForm.location.name?.trim(),
				createForm.location.address_line?.trim(),
				createForm.location.district?.trim(),
				createForm.location.province?.trim(),
				createForm.location.country?.trim(),
			];
			if (requiredCreateFields.some((v) => v === '' || v === undefined || v === null)) {
				const msg = t('manageMy.errors.requiredAll');
				setCreateError(msg);
				setSnackbarMsg(msg);
				setSnackbarSeverity('warning');
				setSnackbarOpen(true);
				setCreating(false);
				return;
			}
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
				let msg = t('manageMy.errors.createFailed');
				try {
					const j = await resp.json();
					msg = j?.error || msg;
				} catch {
					try { msg = await resp.text() || msg; } catch {}
				}
				setCreateError(msg);
				setSnackbarMsg(msg);
				setSnackbarSeverity('warning');
				setSnackbarOpen(true);
				throw new Error(msg);
			}
			setSnackbarMsg(t('manageMy.success.create'));
			setSnackbarSeverity('success');
			setSnackbarOpen(true);
			closeCreateDialog();
			await fetchMyEvents();
		} catch (e) {
			setSnackbarMsg(e.message || t('manageMy.errors.createGeneric'));
			setSnackbarSeverity('warning');
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
				if (!res.ok) throw new Error(t('manageMy.errors.fetchMine'));
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

	// Load categories for selection in create dialog
	useEffect(() => {
		const token = localStorage.getItem('token');
		if (!token) return;
		fetch('http://localhost:4000/categories', {
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		})
			.then(res => res.ok ? res.json() : [])
			.then(data => {
				if (Array.isArray(data)) setCategories(data);
			})
			.catch(() => {});
	}, []);

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
			// Database stores UTC; display as GMT+7 in the input
			start_time: ev.start_time ? formatInputGmtPlus7(ev.start_time) : '',
			end_time: ev.end_time ? formatInputGmtPlus7(ev.end_time) : '',
			capacity: ev.capacity ?? '',
			banner_url: ev.banner_url ?? '',
		});
		// initialize edit location fields from event.location if available
		setEditLocation({
			name: ev.location?.name || '',
			address_line: ev.location?.address_line || '',
			district: ev.location?.district || '',
			province: ev.location?.province || '',
			country: ev.location?.country || 'Việt Nam',
		});
		setEditBannerFile(null);
		setEditBannerPreview('');
		setEditOpen(true);
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditOpen(false);
		setForm({
			title: '', description: '', category_id: '', location_id: '', start_time: '', end_time: '', capacity: '', banner_url: ''
		});
		setEditLocation({ name: '', address_line: '', district: '', province: '', country: 'Việt Nam' });
		setEditBannerFile(null);
		setEditBannerPreview('');
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
					throw new Error(msg || t('manageMy.errors.deleteFailed'));
				}
				return true;
			})();
			const delayPromise = new Promise((resolve) => setTimeout(resolve, 2000));
			await Promise.all([requestPromise, delayPromise]);
			setCampaigns((list) => list.filter((e) => e.id !== deleteId));
			setSnackbarMsg(t('manageMy.success.delete'));
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
			const msg = t('manageMy.errors.requiredPartial');
			setEditError(msg);
			setSnackbarMsg(msg);
			setSnackbarSeverity('warning');
			setSnackbarOpen(true);
			return;
		}
		// Additional front-end required validation for edit (all fields except banner)
		const requiredEditFields = [
			form.title?.trim(),
			form.description?.trim(),
			form.category_id,
			form.location_id,
			form.start_time,
			form.end_time,
			form.capacity,
		];
		if (requiredEditFields.some((v) => v === '' || v === undefined || v === null)) {
			const msg = t('manageMy.errors.requiredAll');
			setEditError(msg);
			setSnackbarMsg(msg);
			setSnackbarSeverity('warning');
			setSnackbarOpen(true);
			setSaving(false);
			return;
		}
		// Validate capacity against current participants (submit-time only)
		try {
			const ev = campaigns.find((e) => e.id === id);
			const totalJoined = Number(
				ev?.total_joined ??
				ev?.totalJoined ??
				ev?.participants_count ??
				ev?.registrations_count ??
				0
			);
			const currentTotal = Number(form.capacity || 0) + totalJoined;
				if (currentTotal < totalJoined) {
					const msg = t('manageMy.validate.capacityTooSmall');
				setEditError(msg);
				setSnackbarMsg(msg);
				setSnackbarSeverity('warning');
				setSnackbarOpen(true);
				return;
			}
		} catch {}

		setSaving(true);
		try {
			// If user selected a new banner file, send multipart/form-data so backend can replace image
			const requestPromise = (async () => {
				let res;
				if (editBannerFile) {
					const formData = new FormData();
					formData.append('title', form.title || '');
					formData.append('description', form.description || '');
					formData.append('category_id', String(Number(form.category_id)));
					formData.append('location_id', String(Number(form.location_id)));
					formData.append('start_time', new Date(form.start_time).toISOString());
					formData.append('end_time', new Date(form.end_time).toISOString());
					if (form.capacity) formData.append('capacity', String(Number(form.capacity)));
					formData.append('banner', editBannerFile);
					res = await fetch(`http://localhost:4000/events/${id}`, {
						method: 'PUT',
						headers: { Authorization: `Bearer ${token}` },
						body: formData,
					});
				} else {
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
					res = await fetch(`http://localhost:4000/events/${id}`, {
						method: 'PUT',
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(payload)
					});
				}
				if (!res.ok) {
					let msg = t('manageMy.errors.updateFailed');
					try {
						const j = await res.json();
						msg = j?.error || msg;
					} catch {
						try { msg = await res.text() || msg; } catch {}
					}
					setEditError(msg);
					setSnackbarMsg(msg);
					setSnackbarSeverity('warning');
					setSnackbarOpen(true);
					throw new Error(msg);
				}
				return res.json();
			})();
			const delayPromise = new Promise((resolve) => setTimeout(resolve, 2000));
			const [updated] = await Promise.all([requestPromise, delayPromise]);
			setCampaigns((list) => list.map((e) => (e.id === id ? { ...e, ...updated } : e)));
			setError(null);
			setEditingId(null);
			setEditOpen(false);
			setEditBannerFile(null);
			setEditBannerPreview('');
			setSnackbarMsg(t('manageMy.success.update'));
			setSnackbarSeverity('success');
			setSnackbarOpen(true);
			await fetchMyEvents();
		} catch (err) {
			const msg = err?.message || t('manageMy.errors.updateGeneric');
			setSnackbarMsg(msg);
			setSnackbarSeverity('warning');
			setSnackbarOpen(true);
		} finally {
			setSaving(false);
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
				<h2 className="text-2xl md:text-5xl font-bold text-center ">{t('manageMy.title')}</h2>
				<p className="w-2/3 mx-auto md:text-lg mt-4 text-center leading-relaxed ">{t('manageMy.subtitle')}</p>
			</div>
			<div className={`bvf-animate ${mounted ? 'in-view' : ''}`}>
				{/* Header row: left button + right total */}
				<Box sx={{ px: { xs: 1.5, sm: 2 }, mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
					<Button variant="contained" color="primary" onClick={openCreateDialog} startIcon={<PostAddIcon />} sx={{ textTransform: 'none', fontWeight: 600,ml: { xs: 2, sm: 15 } }}>
						{t('manageMy.actions.create')}
					</Button>
					<Typography sx={{ fontWeight: 600, mr: { xs: 2, sm: 15 }}}>
						{t('manageMy.total', { count: campaigns.length })}
					</Typography>
				</Box>
				<Box sx={{ p: { xs: 1.5, sm: 2 },mt: 0 }}>
					
				{loading ? (
					<Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
						<CircularProgress size={22} />
						<Typography>{t('manageMy.loading')}</Typography>
					</Box>
				) : error ? (
					<Typography color="error">{error}</Typography>
				) : campaigns.length === 0 ? (
					<div className="container mx-auto mt-6">
						<div className="hidden md:block p-2">
							<div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
								<table className="min-w-full border-collapse bg-white">
									<thead>
										<tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
											<th className="px-4 py-3 text-left rounded-tl-xl">{t('manageMy.headers.number')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.campaign')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.status')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.time')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.location')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.joined')}</th>
											<th className="px-4 py-3 text-center rounded-tr-xl">{t('manageMy.headers.actions')}</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td colSpan={7} className="px-4 py-6 text-center text-gray-600">{t('manageMy.empty')}</td>
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
											<th>{t('manageMy.headers.campaign')}</th>
											<th>{t('manageMy.headers.time')}</th>
											<th>{t('manageMy.buttons.viewDetails')}</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td colSpan={3} className="px-4 py-4 text-center">{t('manageMy.empty')}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				) : (
					<div className="container mx-auto mt-6">
						<div className="hidden md:block p-4">
							<div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
								<table className="min-w-full border-collapse bg-white">
									<thead>
										<tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
											<th className="px-4 py-3 text-left rounded-tl-xl">{t('manageMy.headers.number')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.campaign')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.status')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.time')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.location')}</th>
											<th className="px-4 py-3 text-left">{t('manageMy.headers.joined')}</th>
											<th className="px-4 py-3 text-center rounded-tr-xl">{t('manageMy.headers.actions')}</th>
										</tr>
									</thead>
									<tbody>
						{campaigns.slice(page * pageSize, page * pageSize + pageSize).map((ev, idx) => {
							const rawStatus = ev.approval_status || ev.status;
							const st = approvalLabel(rawStatus, t);
							const title = ev.title || ev.name || `Chiến dịch #${ev.id}`;
							const locationName = ev.location?.name || '';
                            const totalJoined = Number(
                                ev?.total_joined ??
                                ev?.totalJoined ??
                                ev?.participants_count ??
                                ev?.registrations_count ??
                                0
                            );
							return (
								<React.Fragment key={ev.id}>
									<tr className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
										<td className="px-4 py-3 font-medium text-gray-700 text-left">{page * pageSize + idx + 1}</td>
										<td className="px-4 py-3 font-semibold text-gray-800 text-left">{title}</td>
										<td className="px-4 py-3 text-gray-700 text-left">{st.text}</td>
										<td className="px-4 py-3 text-gray-700 text-left">{ev.start_time ? fmtStartTime(ev.start_time) : ''}</td>
										<td className="px-4 py-3 text-gray-700 text-left">{locationName}</td>
										<td className="px-4 py-3 text-gray-700 text-left">{totalJoined}</td>
										<td className="px-4 py-3 text-center whitespace-nowrap">
											<div className="flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap overflow-x-auto">
												<Button
													size="small"
													variant="contained"
													onClick={() => navigate(`/events/${ev.id}`)}
													disabled={String(rawStatus || '').toLowerCase() === 'pending' || String(rawStatus || '').toLowerCase() === 'rejected'}
													sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
												>
													{t('manageMy.buttons.viewDetails')}
												</Button>
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
															{t('manageMy.buttons.close')}
														</Button>
													) : (
														<Button
															size="small"
															variant="contained"
															startIcon={<EditIcon />}
															onClick={() => startEditing(ev)}
															sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
														>
															{t('manageMy.buttons.edit')}
														</Button>
													);
												})()}
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
														<Tooltip title={t('manageMy.tooltip.delete')}>
															<IconButton
																size="small"
																onClick={() => openDeleteConfirm(ev.id)}
																sx={{ color: '#b91c1c', '&:hover': { bgcolor: '#fecaca' } }}
															>
																<CloseIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													);
												})()}
											</div>
										</td>
									</tr>
									{editingId === ev.id && (
										<Dialog open={editOpen} onClose={cancelEditing} fullWidth maxWidth="md" PaperProps={{ sx: { overflow: 'visible' } }}>
											<DialogTitle sx={{ bgcolor: '#0ea5e9', color: '#fff', px: 2, pt: 2.5, pb: 3, mb: 0 }}>{t('manageMy.dialog.edit.title')}</DialogTitle>
											<DialogContent sx={{ mt: 2, pt: 3 }}>
												<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, overflow: 'visible' }}>
													{/* Title and Category */}
													<TextField label={t('manageMy.labels.title')} value={form.title} onChange={(e) => onFormChange('title', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth sx={{ mt: 1.5 }} />
													<FormControl fullWidth sx={{ mt: 1.5 }}>
														<InputLabel id="edit-category-select-label">{t('manageMy.labels.category')}</InputLabel>
														<Select
															labelId="edit-category-select-label"
															label={t('manageMy.labels.category')}
															value={form.category_id}
															onChange={(e) => onFormChange('category_id', e.target.value)}
														>
															{categories.map((c) => (
																<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
															))}
														</Select>
													</FormControl>

													{/* Start and End time directly under title/category */}
													<TextField label={t('manageMy.labels.start')} type="datetime-local" value={form.start_time} onChange={(e) => onFormChange('start_time', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label={t('manageMy.labels.end')} type="datetime-local" value={form.end_time} onChange={(e) => onFormChange('end_time', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />

													{/* Capacity displays as (capacity + total_joined); editing adjusts capacity accordingly */}
													<TextField
														label={t('manageMy.labels.capacity')}
														type="number"
														value={Number(form.capacity || 0) + totalJoined}
														onChange={(e) => {
															const total = Number(e.target.value);
															// Map typed total back to capacity; allow editing freely
															const newCapacity = Number.isFinite(total) ? total - totalJoined : 0;
															onFormChange('capacity', String(newCapacity));
														}}
														InputLabelProps={{ shrink: true }}
														fullWidth
													/>

													{/* Location fields to mirror create dialog */}
													<TextField label={t('manageMy.labels.locationName')} value={editLocation.name} onChange={(e) => setEditLocation((p) => ({ ...p, name: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label={t('manageMy.labels.addressLine')} value={editLocation.address_line} onChange={(e) => setEditLocation((p) => ({ ...p, address_line: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label={t('manageMy.labels.district')} value={editLocation.district} onChange={(e) => setEditLocation((p) => ({ ...p, district: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label={t('manageMy.labels.province')} value={editLocation.province} onChange={(e) => setEditLocation((p) => ({ ...p, province: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
													<TextField label={t('manageMy.labels.country')} value={editLocation.country} onChange={(e) => setEditLocation((p) => ({ ...p, country: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />

													{/* Description spanning full width */}
													<TextField label={t('manageMy.labels.description')} value={form.description} onChange={(e) => onFormChange('description', e.target.value)} multiline minRows={3} sx={{ gridColumn: { sm: '1 / -1' } }} fullWidth />

													{/* Banner upload moved to bottom under description */}
													<Box sx={{ gridColumn: { sm: '1 / -1' } }}>
														<Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('manageMy.labels.banner')}</Typography>
														<input
															id={`edit-banner-input-${ev.id}`}
															type="file"
															accept="image/*"
															style={{ display: 'none' }}
															onChange={(e) => {
																const files = e.target.files ? Array.from(e.target.files) : [];
																setEditBannerFile(files[0] || null);
															}}
														/>
														<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
															<Button variant="outlined" onClick={() => document.getElementById(`edit-banner-input-${ev.id}`)?.click()} sx={{ textTransform: 'none' }}>
																{t('manageMy.buttons.chooseImage')}
															</Button>
															{editBannerFile && (
																<Button variant="text" color="error" sx={{ textTransform: 'none' }} onClick={() => setEditBannerFile(null)}>
																	{t('manageMy.buttons.removeImage')}
																</Button>
															)}
														</Box>
														{/* Show new preview if selected, else current event banner */}
														<Box sx={{ mt: 1 }}>
															{editBannerPreview ? (
																<Box component="img" src={editBannerPreview} alt="banner-preview" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1.5, border: '1px solid #e5e7eb' }} />
															) : (
																form.banner_url ? (
																	<Box component="img" src={form.banner_url} alt="current-banner" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1.5, border: '1px solid #e5e7eb' }} />
																) : null
															)}
														</Box>
													</Box>
												</Box>
												{editError ? (
													<Typography sx={{ color: 'error.main', mt: 1 }}>{editError}</Typography>
												) : null}
											</DialogContent>
											<DialogActions>
												<Button onClick={cancelEditing} startIcon={<CloseIcon />} disabled={saving}>{t('manageMy.buttons.cancel')}</Button>
												<Button onClick={() => saveChanges(ev.id)} variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <DoneAllIcon />} disabled={saving}>
													{saving ? t('manageMy.states.saving') : t('manageMy.buttons.save')}
												</Button>
											</DialogActions>
										</Dialog>
									)}
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
											<th>{t('manageMy.headers.campaign')}</th>
											<th>{t('manageMy.headers.time')}</th>
											<th>{t('manageMy.buttons.viewDetails')}</th>
										</tr>
									</thead>
									<tbody>
										{campaigns.slice(page * pageSize, page * pageSize + pageSize).map((ev) => {
											const title = ev.title || ev.name || `Chiến dịch #${ev.id}`;
											return (
												<tr className="border border-gray-300" key={`m-${ev.id}`}>
													<td>{title}</td>
													<td>{ev.start_time ? fmtStartTime(ev.start_time) : ''}</td>
													<td>
														<Button
															size="small"
															variant="contained"
															onClick={() => navigate(`/events/${ev.id}`)}
															sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#15803d', boxShadow: 'none' } }}
														>
															{t('manageMy.buttons.view')}
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
			{/* Bottom pagination controls */}
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5 }}>
				<IconButton
					size="small"
					onClick={() => setPage(p => Math.max(p - 1, 0))}
					disabled={page === 0}
					aria-label={t('manageMy.pagination.prev')}
				>
					<KeyboardArrowLeftIcon />
				</IconButton>
				<Box sx={{ px: 1, py: 0.5, borderRadius: 1}}>
					<Typography sx={{ fontSize: { xs: '.85rem', sm: '.9rem' } }}>
						{t('manageMy.pagination.pageXofY', { current: page + 1, total: Math.max(1, Math.ceil(campaigns.length / pageSize)) })}
					</Typography>
				</Box>
				<IconButton
					size="small"
					onClick={() => setPage(p => (p + 1 < Math.ceil(campaigns.length / pageSize) ? p + 1 : p))}
					disabled={page + 1 >= Math.ceil(campaigns.length / pageSize)}
					aria-label={t('manageMy.pagination.next')}
				>
					<KeyboardArrowRightIcon />
				</IconButton>
			</Box>
			</div>
			{/* Create new 	campaign dialog */}
			<Dialog open={createOpen} onClose={closeCreateDialog} fullWidth maxWidth="md">
				<DialogTitle sx={{ bgcolor: '#2563eb', color: '#fff', px: 2, pt: 2.5, pb: 2, mb: 0 }}>{t('manageMy.dialog.create.title')}</DialogTitle>
				<DialogContent sx={{ pt: 2 }}>
					<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
						<TextField label={t('manageMy.labels.title')} value={createForm.title} onChange={(e) => onCreateChange('title', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mt: 2 }}/>
						<FormControl sx={{ mt: 2 }}>
							<InputLabel id="category-select-label">{t('manageMy.labels.category')}</InputLabel>
							<Select
								labelId="category-select-label"
								label={t('manageMy.labels.category')}
								value={createForm.category_id}
								onChange={(e) => onCreateChange('category_id', e.target.value)}
							>
								{categories.map((c) => (
									<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
								))}
							</Select>
						</FormControl>
						<TextField label={t('manageMy.labels.startDate')} type="datetime-local" value={createForm.start_time} onChange={(e) => onCreateChange('start_time', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.endDate')} type="datetime-local" value={createForm.end_time} onChange={(e) => onCreateChange('end_time', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.capacityAlt')} type="number" value={createForm.capacity} onChange={(e) => onCreateChange('capacity', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.locationName')} value={createForm.location.name} onChange={(e) => onCreateChange('location.name', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.addressLine')} value={createForm.location.address_line} onChange={(e) => onCreateChange('location.address_line', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.district')} value={createForm.location.district} onChange={(e) => onCreateChange('location.district', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.province')} value={createForm.location.province} onChange={(e) => onCreateChange('location.province', e.target.value)} InputLabelProps={{ shrink: true }} />
						<TextField label={t('manageMy.labels.country')} value={createForm.location.country} onChange={(e) => onCreateChange('location.country', e.target.value)} InputLabelProps={{ shrink: true }} />
					</Box>
					<TextField sx={{ mt: 2 }} multiline minRows={3} label={t('manageMy.labels.description')} value={createForm.description} onChange={(e) => onCreateChange('description', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
					{createError ? (
						<Typography sx={{ color: 'error.main', mt: 1 }}>{createError}</Typography>
					) : null}
					{/* Banner upload moved below description */}
					<Box sx={{ mt: 2 }}>
						<Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('manageMy.labels.banner')}</Typography>
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
								{t('manageMy.buttons.chooseImage')}
							</Button>
							{bannerFile && (
								<Button variant="text" color="error" sx={{ textTransform: 'none' }} onClick={() => setBannerFile(null)}>
									{t('manageMy.buttons.removeImage')}
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
					<Button onClick={closeCreateDialog} disabled={creating}>{t('manageMy.buttons.cancel')}</Button>
					<Button onClick={submitCreate} variant="contained" disabled={creating}>
						{creating ? <CircularProgress size={20} /> : t('manageMy.buttons.create')}
					</Button>
				</DialogActions>
			</Dialog>
			<Dialog open={deleteOpen} onClose={closeDeleteConfirm} maxWidth="xs" fullWidth>
				<DialogTitle>{t('manageMy.dialog.delete.title')}</DialogTitle>
				<DialogContent>
					<Typography>{t('manageMy.dialog.delete.confirm')}</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeDeleteConfirm} disabled={deleting}>{t('manageMy.buttons.cancel')}</Button>
					<Button onClick={confirmDelete} color="error" variant="contained" disabled={deleting} startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}>
						{deleting ? t('manageMy.states.deleting') : t('manageMy.buttons.delete')}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>

			
			
	);
};

export default ManageMyCampaign;
