/**
 * Curated icon catalog for the link library.
 *
 * Two sources are mixed in:
 *   - `lucide-react` provides the outline icons (the bulk of the catalog)
 *   - `@phosphor-icons/react` provides the FILLED variants — wrapped via
 *     `filled()` so the icon component is pre-bound to `weight="fill"`
 *
 * Each entry has a stable `id` stored in `LinkItem.iconValue` when
 * `iconType === 'svg'`. Filled variants use a `-fill` suffix.
 *
 * Backward compatibility: legacy `LinkItem` rows might use lowercase ids
 * from the original hand-rolled SVG_ICONS list (`globe`, `star`, etc.).
 * The LEGACY_ICON_ALIASES map normalizes them to current ids so existing
 * data keeps rendering correctly.
 */
import type { ComponentType } from 'react';
import {
  // Common
  Globe, Star, Heart, Home, Bookmark, Tag, Flag, Link as LinkIcon,
  Search, Bell, Eye, Lock, Key, Shield, Compass, MapPin, Map, Clock,
  Calendar, Settings, Info, Check, CircleAlert, Sun, Moon, Sparkles,
  // People & comms
  User, Users, MessageSquare, Mail, Phone, Megaphone, AtSign, MessagesSquare,
  // Files & data
  File, FileText, Folder, Database, Cloud, Server, Save, Download, Upload,
  Share2, Copy, Clipboard, Archive, Trash2, Paperclip, Hash,
  // Devices
  Monitor, Smartphone, Laptop, Tv, Camera, Headphones, Mic, Wifi, Bluetooth,
  Battery, Plug, Printer, Keyboard, Mouse, HardDrive, Router,
  // Media
  Film, Music, Image, Video, Play, Pause, Volume2, Radio, Disc, Podcast,
  // Code & dev
  Code, Code2, Terminal, GitBranch, GitFork, Cpu, Bug, Braces, Boxes,
  // Productivity
  Briefcase, GraduationCap, BookOpen, Pencil, Edit, ListChecks, Kanban,
  CalendarDays, Notebook, NotebookPen, StickyNote, Target, TrendingUp,
  LineChart, BarChart3, PieChart, Activity, ChartNoAxesCombined,
  // Shopping & finance
  ShoppingCart, ShoppingBag, CreditCard, Wallet, DollarSign, Euro, Banknote,
  Receipt, Coins, BadgePercent,
  // Travel & places
  Plane, Car, Bus, Train, Ship, Bike, Anchor, Tent, Building2, Hotel,
  Landmark, TreePine,
  // Food & lifestyle
  Coffee, Pizza, UtensilsCrossed, Wine, Beer, Cookie, IceCream, Salad,
  Soup,
  // Sports & games
  Trophy, Award, Medal, Dumbbell, Gamepad2, Joystick, Dice5, Goal,
  // Weather & nature
  CloudSun, CloudRain, CloudSnow, Wind, Snowflake, Flame, Leaf, Droplet,
  Rainbow,
  // Symbols & arrows
  Zap, Rocket, Heart as HeartFill, ThumbsUp, ThumbsDown, Crown,
  PawPrint, Layers, Layout, Grid3x3, LayoutDashboard, Package,
  // Misc utility
  Wrench, Hammer, Cog, Lightbulb, Gift, Newspaper, Book, Tv2, BookMarked,
  Palette, Brush,
} from 'lucide-react';

// Filled icons from Phosphor — imported with `Ph` prefix to avoid name
// collisions with lucide. Each one is wrapped via `filled()` below.
import {
  Star as PhStar, Heart as PhHeart, Bookmark as PhBookmark, Flag as PhFlag,
  House as PhHouse, Bell as PhBell, CheckCircle as PhCheckCircle,
  XCircle as PhXCircle, PlusCircle as PhPlusCircle, Circle as PhCircle,
  Square as PhSquare, Triangle as PhTriangle, Folder as PhFolder,
  Tag as PhTag, ShoppingCart as PhShoppingCart, User as PhUser,
  UsersThree as PhUsers, Lock as PhLock, Eye as PhEye, Sun as PhSun,
  Moon as PhMoon, ThumbsUp as PhThumbsUp, Crown as PhCrown, Gift as PhGift,
  Trophy as PhTrophy, MusicNote as PhMusicNote, Camera as PhCamera,
  Cloud as PhCloud, Phone as PhPhone, ChatCircle as PhChat,
  EnvelopeSimple as PhEnvelope, Lightbulb as PhLightbulb, Fire as PhFire,
  Lightning as PhLightning, Mountains as PhMountains, Tree as PhTree,
  Flower as PhFlower, Coffee as PhCoffee, Pizza as PhPizza,
  Wine as PhWine, BeerStein as PhBeer, Rocket as PhRocket,
  AirplaneTilt as PhAirplane, Car as PhCar, Microphone as PhMic,
  Headphones as PhHeadphones, GraduationCap as PhGradCap,
  BookBookmark as PhBookBookmark, Calendar as PhCalendar, Clock as PhClock,
  Compass as PhCompass, MapPin as PhMapPin, Globe as PhGlobe,
  Briefcase as PhBriefcase, GameController as PhGame, Heart as PhHeart2,
  type Icon as PhosphorIconType,
} from '@phosphor-icons/react';

