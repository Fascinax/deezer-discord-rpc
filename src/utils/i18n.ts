import i18next from 'i18next';

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
          artistsAndTitle: 'Artists and title',
          titleAndArtists: 'Title and artists',
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
          tooltipText: 'Texte de l\'info-bulle',
          appName: 'Nom de l\'application',
          appVersion: 'Version de l\'application',
          appNameAndVersion: 'Nom et version de l\'application',
          artistsAndTitle: 'Artistes et titre',
          titleAndArtists: 'Titre et artistes',
          language: 'Langue',
          dontCloseToTray: 'Ne pas fermer dans la barre d\'état',
          reconnectRPC: 'Reconnecter RPC',
          quit: 'Quitter'
        }
      }
    }
  }
});

export function changeLanguage(app: Electron.App, language: string) {
  i18next.changeLanguage(language);
  Config.setLanguage(app, language);
}
