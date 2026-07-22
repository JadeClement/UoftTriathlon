import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'UofT Triathlon Club';
const SITE_URL = 'https://uoft-tri.club';
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/team-photo1-1200.jpg`;

const ROUTE_META = {
  '/': {
    title: 'UofT Triathlon Club',
    description:
      'University of Toronto Triathlon Club — swim, bike, and run with coached workouts for all levels.',
  },
  '/join-us': {
    title: 'Join Us',
    description:
      'How to join the UofT Triathlon Club: membership options, fees, registration, and getting approved.',
  },
  '/schedule': {
    title: 'Schedule',
    description: 'Weekly swim, bike, and run practice schedule for the UofT Triathlon Club.',
  },
  '/forum': {
    title: 'Forum',
    description: 'Member forum for workout signups, events, and club announcements.',
  },
  '/races': {
    title: 'Races',
    description: 'Upcoming races and team race signups for the UofT Triathlon Club.',
  },
  '/coaches-exec': {
    title: 'Coaches & Exec',
    description: 'Meet the coaches and executive team of the UofT Triathlon Club.',
  },
  '/faq': {
    title: 'FAQ',
    description: 'Frequently asked questions about joining and training with UofT Triathlon.',
  },
  '/resources': {
    title: 'Resources',
    description: 'Training resources and useful links for UofT Triathlon Club members.',
  },
  '/team-gear': {
    title: 'Team Gear',
    description: 'Official UofT Triathlon Club team gear and merchandise.',
  },
  '/results': {
    title: 'Results',
    description: 'Interval and fitness test results for UofT Triathlon Club members.',
  },
  '/login': {
    title: 'Login',
    description: 'Log in or create an account for the UofT Triathlon Club website.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'Privacy policy for the UofT Triathlon Club website and mobile app.',
  },
  '/support': {
    title: 'Support',
    description: 'Get support for the UofT Triathlon Club website and mobile app.',
  },
  '/profile': {
    title: 'Profile',
    description: 'Your UofT Triathlon Club member profile.',
  },
  '/settings': {
    title: 'Settings',
    description: 'App settings for the UofT Triathlon Club mobile app.',
  },
  '/admin': {
    title: 'Admin',
    description: 'Admin dashboard for the UofT Triathlon Club.',
  },
  '/reset-password': {
    title: 'Reset Password',
    description: 'Reset your UofT Triathlon Club account password.',
  },
};

function metaForPath(pathname) {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  if (pathname.startsWith('/admin')) return ROUTE_META['/admin'];
  if (pathname.startsWith('/profile')) return ROUTE_META['/profile'];
  if (pathname.startsWith('/workout/')) {
    return { title: 'Workout', description: 'Workout details and signup for UofT Triathlon Club.' };
  }
  if (pathname.startsWith('/event/')) {
    return { title: 'Event', description: 'Event details for the UofT Triathlon Club.' };
  }
  if (pathname.startsWith('/race/')) {
    return { title: 'Race', description: 'Race details and signup for UofT Triathlon Club.' };
  }
  return {
    title: SITE_NAME,
    description: 'Official website of the University of Toronto Triathlon Club.',
  };
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Sets document title and Open Graph / description meta tags per route.
 */
const PageMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description } = metaForPath(pathname);
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
    const url = `${SITE_URL}${pathname === '/' ? '' : pathname}`;

    document.title = fullTitle;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }, [pathname]);

  return null;
};

export default PageMeta;
