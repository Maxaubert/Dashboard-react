import { describe, it, expect } from 'vitest';
import { parseRss } from './news';

const SAMPLE = `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Sak A</title>
    <link>https://www.nrk.no/a-1.2</link>
    <description><![CDATA[Beskrivelse A]]></description>
    <enclosure url="https://img/a.jpg" type="image/jpeg"/>
  </item>
  <item>
    <title>Sak B</title>
    <link>https://www.nrk.no/b-3.4</link>
    <description>Beskrivelse B</description>
  </item>
</channel></rss>`;

describe('parseRss', () => {
  it('extracts link/title/desc/img per item', () => {
    const items = parseRss(SAMPLE);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      link: 'https://www.nrk.no/a-1.2',
      title: 'Sak A',
      desc: 'Beskrivelse A',
      img: 'https://img/a.jpg',
    });
    expect(items[1].img).toBe(''); // no enclosure → empty string
  });
});
