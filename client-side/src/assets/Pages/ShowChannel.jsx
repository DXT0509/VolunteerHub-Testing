import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Avatar, Divider, Snackbar, Alert, Slide, IconButton, Tooltip } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from 'react';
import './ShowChannel.css';
// Stable transition component defined outside so MUI can properly animate exit
const SlideFromTop = React.forwardRef(function SlideFromTop(props, ref) {
    return <Slide ref={ref} {...props} direction="down" timeout={{ enter: 400, exit: 350 }} />;
});

function ShowChannel() {
    const [data, setData] = useState(null);
    const [openCreate, setOpenCreate] = useState(false);
    const [content, setContent] = useState('');
    // removed attachments URL fields: users will upload files from their machine only
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [openComments, setOpenComments] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState('success'); // 'success' | 'warning'
    const [showAlert, setShowAlert] = useState(false);
    const { id } = useParams();
    const navigate = useNavigate();
    const [allowed, setAllowed] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletePostId, setDeletePostId] = useState(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const pageSize = 10;

    // Redirect to login if not authenticated
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login', { replace: true, state: { from: `/exchange-channel/${id}` } });
        }
    }, [id, navigate]);

    // If logged in but not approved (joined) for this event, kick back to event detail
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // handled by previous effect
        // Fetch user registrations and check status for this event id
        fetch('http://localhost:4000/registrations/my', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.ok ? res.json() : [])
        .then(list => {
            const reg = Array.isArray(list) ? list.find(r => String(r.event_id) === String(id)) : null;
            if (!reg || reg.status !== 'approved') {
                // Optionally could show a warning alert before redirect; for now redirect immediately.
                navigate(`/events/${id}`, { replace: true, state: { reason: 'not_joined' } });
            }
        })
        .catch(() => {
            // On error, be safe and redirect back
            navigate(`/events/${id}`, { replace: true, state: { reason: 'check_failed' } });
        });
    }, [id, navigate]);
    const fetchPostsPaged = useCallback((p) => {
        const token = localStorage.getItem('token');
        const targetPage = typeof p === 'number' ? p : page;
        fetch(`http://localhost:4000/channels/${id}/posts?page=${targetPage}&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(d => {
            setData(d);
            setPage(targetPage);
        })
        .catch(err => console.error(err));
    }, [id, page, pageSize]);

    // Fetch when channel id or page changes
    useEffect(() => {
        fetchPostsPaged(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, page]);

    // Scroll to top immediately when page changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [page]);

    const openForm = useCallback(() => {
        // Reset previous form state when opening
        setContent('');
        setOpenCreate(true);
    }, []);
    const closeForm = useCallback(() => setOpenCreate(false), []);
    // generate image previews for selectedFiles using object URLs
    useEffect(() => {
        if (!selectedFiles || selectedFiles.length === 0) {
            // cleanup any existing previews
            setPreviews(prev => {
                prev.forEach(u => URL.revokeObjectURL(u));
                return [];
            });
            return;
        }
        const urls = selectedFiles.map(f => URL.createObjectURL(f));
        // revoke previous previews first
        setPreviews(prev => {
            prev.forEach(u => URL.revokeObjectURL(u));
            return urls;
        });
        // cleanup when unmount or files change
        return () => {
            urls.forEach(u => URL.revokeObjectURL(u));
        };
    }, [selectedFiles]);
    const handleSubmit = useCallback(async (e) => {
        e?.preventDefault();
        // fallback: if selectedFiles state is empty try to read the specific post file input directly
        let filesToSend = selectedFiles;
        if ((!filesToSend || filesToSend.length === 0) && typeof document !== 'undefined') {
            const fileInput = document.getElementById('file-input');
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                filesToSend = Array.from(fileInput.files || []);
                setSelectedFiles(filesToSend);
            }
        }

        if (!content.trim() && (!filesToSend || filesToSend.length === 0)) {
            // Client-side early validation matches backend rule
            setAlertType('warning');
            setAlertMessage('Bài viết phải có nội dung hoặc ít nhất một tệp đính kèm');
            setShowAlert(true);
            return;
        }

        const token = localStorage.getItem('token');
        let res;
        try {
            // Always send FormData. This avoids accidentally sending JSON and missing files.
            const form = new FormData();
            form.append('content', content || '');
            (filesToSend || []).forEach((f) => form.append('files', f));
            res = await fetch(`http://localhost:4000/channels/${id}/posts`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form
            });
        } catch (err) {
            setAlertType('warning');
            setAlertMessage('Lỗi khi tải lên ảnh');
            setShowAlert(true);
            return;
        }

        if (res.ok) {
            setAlertType('success');
            setAlertMessage('Đăng bài thành công');
            setShowAlert(true);
        } else {
            try {
                const data = await res.json();
                const msg = data?.error || 'Đăng bài thất bại';
                setAlertType('warning');
                setAlertMessage(msg);
                setShowAlert(true);
            } catch {
                setAlertType('warning');
                setAlertMessage('Đăng bài thất bại');
                setShowAlert(true);
            }
            return; // Don't refresh/close modal on failure
        }

        // After create, go to first page to see newest post
        setPage(1);
        fetchPostsPaged(1);
        closeForm();
        // reset file inputs
        setSelectedFiles([]);
    }, [closeForm, content, fetchPostsPaged, id]);

    const handleToggleLike = useCallback(async (postId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/channels/like', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ postId })
            });
            if (!res.ok) return;
            const { liked } = await res.json();

            // Update local state for this post's like count and liked status
            setData(prev => {
                if (!prev?.items) return prev;
                return {
                    ...prev,
                    items: prev.items.map(p => {
                        if (p.id !== postId) return p;
                        const delta = liked ? 1 : -1;
                        return {
                            ...p,
                            liked,
                            _count: { ...p._count, likes: (p._count?.likes || 0) + delta }
                        };
                    })
                };
            });
            // Also update selectedPost if it's the one being liked
            setSelectedPost(prev => {
                if (!prev || prev.id !== postId) return prev;
                const delta = liked ? 1 : -1;
                return {
                    ...prev,
                    liked,
                    _count: { ...prev._count, likes: (prev._count?.likes || 0) + delta }
                };
            });
        } catch (e) {
            // noop
        }
    }, []);

    const openCommentsFor = useCallback((post) => {
        setSelectedPost(post);
        setOpenComments(true);
    }, []);
    const closeComments = useCallback(() => setOpenComments(false), []);

    // Apply a newly created comment to both selectedPost and data state
    const applyNewCommentToState = useCallback((postId, cmt) => {
        setSelectedPost(prev => prev && prev.id === postId ? {
            ...prev,
            comments: [...(prev.comments || []), cmt],
            _count: { ...prev._count, comments: (prev._count?.comments || 0) + 1 }
        } : prev);
        setData(prev => {
            if (!prev?.items) return prev;
            return {
                ...prev,
                items: prev.items.map(p => p.id === postId
                    ? { ...p, comments: [...(p.comments || []), cmt], _count: { ...p._count, comments: (p._count?.comments || 0) + 1 } }
                    : p)
            };
        });
    }, []);

    const handleToggleCommentLike = useCallback(async (commentId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/channels/like', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ commentId })
            });
            if (!res.ok) return;
            const { liked } = await res.json();

            setSelectedPost(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    comments: (prev.comments || []).map(c => {
                        if (c.id !== commentId) return c;
                        const curr = c._count?.likes || 0;
                        const delta = liked ? 1 : -1;
                        return { ...c, liked, _count: { ...c._count, likes: Math.max(0, curr + delta) } };
                    })
                };
            });
            setData(prev => {
                if (!prev?.items) return prev;
                return {
                    ...prev,
                    items: prev.items.map(p => ({
                        ...p,
                        comments: (p.comments || []).map(c => {
                            if (c.id !== commentId) return c;
                            const curr = c._count?.likes || 0;
                            const delta = liked ? 1 : -1;
                            return { ...c, liked, _count: { ...c._count, likes: Math.max(0, curr + delta) } };
                        })
                    }))
                };
            });
        } catch (e) {}
    }, []);

    const onSuccess = useCallback((msg) => {
        setAlertType('success');
        setAlertMessage(msg);
        setShowAlert(true);
    }, []);

    const posts = useMemo(() => data?.items || [], [data]);
    const currentUserId = useMemo(() => {
        try {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u)?.id ?? null : null;
        } catch { return null; }
    }, []);

    const requestDeletePost = useCallback((postId) => {
        setDeletePostId(postId);
        setDeleteOpen(true);
    }, []);

    const closeDeleteConfirm = useCallback(() => {
        setDeleteOpen(false);
        setDeletePostId(null);
    }, []);

    const confirmDeletePost = useCallback(async () => {
        if (!deletePostId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:4000/channels/posts/${deletePostId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error('Xóa bài viết thất bại');
            // Refresh current page to keep counts and pagination in sync
            fetchPostsPaged(page);
            setSelectedPost(prev => (prev && prev.id === deletePostId) ? null : prev);
            setOpenComments(prev => (prev && deletePostId) ? false : prev);
            setAlertType('success');
            setAlertMessage('Xóa bài viết thành công');
            setShowAlert(true);
        } catch (e) {
            setAlertType('warning');
            setAlertMessage(e?.message || 'Xóa bài viết thất bại');
            setShowAlert(true);
        } finally {
            closeDeleteConfirm();
        }
    }, [deletePostId, closeDeleteConfirm, fetchPostsPaged, page]);

    // memoize formatRelative to avoid creating a new function on every render
    // (new function identity caused memoized children to re-render and produced typing lag)
    const formatRelative = useCallback((timeString) => {
        try {
            const created = new Date(timeString);
            const now = new Date();
            const diffMs = now.getTime() - created.getTime();
            const minute = 60 * 1000;
            const hour = 60 * minute;
            const day = 24 * hour;
            const month = 30 * day; // approximate
            const year = 365 * day; // approximate
            if (diffMs < minute) return 'vừa xong';
            if (diffMs < hour) return `${Math.floor(diffMs / minute)} phút trước`;
            if (diffMs < day) return `${Math.floor(diffMs / hour)} giờ trước`;
            if (diffMs < month) return `${Math.floor(diffMs / day)} ngày trước`;
            if (diffMs < year) return `${Math.floor(diffMs / month)} tháng trước`;
            return `${Math.floor(diffMs / year)} năm trước`;
        } catch { return ''; }
    }, []);

    // Paging helpers
    const totalItems = data?.total;
    const totalPages = totalItems ? Math.max(1, Math.ceil(totalItems / pageSize)) : null;
    const isFirstPage = page <= 1;
    const isLastPage = totalPages != null ? page >= totalPages : ((data?.items?.length || 0) < pageSize);

    return (
        <Box sx={{ p: 2 }}>
            {/* Placeholder box */}
            <Snackbar
                open={showAlert}
                onClose={(_, reason) => {
                    if (reason === 'clickaway') return;
                    setShowAlert(false);
                }}
                autoHideDuration={2000}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                TransitionComponent={SlideFromTop}
                TransitionProps={{ appear: true }}
                >
                <Alert
                    severity={alertType === 'success' ? 'success' : 'error'}
                    icon={alertType === 'success' ? <CheckCircleIcon fontSize="inherit" /> : <WarningAmberIcon fontSize="inherit" />}
                    variant="filled"
                    sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 1.5,
                        boxShadow: 2,
                        width: '420px',
                        backgroundColor: alertType === 'success' ? '#22c55e' : '#facc15',
                        color: alertType === 'success' ? '#064e3b' : '#78350f',
                        '& .MuiAlert-icon': { mr: 1 },
                        '& .MuiAlert-message': { fontSize: '0.95rem', fontWeight: 500 },
                    }}
                >
                    {alertMessage}
                </Alert>
            </Snackbar>
            <Box
                onClick={openForm}
                sx={{
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: 'column',
                    border: '1px solid #e5e7eb',
                    borderRadius: 2,
                    p: { xs: 1.5, sm: 2 },
                    cursor: 'pointer',
                    color: '#6b7280',
                    backgroundColor: '#ffffff',
                    '&:hover': { backgroundColor: '#f9fafb' },
                    width: { xs: '100%', sm: '520px', md: '600px' },
                    boxShadow: 'none'
                }}
            >
                Bạn viết gì đi
            </Box>

            {/* Create Post Modal */}
            <Dialog open={openCreate} onClose={closeForm} fullWidth maxWidth="sm">
                <DialogTitle>
                    <Typography variant="h6" fontWeight={700}>Tạo bài viết</Typography>
                </DialogTitle>
                <DialogContent>
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Nội dung"
                            name="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            multiline
                            minRows={3}
                            fullWidth
                        />
                        {/* Removed manual File URL fields - users upload images from their machine using the input below */}
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Tải ảnh từ máy tính</Typography>
                            {/* hidden native input */}
                            <input
                                id="file-input"
                                type="file"
                                multiple
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const files = e.target.files ? Array.from(e.target.files) : [];
                                    if (files.length === 0) return;
                                    setSelectedFiles(prev => ([...(prev || []), ...files]));
                                }}
                            />

                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<UploadFileIcon />}
                                    onClick={() => document.getElementById('file-input')?.click()}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Thêm tệp
                                </Button>
                                
                                {selectedFiles.length > 0 && (
                                    <Button variant="text" onClick={() => setSelectedFiles([])} sx={{ textTransform: 'none', ml: 'auto' }}>Xóa tất cả</Button>
                                )}
                            </Box>

                            {/* Filename list removed - previews show instead */}
                            {/* Image previews - one per row */}
                            {previews && previews.length > 0 && (
                                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {previews.map((src, i) => (
                                        <Box key={`prev-wrap-${i}`} sx={{ position: 'relative', width: '100%' }}>
                                            <IconButton
                                                aria-label={`remove-${i}`}
                                                size="small"
                                                onClick={() => {
                                                    // revoke object URL and remove file from state
                                                    try { URL.revokeObjectURL(previews[i]); } catch (e) {}
                                                    setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
                                                }}
                                                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, bgcolor: 'rgba(0,0,0,0.4)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' } }}
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                            <Box
                                                component="img"
                                                src={src}
                                                alt={`preview-${i}`}
                                                sx={{ width: '100%', borderRadius: 1.5, objectFit: 'contain', maxHeight: 360, display: 'block' }}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeForm} variant="contained" sx={{ bgcolor: '#9ca3af', '&:hover': { bgcolor: '#6b7280' }, textTransform: 'none' }}>
                        Hủy
                    </Button>
                    <Button onClick={handleSubmit} variant="contained" sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none' }}>
                        Đăng bài
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Posts list (memoized) */}
            <PostsList
                items={posts}
                onToggleLike={handleToggleLike}
                onOpenComments={openCommentsFor}
                formatRelative={formatRelative}
                currentUserId={currentUserId}
                onRequestDelete={requestDeletePost}
            />

            {/* Pagination controls */}
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <IconButton aria-label="prev-page" onClick={() => !isFirstPage && setPage(p => Math.max(1, p - 1))} disabled={isFirstPage}>
                    <NavigateBeforeIcon />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: 100, textAlign: 'center' }}>
                    Trang {page}{totalPages ? ` / ${totalPages}` : ''}
                </Typography>
                <IconButton aria-label="next-page" onClick={() => !isLastPage && setPage(p => p + 1)} disabled={isLastPage}>
                    <NavigateNextIcon />
                </IconButton>
            </Box>

            {/* Focused post with comments (memoized) */}
            <CommentsDialog
                open={openComments}
                post={selectedPost}
                onClose={closeComments}
                onTogglePostLike={handleToggleLike}
                onToggleCommentLike={handleToggleCommentLike}
                onApplyNewComment={applyNewCommentToState}
                onSuccess={onSuccess}
                onNotify={(type, msg) => { setAlertType(type); setAlertMessage(msg); setShowAlert(true); }}
                currentUserId={currentUserId}
                onApplyDeleteComment={(postId, commentId) => {
                    // update selectedPost
                    setSelectedPost(prev => {
                        if (!prev || prev.id !== postId) return prev;
                        return {
                            ...prev,
                            comments: (prev.comments || []).filter(c => c.id !== commentId),
                            _count: { ...prev._count, comments: Math.max(0, (prev._count?.comments || 0) - 1) }
                        };
                    });
                    // update list
                    setData(prev => {
                        if (!prev?.items) return prev;
                        return {
                            ...prev,
                            items: prev.items.map(p => p.id !== postId ? p : ({
                                ...p,
                                comments: (p.comments || []).filter(c => c.id !== commentId),
                                _count: { ...p._count, comments: Math.max(0, (p._count?.comments || 0) - 1) }
                            }))
                        };
                    });
                }}
                formatRelative={formatRelative}
            />

            {/* Confirm delete dialog */}
            <Dialog open={deleteOpen} onClose={closeDeleteConfirm}>
                <DialogTitle>Xác nhận xóa bài viết</DialogTitle>
                <DialogContent>
                    Bạn có chắc chắn muốn xóa bài viết này? Hành động không thể hoàn tác.
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteConfirm} variant="contained" sx={{ bgcolor: '#9ca3af', '&:hover': { bgcolor: '#6b7280' }, textTransform: 'none' }}>
                        Hủy
                    </Button>
                    <Button onClick={confirmDeletePost} variant="contained" sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' }, textTransform: 'none' }}>
                        Xác nhận
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// Memoized list of posts to avoid re-rendering while typing in other inputs
const PostsList = React.memo(function PostsList({ items, onToggleLike, onOpenComments, formatRelative, currentUserId, onRequestDelete }) {
    return (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', px: { xs: 1, sm: 0 } }}>
            {items?.map((post) => (
            <Box key={post.id} onClick={() => onOpenComments(post)} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, background: '#fff', p: { xs: 1.5, sm: 2 }, width: '100%', maxWidth: 600, cursor: 'pointer', boxShadow: 'none' }}>
                    {/* Header: avatar + name + time + (optional delete) */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <Avatar
                                src={post.author?.avatar_url || ''}
                                alt={post.author?.full_name || 'User'}
                                sx={{ width: 36, height: 36 }}
                            />
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography sx={{ fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                                    {post.author?.full_name || 'Người dùng'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                    {formatRelative(post.created_at)}
                                </Typography>
                            </Box>
                        </Box>
                        {post.author?.id === currentUserId && (
                            <Tooltip title="Xóa bài">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRequestDelete(post.id); }}>
                                    <DeleteOutlineIcon sx={{ color: '#6b7280' }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    {post.content && (
                        <Typography sx={{ mt: 1.25, color: '#111827' }}>{post.content}</Typography>
                    )}
                    {/* Attachments preview:
                        - 1 image: full width
                        - 2 images: side-by-side, each half width
                        - >=3 images: left half = image 1, right half = image 2 but darkened with overlay "+x" (x = remaining images beyond the two shown)
                        Clicking the post opens the comments/dialog which shows all images in full.
                    */}
                    {post.attachments && post.attachments.length > 0 && (
                        <Box sx={{ mt: 1.25, width: '100%' }}>
                            {post.attachments.length === 1 && post.attachments[0]?.file_url && (
                                <Box
                                    component="img"
                                    src={post.attachments[0].file_url}
                                    alt="post"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    sx={{ width: '100%', borderRadius: 1.5, objectFit: 'cover' }}
                                />
                            )}
                            {post.attachments.length === 2 && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Box
                                        component="img"
                                        src={post.attachments[0]?.file_url}
                                        alt="post-0"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        sx={{ width: '50%', borderRadius: 1.25, objectFit: 'cover' }}
                                    />
                                    <Box
                                        component="img"
                                        src={post.attachments[1]?.file_url}
                                        alt="post-1"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        sx={{ width: '50%', borderRadius: 1.25, objectFit: 'cover' }}
                                    />
                                </Box>
                            )}
                            {post.attachments.length >= 3 && (
                                <Box sx={{ display: 'flex', gap: 1, height: { xs: 160, sm: 200, md: 220 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                                    <Box
                                        component="img"
                                        src={post.attachments[0]?.file_url}
                                        alt="post-0"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        sx={{ width: { xs: '100%', sm: '50%' }, borderRadius: 1.25, objectFit: 'cover', height: '100%' }}
                                    />
                                    <Box sx={{ width: { xs: '100%', sm: '50%' }, position: 'relative', borderRadius: 1.25, overflow: 'hidden', height: '100%' }}>
                                        {/* show second image darkened */}
                                        <Box
                                            component="img"
                                            src={post.attachments[1]?.file_url}
                                            alt="post-1"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(40%)' }}
                                        />
                                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem' }}>
                                                +{Math.max(0, (post.attachments.length - 2))}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                    {/* Stats: left likes, right comments */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                            {post._count?.likes || 0} lượt thích
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                            {post._count?.comments || 0} bình luận
                        </Typography>
                    </Box>
                    {/* Actions: like left, comment right */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, px: { xs: 2, sm: 4, md: 8 } }}>
                        <Button
                            variant="text"
                            startIcon={post.liked ? <ThumbUpAltIcon sx={{ color: '#2563eb' }} /> : <ThumbUpOffAltIcon sx={{ color: '#374151' }} />}
                            onClick={(e) => { e.stopPropagation(); onToggleLike(post.id); }}
                            sx={{ textTransform: 'none', color: '#374151' }}
                        >
                            Thích
                        </Button>
                        <Button
                            variant="text"
                            startIcon={<ChatBubbleOutlineIcon />}
                            sx={{ textTransform: 'none', color: '#374151' }}
                            onClick={(e) => { e.stopPropagation(); onOpenComments(post); }}
                        >
                            Bình luận
                        </Button>
                    </Box>
                </Box>
            ))}
        </Box>
    );
});

// Memoized dialog for comments with internal state and memoized computations
const CommentsDialog = React.memo(function CommentsDialog({ open, post, onClose, onTogglePostLike, onToggleCommentLike, onApplyNewComment, onSuccess, formatRelative, currentUserId, onNotify, onApplyDeleteComment }) {
    const [commentsToShow, setCommentsToShow] = useState(5);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);
    const [deleteCommentId, setDeleteCommentId] = useState(null);
    const [deleteCommentOpen, setDeleteCommentOpen] = useState(false);
    const [commentFiles, setCommentFiles] = useState([]);
    const [commentPreviews, setCommentPreviews] = useState([]);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState('');

    // Reset internal state when post changes or dialog opens
    useEffect(() => {
        if (open) {
            setCommentsToShow(5);
            setNewComment('');
        }
    }, [open, post?.id]);

    // previews for commentFiles
    useEffect(() => {
        if (!commentFiles || commentFiles.length === 0) {
            setCommentPreviews(prev => {
                prev.forEach(u => URL.revokeObjectURL(u));
                return [];
            });
            return;
        }
        const urls = commentFiles.map(f => URL.createObjectURL(f));
        setCommentPreviews(prev => {
            prev.forEach(u => URL.revokeObjectURL(u));
            return urls;
        });
        return () => { urls.forEach(u => URL.revokeObjectURL(u)); };
    }, [commentFiles]);

    const visibleComments = useMemo(() => {
        const comments = post?.comments || [];
        const sorted = [...comments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return sorted.slice(0, commentsToShow);
    }, [post?.comments, commentsToShow]);

    const handleAddComment = useCallback(async () => {
        const c = newComment.trim();
        if (!post) return;
        // allow image-only comments too
        // Defensive: if commentFiles state is empty, try to read the native input (in case of fast submit)
        let filesToSend = commentFiles;
        if ((!filesToSend || filesToSend.length === 0) && typeof document !== 'undefined') {
            const fileInput = document.getElementById('comment-file-input');
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                filesToSend = Array.from(fileInput.files || []);
                setCommentFiles(filesToSend);
            }
        }
        if (!c && (!filesToSend || filesToSend.length === 0)) {
            setAlertType('warning');
            setAlertMessage('Bình luận phải có nội dung hoặc ít nhất một tệp đính kèm');
            setShowAlert(true);
            return;
        }
        try {
            setCommentLoading(true);
            const token = localStorage.getItem('token');
            let res;
            // Always send FormData for comments as well (simpler and avoids accidental JSON requests)
            const form = new FormData();
            form.append('content', c || '');
            (filesToSend || []).forEach(f => form.append('files', f));
            res = await fetch(`http://localhost:4000/channels/posts/${post.id}/comments`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form
            });
            if (!res.ok) return;
            const cmt = await res.json();
            onApplyNewComment(post.id, cmt);
            setNewComment('');
            setCommentsToShow(v => v + 1);
            onSuccess('Bình luận thành công');
            // cleanup comment files and previews
            setCommentFiles([]);
            setCommentPreviews([]);
        } finally {
            setCommentLoading(false);
        }
    }, [newComment, onApplyNewComment, onSuccess, post]);

    const requestDeleteComment = useCallback((commentId) => {
        setDeleteCommentId(commentId);
        setDeleteCommentOpen(true);
    }, []);

    const closeDeleteComment = useCallback(() => {
        setDeleteCommentOpen(false);
        setDeleteCommentId(null);
    }, []);

    const confirmDeleteComment = useCallback(async () => {
        if (!deleteCommentId || !post) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:4000/channels/comments/${deleteCommentId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error('Xóa bình luận thất bại');
            onApplyDeleteComment(post.id, deleteCommentId);
            onNotify('success', 'Đã xóa bình luận');
        } catch (e) {
            onNotify('warning', e?.message || 'Xóa bình luận thất bại');
        } finally {
            closeDeleteComment();
        }
    }, [deleteCommentId, post, onApplyDeleteComment, onNotify, closeDeleteComment]);

    if (!post) return null;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Avatar src={post.author?.avatar_url || ''} sx={{ width: 36, height: 36 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography sx={{ fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                            {post.author?.full_name || 'Người dùng'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            {formatRelative(post.created_at)}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {post.content && (
                    <Typography sx={{ mb: 1.25, color: '#111827' }}>{post.content}</Typography>
                )}
                {/* Focused post images: when dialog is open show all attachments in a grid */}
                {post.attachments && post.attachments.length > 0 && (
                    <Box sx={{ mb: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {post.attachments.map((a, i) => (
                            <Box
                                key={i}
                                component="img"
                                src={a?.file_url}
                                alt={`post-${i}`}
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                sx={{ width: '100%', borderRadius: 1.5, objectFit: 'cover' }}
                            />
                        ))}
                    </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                        {post._count?.likes || 0} lượt thích
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                        {post._count?.comments || 0} bình luận
                    </Typography>
                </Box>
                {/* Focused actions */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: { xs: 2, sm: 4, md: 8 } }}>
                    <Button
                        variant="text"
                        startIcon={post.liked ? <ThumbUpAltIcon sx={{ color: '#2563eb' }} /> : <ThumbUpOffAltIcon sx={{ color: '#374151' }} />}
                        onClick={() => onTogglePostLike(post.id)}
                        sx={{ textTransform: 'none', color: '#374151' }}
                    >
                        Thích
                    </Button>
                    <Button
                        variant="text"
                        startIcon={<ChatBubbleOutlineIcon />}
                        sx={{ textTransform: 'none', color: '#374151' }}
                    >
                        Bình luận
                    </Button>
                </Box>
                <Divider sx={{ mb: 1.25 }} />
                {/* comment file picker moved into Actions area for compact UI */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {visibleComments.map((c) => (
                        <Box key={c.id}>
                            {/* Row: avatar + bubble */}
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Avatar src={c.author?.avatar_url || ''} sx={{ width: 28, height: 28, mt: 0.25 }} />
                                <Box sx={{ background: '#f3f4f6', borderRadius: 2, px: 1, py: 0.75, flex: 1, position: 'relative' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                                        <Typography sx={{ fontWeight: 600, color: '#111827' }} variant="body2">
                                            {c.author?.full_name || 'Người dùng'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                            {formatRelative(c.created_at)}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ color: '#111827' }}>{c.content}</Typography>
                                    {c.attachments && c.attachments.length > 0 && (
                                        <Box sx={{ mt: 1 }}>
                                            {/* show first attachment for comment (we allow 1 image per comment) */}
                                            <Box
                                                component="img"
                                                src={c.attachments[0]?.file_url}
                                                alt={`comment-attach-${c.id}-0`}
                                                referrerPolicy="no-referrer"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                onClick={() => { setLightboxSrc(c.attachments[0]?.file_url || ''); setLightboxOpen(true); }}
                                                sx={{ width: 200, maxWidth: '100%', borderRadius: 1.25, objectFit: 'cover', mt: 0.5, cursor: 'pointer' }}
                                            />
                                        </Box>
                                    )}
                                    {c.author?.id === currentUserId && (
                                        <IconButton
                                            size="small"
                                            onClick={() => requestDeleteComment(c.id)}
                                            sx={{ position: 'absolute', top: 4, right: 4 }}
                                        >
                                            <DeleteOutlineIcon fontSize="small" sx={{ color: '#6b7280' }} />
                                        </IconButton>
                                    )}
                                </Box>
                            </Box>
                            {/* Row: actions below bubble (not wrapped inside) */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, ml: 4.5 }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    startIcon={(c.liked || (c.likes && c.likes.length > 0))
                                        ? <ThumbUpAltIcon fontSize="small" sx={{ color: '#2563eb' }} />
                                        : <ThumbUpOffAltIcon fontSize="small" sx={{ color: '#374151' }} />}
                                    onClick={() => onToggleCommentLike(c.id)}
                                    sx={{ textTransform: 'none', color: '#374151' }}
                                >
                                    Thích
                                </Button>
                                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                    {(c._count?.likes || 0)} lượt thích
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                    {(post.comments?.length || 0) > commentsToShow && (
                        <Button variant="text" sx={{ alignSelf: 'center', textTransform: 'none' }} onClick={() => setCommentsToShow(v => v + 5)}>
                            Xem thêm bình luận
                        </Button>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                    <TextField
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Viết bình luận..."
                        fullWidth
                        size="small"
                    />
                    {/* bottom row: add-image icon and horizontal previews + send button */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <input
                            id="comment-file-input"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : [];
                                if (!files.length) return;
                                // only allow a single image per comment
                                setCommentFiles([files[0]]);
                            }}
                        />
                        <IconButton aria-label="add-comment-image" onClick={() => document.getElementById('comment-file-input')?.click()} sx={{ bgcolor: '#f3f4f6' }} disabled={commentFiles && commentFiles.length >= 1}>
                            <UploadFileIcon />
                        </IconButton>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', overflowX: 'auto', flex: 1 }}>
                            {commentPreviews && commentPreviews.map((src, i) => (
                                <Box key={`cprev-inline-${i}`} sx={{ position: 'relative', minWidth: 88, height: 64, borderRadius: 1, overflow: 'hidden', bgcolor: '#f3f4f6' }}>
                                    <IconButton aria-label={`remove-comment-${i}`} size="small" onClick={() => { try { URL.revokeObjectURL(commentPreviews[i]); } catch(e){} setCommentFiles([]); }} sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2, bgcolor: 'rgba(0,0,0,0.35)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' } }}>
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                    <Box component="img" src={src} alt={`cpreview-inline-${i}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </Box>
                            ))}
                        </Box>
                        <Button onClick={handleAddComment} disabled={commentLoading || (!newComment.trim() && (!commentFiles || commentFiles.length === 0))} variant="contained" sx={{ textTransform: 'none' }}>
                            Gửi
                        </Button>
                    </Box>
                </Box>
            </DialogActions>
            {/* Lightbox for viewing comment image centered */}
            <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="lg" fullWidth>
                <DialogContent sx={{ bgcolor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', p: 2 }}>
                    <IconButton onClick={() => setLightboxOpen(false)} sx={{ position: 'absolute', top: 12, right: 12, color: '#fff', zIndex: 10 }}>
                        <CloseIcon />
                    </IconButton>
                    <Box component="img" src={lightboxSrc} alt="preview" sx={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block', m: '0 auto' }} />
                </DialogContent>
            </Dialog>
            {/* Delete comment confirm dialog */}
            <Dialog open={deleteCommentOpen} onClose={closeDeleteComment} maxWidth="xs" fullWidth>
                <DialogTitle>Xác nhận xóa bình luận</DialogTitle>
                <DialogContent>Bạn có chắc chắn muốn xóa bình luận này? Hành động không thể hoàn tác.</DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteComment} variant="contained" sx={{ bgcolor: '#9ca3af', '&:hover': { bgcolor: '#6b7280' }, textTransform: 'none' }}>Hủy</Button>
                    <Button onClick={confirmDeleteComment} variant="contained" sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' }, textTransform: 'none' }}>Xác nhận</Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
});

// Note: Lightbox dialog is inside CommentsDialog; when opened it centers the clicked image.
export default ShowChannel;