import { useEffect, useState } from "react";
import VolunteerNeedsCard from "./VolunteerNeedsCard";
import axios from "axios";
import { Link } from "react-router-dom";
import { Button } from "@material-tailwind/react";
import { useTranslation } from 'react-i18next';

const VolunteerNeeds = () => {
  const MAX_SHOW = 6;
  const { t } = useTranslation();
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const resp = await fetch(`http://localhost:4000/dashboard`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();

        const events = Array.isArray(data?.hot_events) ? data.hot_events : [];
        // Only include upcoming events (start_time >= now)
        const now = new Date();
        const upcoming = events.filter((e) => {
          if (!e?.start_time) return false;
          const st = new Date(e.start_time);
          return !isNaN(st.getTime()) && st.getTime() >= now.getTime();
        });
        // Map backend event shape to card shape
        const mapped = upcoming.map((e) => ({
          _id: e.id,
          thumbnail: e.banner_url,
          post_title: e.title,
          category: "Event",
          description: e.description || "",
          deadline: e.start_time ? new Date(e.start_time).toLocaleDateString("vi-VN") : "",
          likes: e.total_likes ?? 0,
          comments: e.total_comments ?? 0,
        }));

        if (mounted) setVolunteers(mapped);
      } catch (err) {
        console.error("Failed to load dashboard hot events", err);
        if (mounted) setError("Không tải được dữ liệu sự kiện.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-16 font-qs container mx-auto">
        <h2 className="text-2xl text-center">{t('volunteerNeeds.loading', 'Đang tải sự kiện nổi bật…')}</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 font-qs container mx-auto">
        <h2 className="text-2xl text-center text-red-500">{error}</h2>
      </div>
    );
  }

  return (
    <div className="py-16 font-qs">
      <div
        data-aos="fade-left"
        data-aos-anchor-placement="top-bottom"
        data-aos-easing="linear"
        data-aos-duration="1000"
        className="container mx-auto"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-center ">
          {t('home.volunteerNeeds.title', 'Volunteer Needs Now')}
        </h2>
        <p className="w-2/3 mx-auto mt-4 text-center leading-relaxed text-gray-600">
          {t(
            'home.volunteerNeeds.desc',
            'Volunteer Needs Now is the pulse of our community engagement. This section highlights current opportunities where your time and skills can make an immediate impact.'
          )}
        </p>
      </div>
      <div className="container mx-auto mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 md:gap-y-12 pl-10">
        {volunteers.slice(0, MAX_SHOW).map((volunteer) => (
          <VolunteerNeedsCard volunteer={volunteer} key={volunteer._id} />
        ))}
        {volunteers.length > MAX_SHOW && (
          <div className="flex justify-center mt-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 col-span-full">
            <Link to="/need-volunteer">
              <Button
                className=" px-10 py-4 text-2xl rounded-xl !text-white bg-blue-400 hover:bg-orange-400"
                variant="gradient"
              >
                {t('home.volunteerNeeds.seeAll', 'SEE ALL')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerNeeds;
