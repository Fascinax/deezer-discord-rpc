import { join } from 'path';
import updater from './Updater';
import * as Config from './Config';
import * as RPC from './RPC';
import { Menu, Tray } from 'electron';
import { version } from '../../package.json';
import { log } from './Log';
import { win } from './Window';
import { i18n, changeLanguage } from './i18n';

const iconPath = join(__dirname, '..', 'img', 'tray.png');

export let tray: Tray | null = null;
export async function init(app: Electron.App, client: import('@xhayper/discord-rpc').Client) {
  app?.whenReady().then(() => {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: i18n.t('tray.deezerDiscordRPC'), type: 'normal', click: () => win.show() },
      { label: `${i18n.t('tray.version')}: ${version}${process.argv0.includes('node') ? ' (debug)' : ''}`, type: 'normal', enabled: false },
      { label: i18n.t('tray.checkForUpdates'), type: 'normal', click: () => updater() },
      { type: 'separator' },
      {
        label: i18n.t('tray.tooltipText'), type: 'submenu', submenu: [
          [i18n.t('tray.appName'), 'app_name'],
          [i18n.t('tray.appVersion'), 'app_version'],
          [i18n.t('tray.appNameAndVersion'), 'app_name_and_version'],
          [i18n.t('tray.artistsAndTitle'), 'artists_and_title'],
          [i18n.t('tray.titleAndArtists'), 'title_and_artists'],
        ].map(v => ({
          label: v[0], type: 'radio', id: v[1], checked: Config.get(app, 'tooltip_text') === v[1],
          click: (menuItem) => Config.set(app, 'tooltip_text', menuItem.id)
        }))
      },
      {
        label: i18n.t('tray.language'), type: 'submenu', submenu: [
          { label: 'English', type: 'radio', id: 'en', checked: Config.getLanguage(app) === 'en', click: () => changeLanguage(app, 'en') },
          { label: 'Français', type: 'radio', id: 'fr', checked: Config.getLanguage(app) === 'fr', click: () => changeLanguage(app, 'fr') }
        ]
      },
      {
        label: i18n.t('tray.dontCloseToTray'), type: 'checkbox', checked: Config.get(app, 'dont_close_to_tray'),
        click: (menuItem) => Config.set(app, 'dont_close_to_tray', menuItem.checked)
      },
      {
        id: 'reconnect',
        label: i18n.t('tray.reconnectRPC'),
        type: 'normal',
        visible: false,
        click: () => {
          client.login()
            .then(() => {
              log('RPC', 'Reconnected');
            })
            .catch(console.error);
        }
      },
      { type: 'separator' },
      {
        label: i18n.t('tray.quit'), type: 'normal', click: async () => {
          RPC.disconnect().catch(console.error);
          win.close();
          app.quit();
          process.exit(0);
        }
      }
    ]);

    tray.setToolTip('Deezer Discord RPC');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (!win.isVisible()) win.show();
    });
  });
}