/**
 * A render-able icon component. Typed as `any` props because we mix
 * lucide-react (LucideProps with `size: string | number`) and our own
 * filled wrappers (just `size: number`). Both libraries accept the
 * `size` and `className` props we actually pass.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IconComponent = ComponentType<any>;

/** Wrap a phosphor icon so it always renders with weight="fill". */
function filled(Icon: PhosphorIconType): IconComponent {
  return function FilledIcon({ size = 18, className }: { size?: number; className?: string }) {
    return <Icon size={size} weight="fill" className={className} />;
  };
}

export interface SvgIcon {
  id: string;
  label: string;
  Component: IconComponent;
}

// Suppress unused-import warning for the second Heart import (kept for clarity).
void PhHeart2;

export const SVG_ICONS: SvgIcon[] = [
  // Common
  { id: 'globe',         label: 'Globe',       Component: Globe },
  { id: 'star',          label: 'Stjerne',     Component: Star },
  { id: 'heart',         label: 'Hjerte',      Component: Heart },
  { id: 'home',          label: 'Hjem',        Component: Home },
  { id: 'bookmark',      label: 'Bokmerke',    Component: Bookmark },
  { id: 'tag',           label: 'Tag',         Component: Tag },
  { id: 'flag',          label: 'Flagg',       Component: Flag },
  { id: 'link',          label: 'Lenke',       Component: LinkIcon },
  { id: 'search',        label: 'Søk',         Component: Search },
  { id: 'bell',          label: 'Varsling',    Component: Bell },
  { id: 'eye',           label: 'Se',          Component: Eye },
  { id: 'lock',          label: 'Lås',         Component: Lock },
  { id: 'key',           label: 'Nøkkel',      Component: Key },
  { id: 'shield',        label: 'Sikkerhet',   Component: Shield },
  { id: 'compass',       label: 'Kompass',     Component: Compass },
  { id: 'map-pin',       label: 'Sted',        Component: MapPin },
  { id: 'map',           label: 'Kart',        Component: Map },
  { id: 'clock',         label: 'Klokke',      Component: Clock },
  { id: 'calendar',      label: 'Kalender',    Component: Calendar },
  { id: 'settings',      label: 'Innstillinger', Component: Settings },
  { id: 'info',          label: 'Info',        Component: Info },
  { id: 'check',         label: 'Ferdig',      Component: Check },
  { id: 'alert',         label: 'Varsel',      Component: CircleAlert },
  { id: 'sun',           label: 'Sol',         Component: Sun },
  { id: 'moon',          label: 'Måne',        Component: Moon },
  { id: 'sparkles',      label: 'Glitter',     Component: Sparkles },

  // People & comms
  { id: 'person',        label: 'Person',      Component: User },
  { id: 'people',        label: 'Gruppe',      Component: Users },
  { id: 'message',       label: 'Melding',     Component: MessageSquare },
  { id: 'messages',      label: 'Meldinger',   Component: MessagesSquare },
  { id: 'mail',          label: 'E-post',      Component: Mail },
  { id: 'at-sign',       label: 'Snabel-A',    Component: AtSign },
  { id: 'phone',         label: 'Telefon',     Component: Phone },
  { id: 'megaphone',     label: 'Megafon',     Component: Megaphone },

  // Files & data
  { id: 'file',          label: 'Fil',         Component: File },
  { id: 'file-text',     label: 'Tekstfil',    Component: FileText },
  { id: 'folder',        label: 'Mappe',       Component: Folder },
  { id: 'archive',       label: 'Arkiv',       Component: Archive },
  { id: 'database',      label: 'Database',    Component: Database },
  { id: 'cloud',         label: 'Sky',         Component: Cloud },
  { id: 'server',        label: 'Server',      Component: Server },
  { id: 'save',          label: 'Lagre',       Component: Save },
  { id: 'download',      label: 'Last ned',    Component: Download },
  { id: 'upload',        label: 'Last opp',    Component: Upload },
  { id: 'share',         label: 'Del',         Component: Share2 },
  { id: 'copy',          label: 'Kopier',      Component: Copy },
  { id: 'clipboard',     label: 'Utklippstavle', Component: Clipboard },
  { id: 'trash',         label: 'Søppel',      Component: Trash2 },
  { id: 'paperclip',     label: 'Binders',     Component: Paperclip },
  { id: 'hash',          label: 'Hash',        Component: Hash },

  // Devices
  { id: 'monitor',       label: 'Skjerm',      Component: Monitor },
  { id: 'smartphone',    label: 'Mobil',       Component: Smartphone },
  { id: 'laptop',        label: 'Laptop',      Component: Laptop },
  { id: 'tv',            label: 'TV',          Component: Tv },
  { id: 'tv2',           label: 'TV 2',        Component: Tv2 },
  { id: 'camera',        label: 'Kamera',      Component: Camera },
  { id: 'headphones',    label: 'Hodetelefoner', Component: Headphones },
  { id: 'mic',           label: 'Mikrofon',    Component: Mic },
  { id: 'wifi',          label: 'Wifi',        Component: Wifi },
  { id: 'bluetooth',     label: 'Bluetooth',   Component: Bluetooth },
  { id: 'battery',       label: 'Batteri',     Component: Battery },
  { id: 'plug',          label: 'Strøm',       Component: Plug },
  { id: 'printer',       label: 'Skriver',     Component: Printer },
  { id: 'keyboard',      label: 'Tastatur',    Component: Keyboard },
  { id: 'mouse',         label: 'Mus',         Component: Mouse },
  { id: 'hard-drive',    label: 'Harddisk',    Component: HardDrive },
  { id: 'router',        label: 'Ruter',       Component: Router },

  // Media
  { id: 'film',          label: 'Film',        Component: Film },
  { id: 'music',         label: 'Musikk',      Component: Music },
  { id: 'image',         label: 'Bilde',       Component: Image },
  { id: 'video',         label: 'Video',       Component: Video },
  { id: 'play',          label: 'Spill av',    Component: Play },
  { id: 'pause',         label: 'Pause',       Component: Pause },
  { id: 'volume',        label: 'Lyd',         Component: Volume2 },
  { id: 'radio',         label: 'Radio',       Component: Radio },
  { id: 'disc',          label: 'Plate',       Component: Disc },
  { id: 'podcast',       label: 'Podcast',     Component: Podcast },

  // Code & dev
  { id: 'code',          label: 'Kode',        Component: Code },
  { id: 'code2',         label: 'Kodeblokk',   Component: Code2 },
  { id: 'terminal',      label: 'Terminal',    Component: Terminal },
  { id: 'git-branch',    label: 'Git',         Component: GitBranch },
  { id: 'git-fork',      label: 'Git fork',    Component: GitFork },
  { id: 'cpu',           label: 'CPU',         Component: Cpu },
  { id: 'bug',           label: 'Bug',         Component: Bug },
  { id: 'braces',        label: 'JSON',        Component: Braces },
  { id: 'boxes',         label: 'Pakker',      Component: Boxes },

  // Productivity
  { id: 'briefcase',     label: 'Jobb',        Component: Briefcase },
  { id: 'graduation',    label: 'Utdanning',   Component: GraduationCap },
  { id: 'book',          label: 'Bok',         Component: Book },
  { id: 'book-open',     label: 'Åpen bok',    Component: BookOpen },
  { id: 'book-marked',   label: 'Bokmerket bok', Component: BookMarked },
  { id: 'pencil',        label: 'Blyant',      Component: Pencil },
  { id: 'edit',          label: 'Rediger',     Component: Edit },
  { id: 'list-checks',   label: 'Sjekkliste',  Component: ListChecks },
  { id: 'kanban',        label: 'Kanban',      Component: Kanban },
  { id: 'calendar-days', label: 'Datoer',      Component: CalendarDays },
  { id: 'notebook',      label: 'Notatbok',    Component: Notebook },
  { id: 'notebook-pen',  label: 'Notater',     Component: NotebookPen },
  { id: 'sticky-note',   label: 'Post-it',     Component: StickyNote },
  { id: 'newspaper',     label: 'Avis',        Component: Newspaper },
  { id: 'target',        label: 'Mål',         Component: Target },
  { id: 'trending-up',   label: 'Trend',       Component: TrendingUp },
  { id: 'line-chart',    label: 'Graf',        Component: LineChart },
  { id: 'bar-chart',     label: 'Søylegraf',   Component: BarChart3 },
  { id: 'pie-chart',     label: 'Kakediagram', Component: PieChart },
  { id: 'activity',      label: 'Aktivitet',   Component: Activity },
  { id: 'chart',         label: 'Statistikk',  Component: ChartNoAxesCombined },

  // Shopping & finance
  { id: 'cart',          label: 'Handlekurv',  Component: ShoppingCart },
  { id: 'shopping-bag',  label: 'Pose',        Component: ShoppingBag },
  { id: 'credit-card',   label: 'Kort',        Component: CreditCard },
  { id: 'wallet',        label: 'Lommebok',    Component: Wallet },
  { id: 'dollar',        label: 'Dollar',      Component: DollarSign },
  { id: 'euro',          label: 'Euro',        Component: Euro },
  { id: 'banknote',      label: 'Penger',      Component: Banknote },
  { id: 'receipt',       label: 'Kvittering',  Component: Receipt },
  { id: 'coins',         label: 'Mynter',      Component: Coins },
  { id: 'percent',       label: 'Tilbud',      Component: BadgePercent },

  // Travel & places
  { id: 'plane',         label: 'Fly',         Component: Plane },
  { id: 'car',           label: 'Bil',         Component: Car },
  { id: 'bus',           label: 'Buss',        Component: Bus },
  { id: 'train',         label: 'Tog',         Component: Train },
  { id: 'ship',          label: 'Båt',         Component: Ship },
  { id: 'bike',          label: 'Sykkel',      Component: Bike },
  { id: 'anchor',        label: 'Anker',       Component: Anchor },
  { id: 'tent',          label: 'Telt',        Component: Tent },
  { id: 'building',      label: 'Bygning',     Component: Building2 },
  { id: 'hotel',         label: 'Hotell',      Component: Hotel },
  { id: 'landmark',      label: 'Landemerke',  Component: Landmark },
  { id: 'tree',          label: 'Tre',         Component: TreePine },

  // Food & lifestyle
  { id: 'coffee',        label: 'Kaffe',       Component: Coffee },
  { id: 'pizza',         label: 'Pizza',       Component: Pizza },
  { id: 'utensils',      label: 'Bestikk',     Component: UtensilsCrossed },
  { id: 'wine',          label: 'Vin',         Component: Wine },
  { id: 'beer',          label: 'Øl',          Component: Beer },
  { id: 'cookie',        label: 'Kake',        Component: Cookie },
  { id: 'ice-cream',     label: 'Iskrem',      Component: IceCream },
  { id: 'salad',         label: 'Salat',       Component: Salad },
  { id: 'soup',          label: 'Suppe',       Component: Soup },

  // Sports & games
  { id: 'trophy',        label: 'Trofé',       Component: Trophy },
  { id: 'award',         label: 'Pris',        Component: Award },
  { id: 'medal',         label: 'Medalje',     Component: Medal },
  { id: 'dumbbell',      label: 'Manual',      Component: Dumbbell },
  { id: 'game',          label: 'Spill',       Component: Gamepad2 },
  { id: 'joystick',      label: 'Joystick',    Component: Joystick },
  { id: 'dice',          label: 'Terning',     Component: Dice5 },
  { id: 'goal',          label: 'Mål',         Component: Goal },

  // Weather & nature
  { id: 'cloud-sun',     label: 'Delvis sol',  Component: CloudSun },
  { id: 'cloud-rain',    label: 'Regn',        Component: CloudRain },
  { id: 'cloud-snow',    label: 'Snø',         Component: CloudSnow },
  { id: 'wind',          label: 'Vind',        Component: Wind },
  { id: 'snowflake',     label: 'Snøfnugg',    Component: Snowflake },
  { id: 'fire',          label: 'Brann',       Component: Flame },
  { id: 'leaf',          label: 'Natur',       Component: Leaf },
  { id: 'droplet',       label: 'Dråpe',       Component: Droplet },
  { id: 'rainbow',       label: 'Regnbue',     Component: Rainbow },

  // Symbols & misc
  { id: 'bolt',          label: 'Lyn',         Component: Zap },
  { id: 'rocket',        label: 'Rakett',      Component: Rocket },
  { id: 'thumbs-up',     label: 'Tommel opp',  Component: ThumbsUp },
  { id: 'thumbs-down',   label: 'Tommel ned',  Component: ThumbsDown },
  { id: 'crown',         label: 'Krone',       Component: Crown },
  { id: 'paw',           label: 'Pote',        Component: PawPrint },
  { id: 'layers',        label: 'Lag',         Component: Layers },
  { id: 'layout',        label: 'Layout',      Component: Layout },
  { id: 'layout-dashboard', label: 'Dashboard', Component: LayoutDashboard },
  { id: 'grid',          label: 'Rutenett',    Component: Grid3x3 },
  { id: 'package',       label: 'Pakke',       Component: Package },
  { id: 'wrench',        label: 'Skiftenøkkel', Component: Wrench },
  { id: 'hammer',        label: 'Hammer',      Component: Hammer },
  { id: 'cog',           label: 'Tannhjul',    Component: Cog },
  { id: 'lightbulb',     label: 'Lyspære',     Component: Lightbulb },
  { id: 'gift',          label: 'Gave',        Component: Gift },
  { id: 'palette',       label: 'Palett',      Component: Palette },
  { id: 'brush',         label: 'Pensel',      Component: Brush },

  // ── FILLED ICONS (phosphor, weight="fill") ────────────────────────────
  // Solid shapes rather than outlines. `-fill` suffix on the id.
  { id: 'star-fill',         label: 'Stjerne (fylt)',     Component: filled(PhStar) },
  { id: 'heart-fill',        label: 'Hjerte (fylt)',      Component: filled(PhHeart) },
  { id: 'bookmark-fill',     label: 'Bokmerke (fylt)',    Component: filled(PhBookmark) },
  { id: 'flag-fill',         label: 'Flagg (fylt)',       Component: filled(PhFlag) },
  { id: 'home-fill',         label: 'Hjem (fylt)',        Component: filled(PhHouse) },
  { id: 'bell-fill',         label: 'Varsling (fylt)',    Component: filled(PhBell) },
  { id: 'check-circle-fill', label: 'Ferdig (fylt)',      Component: filled(PhCheckCircle) },
  { id: 'x-circle-fill',     label: 'Avbryt (fylt)',      Component: filled(PhXCircle) },
  { id: 'plus-circle-fill',  label: 'Ny (fylt)',          Component: filled(PhPlusCircle) },
  { id: 'circle-fill',       label: 'Sirkel (fylt)',      Component: filled(PhCircle) },
  { id: 'square-fill',       label: 'Firkant (fylt)',     Component: filled(PhSquare) },
  { id: 'triangle-fill',     label: 'Trekant (fylt)',     Component: filled(PhTriangle) },
  { id: 'folder-fill',       label: 'Mappe (fylt)',       Component: filled(PhFolder) },
  { id: 'tag-fill',          label: 'Tag (fylt)',         Component: filled(PhTag) },
  { id: 'cart-fill',         label: 'Handlekurv (fylt)',  Component: filled(PhShoppingCart) },
  { id: 'person-fill',       label: 'Person (fylt)',      Component: filled(PhUser) },
  { id: 'people-fill',       label: 'Gruppe (fylt)',      Component: filled(PhUsers) },
  { id: 'lock-fill',         label: 'Lås (fylt)',         Component: filled(PhLock) },
  { id: 'eye-fill',          label: 'Se (fylt)',          Component: filled(PhEye) },
  { id: 'sun-fill',          label: 'Sol (fylt)',         Component: filled(PhSun) },
  { id: 'moon-fill',         label: 'Måne (fylt)',        Component: filled(PhMoon) },
  { id: 'thumbs-up-fill',    label: 'Tommel opp (fylt)',  Component: filled(PhThumbsUp) },
  { id: 'crown-fill',        label: 'Krone (fylt)',       Component: filled(PhCrown) },
  { id: 'gift-fill',         label: 'Gave (fylt)',        Component: filled(PhGift) },
  { id: 'trophy-fill',       label: 'Trofé (fylt)',       Component: filled(PhTrophy) },
  { id: 'music-fill',        label: 'Musikk (fylt)',      Component: filled(PhMusicNote) },
  { id: 'camera-fill',       label: 'Kamera (fylt)',      Component: filled(PhCamera) },
  { id: 'cloud-fill',        label: 'Sky (fylt)',         Component: filled(PhCloud) },
  { id: 'phone-fill',        label: 'Telefon (fylt)',     Component: filled(PhPhone) },
  { id: 'chat-fill',         label: 'Chat (fylt)',        Component: filled(PhChat) },
  { id: 'mail-fill',         label: 'E-post (fylt)',      Component: filled(PhEnvelope) },
  { id: 'lightbulb-fill',    label: 'Lyspære (fylt)',     Component: filled(PhLightbulb) },
  { id: 'fire-fill',         label: 'Brann (fylt)',       Component: filled(PhFire) },
  { id: 'lightning-fill',    label: 'Lyn (fylt)',         Component: filled(PhLightning) },
  { id: 'mountains-fill',    label: 'Fjell (fylt)',       Component: filled(PhMountains) },
  { id: 'tree-fill',         label: 'Tre (fylt)',         Component: filled(PhTree) },
  { id: 'flower-fill',       label: 'Blomst (fylt)',      Component: filled(PhFlower) },
  { id: 'coffee-fill',       label: 'Kaffe (fylt)',       Component: filled(PhCoffee) },
  { id: 'pizza-fill',        label: 'Pizza (fylt)',       Component: filled(PhPizza) },
  { id: 'wine-fill',         label: 'Vin (fylt)',         Component: filled(PhWine) },
  { id: 'beer-fill',         label: 'Øl (fylt)',          Component: filled(PhBeer) },
  { id: 'rocket-fill',       label: 'Rakett (fylt)',      Component: filled(PhRocket) },
  { id: 'plane-fill',        label: 'Fly (fylt)',         Component: filled(PhAirplane) },
  { id: 'car-fill',          label: 'Bil (fylt)',         Component: filled(PhCar) },
  { id: 'mic-fill',          label: 'Mikrofon (fylt)',    Component: filled(PhMic) },
  { id: 'headphones-fill',   label: 'Hodetelefoner (fylt)', Component: filled(PhHeadphones) },
  { id: 'graduation-fill',   label: 'Utdanning (fylt)',   Component: filled(PhGradCap) },
  { id: 'book-fill',         label: 'Bok (fylt)',         Component: filled(PhBookBookmark) },
  { id: 'calendar-fill',     label: 'Kalender (fylt)',    Component: filled(PhCalendar) },
  { id: 'clock-fill',        label: 'Klokke (fylt)',      Component: filled(PhClock) },
  { id: 'compass-fill',      label: 'Kompass (fylt)',     Component: filled(PhCompass) },
  { id: 'map-pin-fill',      label: 'Sted (fylt)',        Component: filled(PhMapPin) },
  { id: 'globe-fill',        label: 'Globe (fylt)',       Component: filled(PhGlobe) },
  { id: 'briefcase-fill',    label: 'Jobb (fylt)',        Component: filled(PhBriefcase) },
  { id: 'game-fill',         label: 'Spill (fylt)',       Component: filled(PhGame) },
];

/**
 * Backward-compat: legacy ids that don't directly match a current entry.
 * If a stored `iconValue` matches a key here it gets remapped to the
 * value before lookup. (Most legacy ids already match exactly so this
 * map is small.)
 */
const LEGACY_ICON_ALIASES: Record<string, string> = {
  // The legacy hand-rolled list used these names that we now route to
  // the new ids:
  'paint':       'brush',
  'design':      'brush',
};

/** Lookup map for fast id → icon resolution. */
export const SVG_ICONS_BY_ID: Record<string, SvgIcon> = Object.fromEntries(
  SVG_ICONS.map((i) => [i.id, i])
);

/** Resolve a stored iconValue to a current SvgIcon, handling legacy aliases. */
export function resolveSvgIcon(id: string | undefined | null): SvgIcon | null {
  if (!id) return null;
  const aliased = LEGACY_ICON_ALIASES[id] ?? id;
  return SVG_ICONS_BY_ID[aliased] ?? null;
}

// Suppress an unused-import lint about HeartFill (kept for future use).
void HeartFill;
