import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
const Blog = () => {
  const { t } = useTranslation();
  return (
    <div className="mt-40 container mx-auto">
      <div data-aos="fade-up" data-aos-easing="linear" data-aos-duration="2000">
        <h2 className="inter text-5xl font-bold text-center ">
          {t('home.blog.header')}
        </h2>
        <p className="w-2/3 mx-auto mt-4 text-center leading-relaxed text-gray-600">
          {t('home.blog.desc')}
        </p>
      </div>

      <section
        data-aos="fade-down" data-aos-easing="linear" data-aos-duration="1500"
        className="py-10 ws  sm:py-16 lg:py-14">
        <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid  max-w-md grid-cols-1 mx-auto mt-12 lg:max-w-full lg:mt-16 lg:grid-cols-3 gap-x-16 gap-y-12">
            <div>
              <Link to="/article/1" title="" className="block aspect-w-4 aspect-h-3">
                <img
                  className="object-cover w-full h-60"
                  src="https://i.pinimg.com/1200x/dc/08/84/dc088443f1868f92e551950be6d1802c.jpg"
                  alt=""
                />
              </Link>
              <span className="inline-flex px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full text-rose-500 bg-rose-100 mt-9">
                Technology
              </span>
              <p className="mt-6 text-xl font-semibold">
                <Link to="/article/1" title="">
                  Optimizing volunteer management with technology.
                </Link>
              </p>
              
              <p className="mt-4 text-gray-500">
                {t('home.blog.posts.1.desc')}
              </p>
              <div className="h-0 mt-6 mb-4 border-t-2 border-gray-200 border-dashed"></div>
            </div>

            <div>
              <Link to="/article/2" title="" className="block aspect-w-4 aspect-h-3">
                <img
                  className="object-cover w-full h-60"
                  src="https://images.stockcake.com/public/1/9/7/197e7e58-c543-43c2-980e-4ab7ae1026fa_large/anime-office-teamwork-stockcake.jpg"
                  alt=""
                />
              </Link>
              <span className="inline-flex px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full text-sky-500 bg-sky-100 mt-9">
                Initiative
              </span>
              <p className="mt-6 text-xl font-semibold">
                <Link to="/article/2" title="">
                  Balancing remote work with volunteer work.
                </Link>
              </p>
              <p className="mt-4 text-gray-500">
                {t('home.blog.posts.2.desc')}
              </p>
              <div className="h-0 mt-6 mb-4 border-t-2 border-gray-200 border-dashed"></div>
            </div>

            <div>
              <Link to="/article/3" title="" className="block aspect-w-4 aspect-h-3">
                <img
                  className="object-cover w-full h-60"
                  src="https://3.files.edl.io/0b2a/24/01/29/162828-0e29dfbb-09a6-4ef3-8535-b86eae10381e.jpeg"
                  alt=""
                />
              </Link>
              <span className="inline-flex px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full text-sky-500 bg-sky-100 mt-9">
                Inspire
              </span>
              <p className="mt-6 text-xl font-semibold">
                <Link to="/article/3" title="">
                  Spreading the spirit of volunteerism in the community.
                </Link>
              </p>
              <p className="mt-4 text-gray-500">
                {t('home.blog.posts.3.desc')}
              </p>
              <div className="h-0 mt-6 mb-4 border-t-2 border-gray-200 border-dashed"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;