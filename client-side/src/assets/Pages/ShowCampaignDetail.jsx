import React, { useRef } from 'react';
import { Button } from '@mui/material';
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import './ShowCampaignDetail.css';
/**
 * ShowCampaignDetail
 * Props: { title, category, location, deadline, capacity, manager_name, manager_mail, banner_url }
 * Layout: left large banner image, right column with nicely formatted information.
 */
function ShowCampaignDetail() {
  const fmtDeadline = (d) => {
  if (!d) return 'Không có thời hạn';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

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
      setAllowed(true);
    }
  }, [navigate]);

  useEffect(() => {
    if (!allowed) return;
    fetch(`http://localhost:4000/events/${id}`)
      .then(res => res.json())
      .then(data => setEvent(data))
      .catch(err => console.error(err));
  }, [id, allowed]);

  const bannerFallback = (
    <div className="scd-fallback">
      <span>Không có ảnh</span>
    </div>
  );
  

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
    return <div>Đang tải...</div>;
  }

  return (
    <div className="scd-container">
      <title>Campaign Details</title>
      <div ref={leftRef} className="scd-left scd-animate">
        {event.banner_url ? (
          <img src={event.banner_url} alt={event.title} className="scd-img" />
        ) : (
          bannerFallback
        )}
      </div>
      <div ref={rightRef} className="scd-right scd-animate">
        <div>
          <h1 className="scd-title">{event.title}</h1>
          <div className="scd-category">
            <h4>Thể loại: <strong>{event.category?.name}</strong></h4>
          </div>
          <div className="scd-desc">
            <span>{event.description}</span>
          </div>
          <h5 className="scd-location">Địa điểm: <span><strong>{event.location?.name}</strong></span></h5>
          <span className = "scd-location">
            <span>{event.location?.address_line}, {event.location?.district}, {event.location?.province}, {event.location?.country}</span>
          </span>
          <div className="scd-details">
            {/* Two-column grid: col 1 = Deadline & Contact, col 2 = Capacity & Manager */}
            <div className="scd-grid">
              {/* Row 1 */}
              <div>
                <div className="scd-label">Hạn chót</div>
                <div className="scd-value">{fmtDeadline(event.end_time)}</div>
              </div>
              <div>
                <div className="scd-label">Số TNV còn thiếu</div>
                <div className="scd-capacity-row">
                  <div className="scd-badge" title="Total volunteers">
                    {typeof event.capacity === 'number' ? event.capacity : (event.capacity || '—')}
                  </div>
                  tình nguyện viên
                </div>
              </div>

              {/* Row 2 */}
              <div>
                <div className="scd-label">Người quản lý</div>
                <div className="scd-value">{event.manager?.full_name ?? '—'}</div>
              </div>
              <div>
                <div className="scd-label">Liên hệ</div>
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
          <Button
            className="scd-join-btn"
            variant="contained"
            onClick={() => navigate(`/bevolunteer/${id}`)}
            sx={{ bgcolor: '#16a34a', textTransform: 'none', '&:hover': { bgcolor: '#15803d' } }}
          >
            Đăng ký tham gia
          </Button>
          <Button
          style={{ marginLeft: '85px' }}
            variant="contained"
            onClick={() => navigate(`/exchange-channel/${id}`)}
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
            <span style={{ fontWeight: 700 }}>→</span> Truy cập kênh trao đổi
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ShowCampaignDetail;