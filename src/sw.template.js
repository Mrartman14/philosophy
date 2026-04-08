const BASE_PATH = '__BASE_PATH__';
const SW_VERSION = '__SW_VERSION__';

const CACHE_PREFIX = 'flbz';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const NEXT_ASSETS_CACHE = `${CACHE_PREFIX}-next-${SW_VERSION}`;
const PAGE_DATA_CACHE = `${CACHE_PREFIX}-pagedata-${SW_VERSION}`;
const LECTURES_PAGE_CACHE = `${CACHE_PREFIX}-lectures-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, NEXT_ASSETS_CACHE, PAGE_DATA_CACHE, LECTURES_PAGE_CACHE, IMAGE_CACHE];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/logo.png`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.webmanifest`,
];
