import { useState, useEffect } from 'react';

export function useDeviceDetection() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const detectDevice = () => {
      // Détection des appareils tactiles
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(hasTouchScreen);

      // Détection de la taille d'écran pour tablette/mobile
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Détection tablette (Surface, iPad, etc.)
      const isTabletDevice = hasTouchScreen && 
        ((screenWidth >= 768 && screenWidth <= 1024) || 
         (screenHeight >= 768 && screenHeight <= 1024) ||
         /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)|Surface/i.test(navigator.userAgent));
      
      setIsTablet(isTabletDevice);
      
      // Détection mobile
      const isMobileDevice = hasTouchScreen && 
        (screenWidth < 768 || 
         /Android(?=.*\bMobile\b)|iPhone|iPod/i.test(navigator.userAgent));
      
      setIsMobile(isMobileDevice);
    };

    detectDevice();
    
    // Réécouter lors du changement d'orientation
    window.addEventListener('resize', detectDevice);
    window.addEventListener('orientationchange', detectDevice);

    return () => {
      window.removeEventListener('resize', detectDevice);
      window.removeEventListener('orientationchange', detectDevice);
    };
  }, []);

  return {
    isTouchDevice,
    isTablet,
    isMobile,
    isDesktop: !isTouchDevice && !isTablet && !isMobile
  };
} 