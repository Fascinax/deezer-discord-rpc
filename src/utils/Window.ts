import { userAgent } from '../variables';
import { join, resolve } from 'path';
import loadAdBlock from './AdBlock';
import * as Config from './Config';
import * as DiscordWebSocket from './DiscordWebSocket';
import * as RPC from './RPC';
import { log } from './Log';
import { runJs, wait } from '../functions';
import { BrowserWindow, ipcMain, shell, nativeImage, session } from 'electron';
import { setActivity } from './Activity';

export let win: BrowserWindow;
let currentTrack: CurrentTrack;

export async function load(app: Electron.App) {
  const width = parseInt(Config.get(app, 'window_width')) || 1920;
  const height = parseInt(Config.get(app, 'window_height')) || 1080;
  win = new BrowserWindow({
    width, height,
    minimizable: true,
    maximizable: true,
    closable: true,
    resizable: true,
    center: true,
    title: 'Deezer Discord RPC',
    icon: join(__dirname, '..', 'img', 'app.ico'),
    webPreferences: {
      preload: resolve(__dirname, '..', 'preload.js')
    }
  });
  if (width === 1920 && height === 1080) win.maximize();
  win.focus();
  win.show();
  win.setMenuBarVisibility(process.platform === 'darwin');

  await loadAdBlock(app, win);

  await win.loadURL('https://www.deezer.com/login', {
    // The default user agent does not work with Deezer (the player does not update by itself)
    userAgent
  });

  await setThumbarButtons();

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('deezer.com')) {
      details.requestHeaders['User-Agent'] = userAgent;
    }
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // delete details.responseHeaders['cross-origin-opener-policy'];
    // delete details.responseHeaders['cross-origin-opener-policy-report-only'];
    callback({ cancel: false, responseHeaders: details.responseHeaders });
  });

  win.on('resized', () => {
    const [w, h] = win.getSize();
    Config.set(app, 'window_width', w);
    Config.set(app, 'window_height', h);
  });

  win.webContents.setWindowOpenHandler((details) => {
    if (details.url.includes('facebook.com') || details.url.includes('apple.com') || details.url.includes('accounts.google.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          center: true,
          maximizable: true,
          minimizable: true,
          closable: true,
          autoHideMenuBar: true,
          fullscreenable: false,
          resizable: true,
          title: 'Deezer Discord RPC',
          icon: join(__dirname, '..', 'img', 'app.ico'),
        }
      };
    } else {
      shell.openExternal(details.url);
      return { action: 'deny' };
    }
  });

  win.on('close', (e) => {
    if (Config.get(app, 'dont_close_to_tray')) {
      return true;
    }
    e.preventDefault();
    win.hide();

    return false;
  });

  wait(5000).then(() => {
    runJs(`document.querySelector('.slider-track-input.mousetrap').addEventListener('click', () => ipcRenderer.send('update_activity', true))
                 const trackObserver = new MutationObserver(() => ipcRenderer.send('update_activity', false));
                 trackObserver.observe(document.querySelector('[data-testid="item_title"] a'), { childList: true, subtree: true, characterData: true });
                 const playingObserver = new MutationObserver(() => ipcRenderer.send('update_activity', false));
                 playingObserver.observe(document.querySelector('.chakra-button__group > button[data-testid^="play_button_"]'), { childList: true, subtree: true });`);
    ipcMain.on('update_activity', (e, currentTimeChanged) => updateActivity(app, currentTimeChanged));
    runJs(`const chakraStack = document.querySelector('#dzr-app > div > div.css-efpag6 > div.chakra-stack.css-w8kdg9');
                 const navContainer = document.createElement('div');
                 navContainer.style.display = 'flex';
                 navContainer.style.justifyContent = 'space-around';
                 const backButton = document.createElement('button');
                 backButton.addEventListener('click', () => ipcRenderer.send('nav_back'));
                 backButton.textContent = '<';
                 backButton.style.transform = 'scale(2, 4)';
                 const forwardButton = document.createElement('button');
                 forwardButton.addEventListener('click', () => ipcRenderer.send('nav_forward'));
                 forwardButton.textContent = '>';
                 forwardButton.style.transform = 'scale(2, 4)';
                 navContainer.appendChild(backButton);
                 navContainer.appendChild(forwardButton);
                 chakraStack.children[0].replaceWith(navContainer);`);
    ipcMain.on('nav_back', () => win.webContents.goBack());
    ipcMain.on('nav_forward', () => win.webContents.goForward());
    setThumbarButtons();
  });
}

export async function showWindow() {
  win.show();
}

export async function setThumbarButtons() {
  const hasPreviousSong = await runJs('!!dzPlayer.getPrevSong()');
  const hasNextSong = await runJs('!!dzPlayer.getNextSong()');
  const isPlaying = await runJs('dzPlayer.isPlaying()');

  const updated = win.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(join(__dirname, '..', 'img', `previous${hasPreviousSong ? '' : '_inactive'}.png`)),
      click(){ runJs('dzPlayer.control.prevSong()'); }
    }, {
      icon: nativeImage.createFromPath(join(__dirname, '..', 'img', `${isPlaying ? 'pause' : 'play'}.png`)),
      click(){ runJs('dzPlayer.control.togglePause()'); }
    }, {
      icon: nativeImage.createFromPath(join(__dirname, '..', 'img', `next${hasNextSong ? '' : '_inactive'}.png`)),
      click(){ runJs('dzPlayer.control.nextSong()'); }
    }
  ]);
  if (updated) {
    log('Thumbnail Buttons', 'Updated buttons');
  } else {
    log('Thumbnail Buttons', 'Failed to update buttons');
  }
}

