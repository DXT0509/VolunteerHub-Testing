import { Link } from "react-router-dom";
import { useTranslation } from 'react-i18next';
const PageError = () => {
  const { t } = useTranslation();
  return (
    <div>
      <section
 
      >
        <div className="container">
          <div className="row">
            <div className="col-sm-12 ">
              <div className="col-sm-10 col-sm-offset-1  text-center">
                <div className="four_zero_four_bg">
                  <h1 className="text-center ">404</h1>
                </div>

                <div className="contant_box_404 space-y-5">
                  <p className="text-5xl">{t('error.noDataTitle', 'Không tìm thấy dữ liệu!')}</p>
                  <p className="text-3xl">{t('error.noDataDesc', 'Vui lòng thêm dữ liệu để hiển thị trang này!')}</p>

                  <Link
                    to={"/"}
                    href=""
                    className="btn bg-green-600 hover:bg-purple-500 text-lg text-white "
                  >
                    {t('common.takeMeHome', 'Về trang chủ')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PageError;
