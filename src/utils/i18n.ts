import i18next from 'i18next';
import { setLanguage as setConfigLanguage } from './Config';
import {tray, createContextMenu} from './Tray';

i18next.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        tray: {
          deezerDiscordRPC: 'Deezer Discord RPC',
          version: 'Version',
          checkForUpdates: 'Check for updates',
          tooltipText: 'Tooltip text',
          appName: 'App name',
          appVersion: 'App version',
          appNameAndVersion: 'App name and version',
          artistsAndTitle: 'Artists song - Song title',
          titleAndArtists: 'Song title - Artists song ',
          language: 'Language',
          dontCloseToTray: "Don't close to tray",
          reconnectRPC: 'Reconnect RPC',
          quit: 'Quit'
        }
      }
    },
    fr: {
      translation: {
        tray: {
          deezerDiscordRPC: 'Deezer Discord RPC',
          version: 'Version',
          checkForUpdates: 'Vérifier les mises à jour',
          tooltipText: 'Texte de l\'infobulle',
          appName: 'Nom de l\'application',
          appVersion: 'Version de l\'application',
          appNameAndVersion: 'Nom et version de l\'application',
          artistsAndTitle: 'Chanson de l\'artiste - Titre de la chanson',
          titleAndArtists: 'Titre de la chanson - Chanson de l\'artiste',
          language: 'Langue',
          dontCloseToTray: 'Ne pas fermer dans la barre d\'état',
          reconnectRPC: 'Reconnecter RPC',
          quit: 'Quitter'
        }
      }
    }
  }
});

export const translate = (key: string, options?: any): string => i18next.t(key, options) as string;

export async function changeLanguage(app: Electron.App, language: string) {
  await i18next.changeLanguage(language);

  setConfigLanguage(app, language);

  if (tray) {
    const updatedMenu = createContextMenu(app);  
    tray.setContextMenu(updatedMenu);
  }

  console.log('Language changed to:', language);
  console.log('Current i18next language:', i18next.language);
}