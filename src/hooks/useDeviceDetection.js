import { useState, useEffect } from 'react';

export const useDeviceDetection = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    isTouchDevice: false,
    isTablet: false,
    isIPad: false,
    isMobile: false,
    screenWidth: 0,
    screenHeight: 0
  });

  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Détection des appareils tactiles
      const isTouchDevice = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 || 
                           navigator.msMaxTouchPoints > 0;
      
      // Détection spécifique iPad
      const isIPad = /ipad/.test(userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Détection tablette (largeur d'écran entre 768px et 1024px ou iPad)
      const isTablet = isIPad || 
                      (screenWidth >= 768 && screenWidth <= 1024) ||
                      (screenWidth >= 1024 && screenWidth <= 1366 && isTouchDevice);
      
      // Détection mobile
      const isMobile = screenWidth < 768 || 
                      /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

      setDeviceInfo({
        isTouchDevice,
        isTablet,
        isIPad,
        isMobile,
        screenWidth,
        screenHeight
      });
    };

    // Détection initiale
    detectDevice();

    // Réécouter les changements de taille d'écran
    window.addEventListener('resize', detectDevice);
    
    // Nettoyage
    return () => {
      window.removeEventListener('resize', detectDevice);
    };
  }, []);

  return deviceInfo;
}; 