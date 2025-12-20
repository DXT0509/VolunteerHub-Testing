import React, { useEffect, useState } from 'react';
import './Login.css';
import { IonIcon } from '@ionic/react';
import { mail, call, lockClosed } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, TextField, InputAdornment, Button, Snackbar, Alert, Slide, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useTranslation } from 'react-i18next';

function SlideFromTop(props) {
	return <Slide {...props} direction="down" timeout={600} />;
}

const ForgetPassword = () => {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [animateForm, setAnimateForm] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [showAlert, setShowAlert] = useState(false);

	// Step 1 form: verify identity
	const [verifyForm, setVerifyForm] = useState({ email: '', phone: '' });
	const [verifiedToken, setVerifiedToken] = useState(null); // token from backend to authorize reset

	// Step 2 form: reset password
	const [resetForm, setResetForm] = useState({ password: '', confirm: '' });
	const [successOpen, setSuccessOpen] = useState(false);

	useEffect(() => {
		const t = requestAnimationFrame(() => setAnimateForm(true));
		return () => cancelAnimationFrame(t);
	}, []);

	const handleVerifyChange = (e) => {
		const { name, value } = e.target;
		setVerifyForm((p) => ({ ...p, [name]: value }));
	};

	const handleResetChange = (e) => {
		const { name, value } = e.target;
		setResetForm((p) => ({ ...p, [name]: value }));
	};

	const submitVerify = async (e) => {
		e.preventDefault();
		setError('');
		setShowAlert(false);
		setLoading(true);
		try {
			const res = await fetch('http://localhost:4000/auth/get-user-by-email-phone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: verifyForm.email, phone: verifyForm.phone })
			});
			const data = await res.json().catch(() => ({}));
            
			if (!data) throw new Error("Không tồn tại người dùng với thông tin đã cung cấp");
			// Use a non-empty identifier; treat 0 and empty string as valid by storing a non-null value
			const id = data?.id;
			if (id === undefined || id === null) throw new Error("Không tìm thấy mã người dùng để đặt lại mật khẩu");
			setVerifiedToken(id);
		} catch (err) {
			setError(err.message || 'Có lỗi xảy ra');
			setShowAlert(true);
		} finally {
			setLoading(false);
		}
	};

	const submitReset = async (e) => {
		e.preventDefault();
		setError('');
		setShowAlert(false);
		// simple match validation
		if (!resetForm.password || resetForm.password.length < 6) {
			setError('Mật khẩu phải có ít nhất 6 ký tự');
			setShowAlert(true);
			return;
		}
		if (resetForm.password !== resetForm.confirm) {
			setError('Mật khẩu xác nhận không khớp');
			setShowAlert(true);
			return;
		}
		setLoading(true);
		try {
			const res = await fetch('http://localhost:4000/users/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: verifiedToken, newPassword: resetForm.password })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Đặt lại mật khẩu thất bại');
			setSuccessOpen(true);
			// Giữ thông báo trong 3 giây trước khi chuyển trang
			setTimeout(() => { setSuccessOpen(false); navigate('/login', { replace: true }); }, 3000);
		} catch (err) {
			setError(err.message || 'Có lỗi xảy ra');
			setShowAlert(true);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-page">
			<Snackbar
				open={showAlert}
				onClose={(_, reason) => { if (reason === 'clickaway') return; setShowAlert(false); }}
				autoHideDuration={1500}
				anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
				TransitionComponent={SlideFromTop}
				sx={{ mt: 2 }}
			>
				<Alert
					severity="error"
					variant="filled"
					sx={{
						px: 2,
						py: 1,
						borderRadius: 1.5,
						boxShadow: 2,
						width: '420px',
						backgroundColor: '#facc15',
						color: '#78350f',
						'& .MuiAlert-icon': { mr: 1 },
						'& .MuiAlert-message': { fontSize: '0.95rem', fontWeight: 500 },
					}}
				>
					{error}
				</Alert>
			</Snackbar>
			<div className={`wrapper auth-animate ${animateForm ? 'in-view' : ''}`}>
				<div className="form-box login">
					  <h2>{t('auth.forgot.title', 'Quên mật khẩu')}</h2>
					{verifiedToken == null ? (
						<Box component="form" onSubmit={submitVerify} sx={{ mt: 2 }}>
							<Grid container spacing={3} direction="column">
								<Grid item xs={12}>
										<TextField
										fullWidth
										name="email"
											label={t('auth.login.email', 'Email')}
										type="email"
										value={verifyForm.email}
										onChange={handleVerifyChange}
										required
										variant="outlined"
										InputProps={{
											endAdornment: (
												<InputAdornment position="end">
													<IonIcon icon={mail} />
												</InputAdornment>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12}>
										<TextField
										fullWidth
										name="phone"
											label={t('auth.register.phone', 'Số điện thoại')}
										type="tel"
										value={verifyForm.phone}
										onChange={handleVerifyChange}
										inputProps={{ pattern: '^[0-9]{9,12}$' }}
										required
										variant="outlined"
										InputProps={{
											endAdornment: (
												<InputAdornment position="end">
													<IonIcon icon={call} />
												</InputAdornment>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12}>
									<Button type="submit" variant="contained" fullWidth className="btn" disabled={loading}>
										{t('auth.forgot.verify', 'Xác thực')}
									</Button>
								</Grid>
							</Grid>
						</Box>
					) : (
						<Box component="form" onSubmit={submitReset} sx={{ mt: 2 }}>
							<Grid container spacing={3} direction="column">
								<Grid item xs={12}>
										<TextField
										fullWidth
										name="password"
											label={t('auth.forgot.newPassword', 'Mật khẩu mới')}
										type="password"
										value={resetForm.password}
										onChange={handleResetChange}
										required
										variant="outlined"
										InputProps={{
											endAdornment: (
												<InputAdornment position="end">
													<IonIcon icon={lockClosed} />
												</InputAdornment>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12}>
										<TextField
										fullWidth
										name="confirm"
											label={t('auth.forgot.confirmNewPassword', 'Xác nhận mật khẩu mới')}
										type="password"
										value={resetForm.confirm}
										onChange={handleResetChange}
										required
										variant="outlined"
										InputProps={{
											endAdornment: (
												<InputAdornment position="end">
													<IonIcon icon={lockClosed} />
												</InputAdornment>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12}>
									<Button type="submit" variant="contained" fullWidth className="btn" disabled={loading}>
										{t('auth.forgot.submit', 'Đặt lại mật khẩu')}
									</Button>
								</Grid>
							</Grid>
						</Box>
					)}
				</div>
			</div>
			<Dialog open={successOpen} onClose={() => setSuccessOpen(false)}>
				<DialogTitle>{t('auth.forgot.successTitle', 'Đặt lại mật khẩu thành công')}</DialogTitle>
				<DialogContent dividers>
					{t('auth.forgot.successDesc', 'Bạn sẽ được chuyển đến trang đăng nhập trong giây lát.')}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => { setSuccessOpen(false); navigate('/login', { replace: true }); }} variant="contained">{t('auth.login.title', 'Đăng nhập')}</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
};

export default ForgetPassword;
