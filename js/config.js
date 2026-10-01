// Which copy of the app this is. The personal copy (me/index.html) sets <meta name="si-app" content="me">.
// Each copy keeps its own storage, offline cache and mode list so the two never mix.
const isMe = document.querySelector('meta[name="si-app"]')?.content === 'me';

export const APP = isMe ? {
  id: 'me',
  dbName: 'skill-issue-me',
  draftKey: 'si-me-draft',
  player: 'PoppaGerbil.VHS#4073',
  profileUrl: 'https://finals.id/player/PoppaGerbil.VHS%234073',
  modes: ['Pointbreak', 'Cashout', 'Ranked', 'Quick Cash', 'Bots', 'Other'],
  swUrl: 'sw.js?app=me', swScope: 'me/',
} : {
  id: 'public',
  dbName: 'skill-issue',
  draftKey: 'si-draft',
  player: null,
  profileUrl: null,
  modes: ['Pointbreak', 'Cashout', 'Ranked', 'Other'],
  swUrl: 'sw.js', swScope: './',
};