const UpdateReason = {
  MUSIC_CHANGED: 'music got changed',
  MUSIC_PAUSED: 'music got paused',
  MUSIC_PLAYED: 'music got played',
  MUSIC_TIME_CHANGED: 'current song time changed',
  MUSIC_NOT_RIGHT_TIME: 'song time wasn\'t the right one'
};

async function updateActivity(app: Electron.App, currentTimeChanged?: boolean) {
  setThumbarButtons();

  const client = (Config.get(app, 'use_listening_to') ? DiscordWebSocket : RPC).client;
  const code =
    `(() => {
      const albumId = document.querySelector('.track-link[href*="album"]')?.getAttribute('href').split('/')[3];
      const trackId = dzPlayer.getSongId() || dzPlayer.getRadioId();
      const radioType = dzPlayer.getRadioType();
      const playerType = dzPlayer.getPlayerType();
      const mediaType = dzPlayer.getMediaType();
      const isLivestreamRadio = playerType === 'radio' && radioType === 'livestream';
      const playerInfo = document.querySelector('.track-title .marquee-content')?.textContent;
      const trackName = dzPlayer.getSongTitle() + (dzPlayer.getCurrentSong()?.VERSION ? ' ' + dzPlayer.getCurrentSong()?.VERSION : '') || 
                        dzPlayer.getCurrentSong()?.LIVESTREAM_TITLE || dzPlayer.getCurrentSong()?.EPISODE_TITLE || playerInfo;
      const albumName = (!isLivestreamRadio ? dzPlayer.getAlbumTitle() : dzPlayer.getCurrentSong().LIVESTREAM_TITLE) ||
                        dzPlayer.getCurrentSong()?.SHOW_NAME || playerInfo;
      const artists = dzPlayer.getCurrentSong()?.ARTISTS?.map(art => art.ART_NAME)?.join(', ') || dzPlayer.getArtistName() || 
                      dzPlayer.getCurrentSong()?.SHOW_NAME || playerInfo?.split(' · ')?.[1];
      const playing = dzPlayer.isPlaying();
      const songTime = Math.floor(dzPlayer.getDuration() * 1000);
      const timeLeft = Math.floor(dzPlayer.getRemainingTime() * 1000);
      const cover = dzPlayer.getCurrentSong()?.LIVESTREAM_IMAGE_MD5 || dzPlayer.getCurrentSong()?.EPISODE_IMAGE_MD5 ||
                    dzPlayer.getCurrentSong()?.SHOW_ART_MD5 || dzPlayer.getCover();
      let coverType = 'misc';
      if (mediaType === 'song') coverType = 'cover';
      if (mediaType === 'episode') coverType = 'talk';
      const coverUrl = \`https://e-cdns-images.dzcdn.net/images/\${coverType}/\${cover}/256x256-000000-80-0-0.jpg\`;
      return JSON.stringify({ albumId, trackId, mediaType, playerType, trackName, albumName, artists, playing, songTime, timeLeft, coverUrl, isLivestreamRadio });
    })()`;
  runJs(code).then(async (r) => {
    const result: JSResult = JSON.parse(r);
    const realSongTime = result.songTime;
    if (currentTrack && !currentTrack?.songTime) currentTrack.songTime = realSongTime;
    if (
      currentTrack?.trackTitle !== result.trackName || currentTrack?.playing !== result.playing || currentTimeChanged === true ||
      currentTrack?.songTime !== realSongTime
    ) {
      let reason;
      if (currentTrack?.trackTitle !== result.trackName) {
        reason = UpdateReason.MUSIC_CHANGED;
      }
      else if (currentTrack?.playing !== result.playing) {
        reason = result.playing ? UpdateReason.MUSIC_PLAYED : UpdateReason.MUSIC_PAUSED;
      }
      else if (currentTimeChanged && currentTimeChanged === true) reason = UpdateReason.MUSIC_TIME_CHANGED;
      else if (currentTrack?.songTime !== realSongTime) reason = UpdateReason.MUSIC_NOT_RIGHT_TIME;
      log('Activity', 'Updating because', reason);
      // @ts-expect-error wrong type
      currentTrack = {
        trackId: result.trackId,
        trackTitle: result.trackName,
        trackArtists: result.playerType === 'mod' && !result.artists ? 'Unknown' : result.artists || result.playerType.replace(result.playerType[0], result.playerType[0].toUpperCase()),
        albumCover: result.coverUrl,
        albumTitle: result.albumName || result.trackName,
        playing: result.playing,
      };

      await setActivity({
        client, albumId: result.albumId, timeLeft: result.timeLeft, app, ...currentTrack, type: result.mediaType
      }).then(() => log('Activity', 'Updated'));
    }
    currentTrack.songTime = realSongTime;
    currentTrack.trackTitle = result.trackName;
    currentTrack.playing = result.playing;
  });
}

interface CurrentTrack {
  songTime: number,
  trackId: string,
  trackTitle: string,
  trackArtists: string,
  albumTitle: string,
  albumCover: string,
  playing: boolean,
  radioCover: string,
}

interface JSResult {
  songTime: number,
  timeLeft: number,
  trackName: string,
  albumId: number,
  playing: boolean,
  coverUrl?: string,
  playerType: 'track' | 'radio' | 'ad' | 'mod',
  artists: string,
  albumName: string,
  isLivestreamRadio: boolean,
  mediaType: string,
  trackId: string
}
