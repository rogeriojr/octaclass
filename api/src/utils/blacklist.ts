export const BLACKLIST = [
  'facebook.com',
  'tiktok.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'netflix.com',
  'youtube.com',
  'twitch.tv'
];

export const isUrlBlocked = (url: string): boolean => {
  return BLACKLIST.some(domain => url.includes(domain));
};
