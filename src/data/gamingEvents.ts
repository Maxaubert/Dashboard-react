/**
 * Gaming events — ported verbatim from gaming.html.
 *
 * All times stored as UTC, displayed in Europe/Oslo (CET/CEST).
 * Replace with a backend endpoint when one is available.
 */
export interface GamingEvent {
  name: string;
  start: Date;
  end: Date;
  url: string;
  desc: string;
}

export const GAMING_EVENTS: GamingEvent[] = [
  {
    name: 'PAX East 2026',
    start: new Date('2026-05-21T14:00:00Z'),
    end: new Date('2026-05-24T23:00:00Z'),
    url: 'https://www.paxsite.com/paxeast',
    desc: 'Stor spillmesse i Boston med demos, turneringer og paneler.',
  },
  {
    name: 'Summer Game Fest 2026',
    start: new Date('2026-06-06T17:00:00Z'),
    end: new Date('2026-06-06T19:00:00Z'),
    url: 'https://www.summergamefest.com',
    desc: 'Geoff Keighleys store juni-showcase med avdukinger fra store utgivere.',
  },
  {
    name: 'Xbox Games Showcase 2026',
    start: new Date('2026-06-08T17:00:00Z'),
    end: new Date('2026-06-08T19:00:00Z'),
    url: 'https://news.xbox.com',
    desc: 'Microsoft og Xbox viser frem kommende spill for Xbox og PC Game Pass.',
  },
  {
    name: 'Nintendo Direct 2026',
    start: new Date('2026-06-17T15:00:00Z'),
    end: new Date('2026-06-17T16:00:00Z'),
    url: 'https://www.nintendo.com/us/nintendo-direct/',
    desc: 'Nintendo avdukinger — kommende spill for Switch 2 og Switch.',
  },
  {
    name: 'Gamescom 2026 — Opening Night Live',
    start: new Date('2026-08-18T19:00:00Z'),
    end: new Date('2026-08-18T21:30:00Z'),
    url: 'https://www.gamescom.de',
    desc: 'Geoff Keighleys opening show for Gamescom i Köln med nye avdukinger.',
  },
  {
    name: 'Gamescom 2026',
    start: new Date('2026-08-19T08:00:00Z'),
    end: new Date('2026-08-23T18:00:00Z'),
    url: 'https://www.gamescom.de',
    desc: 'Verdens største spillmesse i Köln, Tyskland. Åpen for publikum fra 20. august.',
  },
  {
    name: 'Tokyo Game Show 2026',
    start: new Date('2026-09-24T00:00:00Z'),
    end: new Date('2026-09-27T23:59:00Z'),
    url: 'https://tgs.cesa.or.jp',
    desc: 'Japans store spillmesse med avdukinger fra Sony, Capcom, Square Enix m.fl.',
  },
  {
    name: 'The Game Awards 2026',
    start: new Date('2026-12-10T02:30:00Z'),
    end: new Date('2026-12-10T05:30:00Z'),
    url: 'https://thegameawards.com',
    desc: 'Årets store prisutdeling og showcase i Los Angeles.',
  },
];
