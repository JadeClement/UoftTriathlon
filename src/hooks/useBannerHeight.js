import { useState, useEffect, useRef } from 'react';

const useBannerHeight = () => {
  const [bannerHeight, setBannerHeight] = useState(0);
  const bannerRef = useRef(null);

  useEffect(() => {
    const updateBannerHeight = () => {
      if (bannerRef.current) {
        const height = bannerRef.current.offsetHeight;
        setBannerHeight(height);
        console.log('📏 Banner height measured:', height + 'px');
      }
    };

    // Initial measurement
    updateBannerHeight();

    // Re-measure on window resize
    window.addEventListener('resize', updateBannerHeight);

    // Use ResizeObserver for more accurate measurements
    if (bannerRef.current) {
      const resizeObserver = new ResizeObserver(updateBannerHeight);
      resizeObserver.observe(bannerRef.current);
      
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateBannerHeight);
      };
    }

    return () => {
      window.removeEventListener('resize', updateBannerHeight);
    };
  }, []);

  return { bannerHeight, bannerRef };
};

export default useBannerHeight;
