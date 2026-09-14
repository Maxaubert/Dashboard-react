import {
  GithubLogo, YoutubeLogo, DiscordLogo, SpotifyLogo, SteamLogo,
  TwitchLogo, RedditLogo, OpenAiLogo, GoogleLogo, GoogleChromeLogo,
  GoogleDriveLogo, GooglePhotosLogo, GooglePlayLogo, NotionLogo,
  SlackLogo, MicrosoftTeamsLogo, MicrosoftOutlookLogo, MicrosoftWordLogo,
  MicrosoftExcelLogo, MicrosoftPowerpointLogo, FigmaLogo, GitlabLogo,
  CodepenLogo, CodesandboxLogo, StackOverflowLogo, DropboxLogo,
  InstagramLogo, FacebookLogo, MessengerLogo, WhatsappLogo, TelegramLogo,
  TiktokLogo, XLogo, LinkedinLogo, PinterestLogo, AppleLogo,
  AppStoreLogo, AndroidLogo, WindowsLogo, LinuxLogo, AmazonLogo,
  PaypalLogo, PatreonLogo, SoundcloudLogo,
  type Icon,
} from '@phosphor-icons/react';
import type { SvgIcon } from './svgIcons';

/** App logos from the existing Phosphor library, bundled for offline use. */
function appIcon(id: string, label: string, Logo: Icon): SvgIcon {
  return {
    id,
    label,
    Component: function AppIcon({ size = 18, className }: { size?: number; className?: string }) {
      return <Logo size={size} weight="fill" className={className} aria-hidden="true" />;
    },
  };
}

export const APP_ICONS: SvgIcon[] = [
  appIcon('github', 'GitHub', GithubLogo),
  appIcon('youtube', 'YouTube', YoutubeLogo),
  appIcon('discord', 'Discord', DiscordLogo),
  appIcon('spotify', 'Spotify', SpotifyLogo),
  appIcon('steam', 'Steam', SteamLogo),
  appIcon('twitch', 'Twitch', TwitchLogo),
  appIcon('reddit', 'Reddit', RedditLogo),
  appIcon('openai', 'ChatGPT / OpenAI', OpenAiLogo),
  appIcon('google', 'Google', GoogleLogo),
  appIcon('google-chrome', 'Google Chrome', GoogleChromeLogo),
  appIcon('google-drive', 'Google Drive', GoogleDriveLogo),
  appIcon('google-photos', 'Google Foto', GooglePhotosLogo),
  appIcon('google-play', 'Google Play', GooglePlayLogo),
  appIcon('notion', 'Notion', NotionLogo),
  appIcon('slack', 'Slack', SlackLogo),
  appIcon('microsoft-teams', 'Microsoft Teams', MicrosoftTeamsLogo),
  appIcon('microsoft-outlook', 'Microsoft Outlook', MicrosoftOutlookLogo),
  appIcon('microsoft-word', 'Microsoft Word', MicrosoftWordLogo),
  appIcon('microsoft-excel', 'Microsoft Excel', MicrosoftExcelLogo),
  appIcon('microsoft-powerpoint', 'Microsoft PowerPoint', MicrosoftPowerpointLogo),
  appIcon('figma', 'Figma', FigmaLogo),
  appIcon('gitlab', 'GitLab', GitlabLogo),
  appIcon('codepen', 'CodePen', CodepenLogo),
  appIcon('codesandbox', 'CodeSandbox', CodesandboxLogo),
  appIcon('stack-overflow', 'Stack Overflow', StackOverflowLogo),
  appIcon('dropbox', 'Dropbox', DropboxLogo),
  appIcon('instagram', 'Instagram', InstagramLogo),
  appIcon('facebook', 'Facebook', FacebookLogo),
  appIcon('messenger', 'Messenger', MessengerLogo),
  appIcon('whatsapp', 'WhatsApp', WhatsappLogo),
  appIcon('telegram', 'Telegram', TelegramLogo),
  appIcon('tiktok', 'TikTok', TiktokLogo),
  appIcon('x-twitter', 'X / Twitter', XLogo),
  appIcon('linkedin', 'LinkedIn', LinkedinLogo),
  appIcon('pinterest', 'Pinterest', PinterestLogo),
  appIcon('apple', 'Apple', AppleLogo),
  appIcon('app-store', 'App Store', AppStoreLogo),
  appIcon('android', 'Android', AndroidLogo),
  appIcon('windows', 'Windows', WindowsLogo),
  appIcon('linux', 'Linux', LinuxLogo),
  appIcon('amazon', 'Amazon', AmazonLogo),
  appIcon('paypal', 'PayPal', PaypalLogo),
  appIcon('patreon', 'Patreon', PatreonLogo),
  appIcon('soundcloud', 'SoundCloud', SoundcloudLogo),
];
