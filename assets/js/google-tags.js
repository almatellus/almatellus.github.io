// Shared Google tags. Cookiebot in GTM manages consent updates.
(function () {
  'use strict';
  if (window.ALMA_GOOGLE_TAGS_LOADED) return;
  window.ALMA_GOOGLE_TAGS_LOADED = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied',
    functionality_storage: 'denied', personalization_storage: 'denied',
    security_storage: 'granted', wait_for_update: 2000
  });

  var conversionSent = false;
  function trackPageView() {
    if (conversionSent || !window.Cookiebot || !window.Cookiebot.consent ||
        window.Cookiebot.consent.marketing !== true) return;
    conversionSent = true;
    // Do not send query strings or fragments, which can contain personal links.
    var pageUrl = window.location.origin + window.location.pathname;
    window.gtag('js', new Date());
    window.gtag('config', 'AW-18503222448', { page_location: pageUrl });
    window.gtag('event', 'conversion', {
      send_to: 'AW-18503222448/h5RZCK_blZkdELCJg_dE',
      value: 1.0, currency: 'USD', page_location: pageUrl
    });
    var ads = document.createElement('script');
    ads.async = true;
    ads.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18503222448';
    document.head.appendChild(ads);
  }
  window.addEventListener('CookiebotOnConsentReady', trackPageView);
  window.addEventListener('CookiebotOnAccept', trackPageView);

  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var gtm = document.createElement('script');
  gtm.async = true;
  gtm.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-P7W5Z9L7';
  document.head.appendChild(gtm);
  trackPageView();
})();

