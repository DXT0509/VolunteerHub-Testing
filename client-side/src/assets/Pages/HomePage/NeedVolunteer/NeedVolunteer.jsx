import { Link, useNavigation } from "react-router-dom";
import VolunteerNeedsCard from "../VolunteerNeeds/VolunteerNeedsCard";
import { useState } from "react";
import * as React from "react";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
// removed Material Tailwind Button; use Tailwind classes directly for visibility
import { useEffect } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import PropTypes from "prop-types";
import LoadingGif from "../../../Components/Loader/LoadingGif";
import { useTranslation } from 'react-i18next';

// Không dùng dữ liệu mẫu; tải sự kiện thật từ API

const NeedVolunteer = ({ title }) => {
  const [volunteers, setVolunteers] = useState([]);
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showLoader, setShowLoader] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);
  // Scroll to top when entering this page
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // ignore in non-browser environments
    }
  }, []);
  useEffect(() => {
    const getData = async () => {
      setShowLoader(true);
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const { data } = await axios.get(`${base}/events`, { params: { status: 'active' } });
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const onlyActive = arr.filter((ev) => String(ev?.status || '').toLowerCase() === 'active');
        const now = new Date();
        const upcoming = onlyActive.filter((ev) => {
          if (!ev?.start_time) return false;
          const st = new Date(ev.start_time);
          return !isNaN(st.getTime()) && st.getTime() >= now.getTime();
        });
        // Chuẩn hoá về shape cần cho UI
        const normalized = upcoming.map((ev) => ({
          _id: ev.id,
          post_title: ev.title,
          category: ev?.category?.name || 'Event',
          deadline: ev?.start_time ? new Date(ev.start_time).toISOString().slice(0, 10) : '',
          location: ev?.location?.name || [ev?.location?.district, ev?.location?.province].filter(Boolean).join(', '),
          noOfVolunteer: ev?.capacity ?? 0,
          thumbnail: ev?.banner_url || '',
          description: ev?.description || '',
          posted_by: ev?.manager?.full_name || '—',
          likes: ev?.total_likes || 0,
          comments: ev?.total_comments || 0,
          
        }));
        setAllVolunteers(normalized);
        // Lọc theo từ khoá tìm kiếm (client-side)
        const filtered = search
          ? normalized.filter((v) => (v.post_title || '').toLowerCase().includes(search.toLowerCase()))
          : normalized;
        setVolunteers(filtered);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setAllVolunteers([]);
        setVolunteers([]);
      } finally {
        setShowLoader(false);
      }
    };
    getData();
  }, [search]);
  console.log(volunteers);
  const [view, setView] = React.useState("module");

  const [gridView, setGridView] = useState(true);
  const [tableView, setTableView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [deadlineSort, setDeadlineSort] = useState("none"); // none | asc | desc

  const categories = React.useMemo(() => {
    const arr = Array.isArray(volunteers) ? volunteers : [];
    const set = new Set(arr.map((v) => v.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [volunteers]);

  const displayedVolunteers = React.useMemo(() => {
    const dataArray = Array.isArray(volunteers) ? volunteers : [];
    const filtered = selectedCategory && selectedCategory !== "All"
      ? dataArray.filter((v) => v.category === selectedCategory)
      : dataArray;
    const sorted = [...filtered];
    if (deadlineSort === "asc" || deadlineSort === "desc") {
      sorted.sort((a, b) => {
        const ad = new Date(a?.deadline);
        const bd = new Date(b?.deadline);
        const aValid = !isNaN(ad.getTime());
        const bValid = !isNaN(bd.getTime());
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return deadlineSort === "asc" ? ad - bd : bd - ad;
      });
    }
    return sorted;
  }, [volunteers, selectedCategory, deadlineSort]);
  

  

  const handleChange = (event, nextView) => {
    setView(nextView);
  };

  const handleSearch = () => {
    console.log("searching text is", searchText);
    setSearch(searchText);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  // Build suggestions when typing
  useEffect(() => {
    const q = (searchText || '').trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    const pool = Array.isArray(allVolunteers) ? allVolunteers : [];
    const uniqueTitles = Array.from(
      new Set(
        pool
          .map((v) => v?.post_title || '')
          .filter(Boolean)
      )
    );
    const hits = uniqueTitles
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(hits);
    setShowSuggestions(hits.length > 0);
    setActiveSuggestionIndex(hits.length > 0 ? 0 : -1);
  }, [searchText, allVolunteers]);

  const handleGrid = (e) => {
    setTableView(!e);
    setGridView(e);
  };
  const handleTable = (e) => {
    setTableView(e);
    setGridView(!e);
    console.log(tableView);
  };
  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };
  const handleSortChange = (e) => {
    setDeadlineSort(e.target.value);
  };
  const navigation = useNavigation();
  if (navigation.state === "loading") return <LoadingGif />;
  return (
    <div className="py-16 font-qs">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div
        data-aos="fade-left"
        data-aos-anchor-placement="top-bottom"
        data-aos-easing="linear"
        data-aos-duration="1500"
        className="container mx-auto mb-6"
      >
        <h2 className="text-2xl md:text-5xl font-bold text-center ">
          {t('home.volunteerNeeds.needVolunteer.headerTitle')}
        </h2>
        <p className="w-2/3 mx-auto md:text-lg mt-4 text-center leading-relaxed ">
          {t('home.volunteerNeeds.needVolunteer.headerDesc')}
        </p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between container mx-auto px-16">
        <div
          data-aos="fade-down"
          data-aos-anchor-placement="top-bottom"
          data-aos-easing="linear"
          data-aos-duration="1000"
          className="flex container justify-center my-8 md:justify-start "
        >
          <ToggleButtonGroup
            orientation="horizontal"
            value={view}
            exclusive
            className="bg-gray-200"
            onChange={handleChange}
          >
            <ToggleButton
              onClick={() => handleGrid(true)}
              value="module"
              aria-label="module"
            >
              <ViewModuleIcon />
            </ToggleButton>
            <ToggleButton
              onClick={() => handleTable(true)}
              value="list"
              aria-label="list"
            >
              <ViewListIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        {/* Filter & Sort controls */}
        <div
          data-aos="fade-down"
          data-aos-anchor-placement="top-bottom"
          data-aos-easing="linear"
          data-aos-duration="1000"
          className="flex container mx-auto justify-center md:justify-center"
        >
          <div className="flex flex-col md:flex-row items-center gap-4">
            <label className="text-sm font-semibold text-gray-700">
              {t('home.volunteerNeeds.needVolunteer.filterByCategory')}
            </label>

            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="rounded-lg border border-gray-500/60 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? t('common.all') : c}
                </option>
              ))}
            </select>

            <label className="text-sm font-semibold text-gray-700">
              {t('home.volunteerNeeds.needVolunteer.sortByDeadline')}
            </label>

            <select
              value={deadlineSort}
              onChange={handleSortChange}
              className="rounded-lg border border-gray-500/60 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">{t('home.volunteerNeeds.needVolunteer.sort.none')}</option>
              <option value="asc">{t('home.volunteerNeeds.needVolunteer.sort.asc')}</option>
              <option value="desc">{t('home.volunteerNeeds.needVolunteer.sort.desc')}</option>
            </select>
          </div>

        </div>
        <div
          data-aos="fade-down"
          data-aos-anchor-placement="top-bottom"
          data-aos-easing="linear"
          data-aos-duration="1000"
          className="flex container  mx-auto justify-center my-8 md:justify-end"
        >
          <div className="relative flex p-1 border rounded-lg focus-within:ring focus-within:ring-opacity-40 focus-within:border-blue-400 focus-within:ring-blue-300">
            <input
              className="px-6 py-2 border-none text-gray-700 placeholder-gray-500 bg-white outline-none focus:placeholder-transparent"
              type="text"
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (!showSuggestions || suggestions.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveSuggestionIndex((prev) => {
                    const next = Math.min(prev + 1, suggestions.length - 1);
                    return next;
                  });
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveSuggestionIndex((prev) => {
                    const next = Math.max(prev - 1, 0);
                    return next;
                  });
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
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                // Delay to allow click selection via onMouseDown
                setTimeout(() => setShowSuggestions(false), 100);
              }}
              value={searchText}
              name="search"
              placeholder={t('home.volunteerNeeds.needVolunteer.searchPlaceholder')}
              aria-label="Enter the Post Title"
            />

            <button
                onClick={() => handleSearch()}
                type="button"
                className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium uppercase leading-normal text-white shadow transition duration-150 ease-in-out hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 active:bg-blue-800"
              >
                Search
              </button>
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-2 z-10 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow">
                {suggestions.map((s, idx) => (
                  <li
                    key={`${s}-${idx}`}
                    className={
                      (idx === activeSuggestionIndex
                        ? "bg-blue-50"
                        : "bg-white") +
                      " cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                    }
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
        </div>
      </div>
      {(!Array.isArray(volunteers) || volunteers.length === 0) && showLoader ? (
        <LoadingGif></LoadingGif>
      ) : (
        <div>
          <div className={gridView ? "block" : "hidden"}>
            <div className=" container mx-auto mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 md:gap-y-12">
              {displayedVolunteers.map((volunteer) => (
                <VolunteerNeedsCard
                  volunteer={volunteer}
                  key={volunteer._id}
                ></VolunteerNeedsCard>
              ))}
            </div>
          </div>
          <div className={!tableView ? "hidden" : "block"}>
            <div data-aos="fade-up" data-aos-easing="linear" data-aos-duration="1500" className="container mx-auto mt-16">
              <div className="hidden md:block p-8">
                <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                  <table className="min-w-full border-collapse bg-white">
                    {/* head */}
                    <thead>
                      <tr className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm uppercase tracking-wide">
                        <th className="px-4 py-3 text-left rounded-tl-xl">{t('home.volunteerNeeds.needVolunteer.table.index')}</th>
                        <th className="px-4 py-3 text-left">{t('home.volunteerNeeds.needVolunteer.table.postTitle')}</th>
                        <th className="px-4 py-3 text-left">{t('home.volunteerNeeds.needVolunteer.table.postedBy')}</th>
                        <th className="px-4 py-3 text-left">{t('home.volunteerNeeds.needVolunteer.table.category')}</th>
                        <th className="px-4 py-3 text-left">{t('home.volunteerNeeds.needVolunteer.table.deadline')}</th>
                        <th className="px-4 py-3 text-left">{t('home.volunteerNeeds.needVolunteer.table.location')}</th>
                        <th className="px-4 py-3 text-center">{t('home.volunteerNeeds.needVolunteer.table.volunteerNeeded')}</th>
                        <th className="px-4 py-3 text-center rounded-tr-xl">
                          {t('home.volunteerNeeds.needVolunteer.table.viewDetails')}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {displayedVolunteers.map((post, idx) => (
                        <tr
                          key={post._id}
                          className="border-b border-gray-200 hover:bg-gray-50 transition duration-200"
                        >
                          <td className="px-4 py-3 font-medium text-gray-700 text-left">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800 text-left">
                            {post.post_title}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-left">
                            {post.posted_by || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-left">
                            {post.category}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-left">
                            {post.deadline}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-left">
                            {post.location}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-indigo-600">
                            {post.noOfVolunteer}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link to={`/events/${post._id}`}>
                              <button
                                type="button"
                                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:bg-green-800 transition"
                              >
                                {t('home.volunteerNeeds.needVolunteer.table.viewDetails')}
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>


              {/* Small  */}
              <div>
                <div data-aos="fade-up" data-aos-easing="linear" data-aos-duration="1500" className=" md:hidden">
                  <div className="overflow-x-auto ">
                    <table className="table border-collapse border border-gray-400">
                      {/* head */}
                      <thead>
                        <tr className="text-white raleway text-base bg-[#DE00DF]">
                          <th>{t('home.volunteerNeeds.needVolunteer.table.postTitle')}</th>
                          <th>{t('home.volunteerNeeds.needVolunteer.table.deadline')}</th>
                          <th>{t('home.volunteerNeeds.needVolunteer.table.viewDetails')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* row 1 */}
                        {displayedVolunteers.map((post) => (
                          <tr className="border border-gray-300" key={post._id}>
                            <td>{post.post_title}</td>
                            <td>{post.deadline}</td>
                            <td>
                              <Link to={`/events/${post._id}`}>
                                <button
                                  type="button"
                                  className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:bg-green-800"
                                >
                                  {t('home.volunteerNeeds.needVolunteer.table.viewDetails')}
                                </button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
NeedVolunteer.propTypes = {
  title: PropTypes.string.isRequired,
}
export default NeedVolunteer;