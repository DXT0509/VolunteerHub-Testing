import { Swiper, SwiperSlide } from 'swiper/react';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import Carousel from './Carousel';
import bg1 from '../../../images/banner/1.jpg'
import bg2 from '../../../images/banner/4.jpg'
import bg3 from '../../../images/banner/2.jpg'
import bg4 from '../../../images/banner/5.jpg'
import bg5 from '../../../images/banner/3.jpg'
import { useTranslation } from 'react-i18next';
const Banner = () => {
  const { t } = useTranslation();
  return (
    <div data-aos="fade-up"
      data-aos-anchor-placement="top-bottom"
      data-aos-easing="linear"
      data-aos-duration="1000" className='pb-10'>
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        loop={true}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={true}
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper"
      >
        <SwiperSlide>
          <Carousel image={bg1} text={t('banner.slide1.title')} paragraph={t('banner.slide1.paragraph')}></Carousel>
        </SwiperSlide>
        <SwiperSlide>
          <Carousel image={bg2} text={t('banner.slide2.title')} paragraph={t('banner.slide2.paragraph')}></Carousel>
        </SwiperSlide>
        <SwiperSlide>
          <Carousel image={bg3} text={t('banner.slide3.title')} paragraph={t('banner.slide3.paragraph')}></Carousel>
        </SwiperSlide>
        <SwiperSlide>
          <Carousel image={bg4} text={t('banner.slide4.title')} paragraph={t('banner.slide4.paragraph')}></Carousel>
        </SwiperSlide>
        <SwiperSlide>
          <Carousel image={bg5} text={t('banner.slide5.title')} paragraph={t('banner.slide5.paragraph')}></Carousel>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};

export default Banner;