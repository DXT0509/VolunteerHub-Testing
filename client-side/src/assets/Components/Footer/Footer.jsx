import { Link } from "react-router-dom";
import { IoLocationSharp } from "react-icons/io5";
import { FaPhoneSquareAlt } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import logo from "../Navbar/logo.png";
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  return (
      <footer className="mt-10 py-6 font-qs px-4 divide-y bg-gray-700 text-white">
        <div className="container grid grid-cols-1 gap-10 items-start py-10 mx-auto sm:grid-cols-2 lg:grid-cols-3">
        
        {/* VOLUNTEERHUB (Logo + Home) */}
        <div className="space-y-4">
          <Link
            to="/"
            className="flex justify-center lg:justify-start cursor-pointer inter gap-2 items-center"
          >
            <img
              className="size-8 md:size-12 rounded"
              src={logo}
              alt="VolunteerHub"
            />
            <h2 className="font-bold text-xl md:text-2xl">
              <span className="text-green-500">Volunteer</span>Hub
            </h2>
          </Link>
        </div>

        {/* CONTACT */}
        <div className="space-y-3 text-sm">
          <h3 className="uppercase text-gray-900 font-bold">{t('footer.contact.title')}</h3>
          <ul className="space-y-2">
            <li>
              <a className="flex gap-2 items-center">
                <FaPhoneSquareAlt className="size-6" />
                +84 123 456 789
              </a>
            </li>
            <li>
              <a
                href="mailto:nahidbinwadood@gmail.com"
                className="flex gap-2 items-center"
              >
                <MdEmail className="size-6" />
                thainguyenzeno@gmail.com
              </a>
            </li>
            <li className="flex gap-2 items-center">
              <IoLocationSharp className="size-6" />
              <span>Hanoi, Vietnam</span>
            </li>
          </ul>
        </div>
        {/* SOCIAL MEDIA */}
        <div className="space-y-3 text-sm">
          <div className="uppercase text-gray-900 font-bold">{t('footer.social.title')}</div>
          <div className="flex justify-start space-x-3">
            <a
              href="https://www.facebook.com/thainguyenzeno"
              target="_blank"
              rel="noopener noreferrer"
              title={t('footer.facebook') || 'Facebook'}
              className="flex items-center p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 32 32"
                className="w-5 h-5 fill-current"
              >
                <path d="M32 16c0-8.839-7.167-16-16-16-8.839 0-16 7.161-16 16 0 7.984 5.849 14.604 13.5 15.803v-11.177h-4.063v-4.625h4.063v-3.527c0-4.009 2.385-6.223 6.041-6.223 1.751 0 3.584 0.312 3.584 0.312v3.937h-2.021c-1.984 0-2.604 1.235-2.604 2.5v3h4.437l-0.713 4.625h-3.724v11.177c7.645-1.199 13.5-7.819 13.5-15.803z" />
              </svg>
            </a>
            <a
              href="https://www.youtube.com/@xt-aorongmobile9890"
              target="_blank"
              rel="noopener noreferrer"
              title={t('footer.youtube') || 'YouTube'}
              className="flex items-center p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M23.498 6.186a3.02 3.02 0 0 0-2.124-2.136C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.374.55A3.02 3.02 0 0 0 .502 6.186 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .502 5.814 3.02 3.02 0 0 0 2.124 2.136C4.5 20.5 12 20.5 12 20.5s7.5 0 9.374-.55a3.02 3.02 0 0 0 2.124-2.136A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>
        </div>
        {/* COPYRIGHT */}
      <div className="py-6 text-sm text-center text-white">
        {t('footer.copyright') || '2025 VolunteerHub Team. Our team members: Dao Xuan Thao, Nguyen Phu Thai, Nguyen Anh Hao'}
      </div>
      </footer>

      
  );
};

export default Footer;