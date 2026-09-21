import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nexusRoot = path.resolve(__dirname, '..');
const membersJsonPath = path.resolve(nexusRoot, 'Eid-card/data/members.json');
const outputCsvPath = path.resolve(nexusRoot, 'members_eid_links.csv');
const secondaryCsvPath = path.resolve(nexusRoot, 'Eid-card/data/members_eid_links.csv');

interface Member {
  uniqueId?: string;
  id?: string;
  name: string;
  group?: string;
  domain?: string;
  role?: string;
  designation?: string;
  slug: string;
}

const members: Member[] = JSON.parse(fs.readFileSync(membersJsonPath, 'utf8'));

const headers = [
  'Sl No',
  'Unique ID',
  'Member Name',
  'Domain / Squad',
  'Role / Designation',
  'Slug',
  'E-ID Link (Direct)',
  'E-ID Link (MemberID Route)',
  'E-ID Link (Short ID)',
];

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

const lines: string[] = [headers.map(escapeCsv).join(',')];

members.forEach((m, index) => {
  const id = (m.uniqueId || m.id || '').trim().toUpperCase();
  const name = (m.name || '').trim();
  const domain = (m.group || m.domain || '').trim();
  const role = (m.role || m.designation || '').trim();
  const slug = (m.slug || '').trim().toLowerCase();

  const directLink = `https://nexusopen.dev/${slug}/${id}`;
  const memberIdLink = `https://nexusopen.dev/memberID/${slug}/${id}`;
  const shortIdLink = `https://nexusopen.dev/${id}`;

  const row = [
    escapeCsv(index + 1),
    escapeCsv(id),
    escapeCsv(name),
    escapeCsv(domain),
    escapeCsv(role),
    escapeCsv(slug),
    escapeCsv(directLink),
    escapeCsv(memberIdLink),
    escapeCsv(shortIdLink),
  ];

  lines.push(row.join(','));
});

const csvContent = lines.join('\r\n') + '\r\n';

fs.writeFileSync(outputCsvPath, csvContent, 'utf8');
fs.writeFileSync(secondaryCsvPath, csvContent, 'utf8');

console.log(`Successfully generated CSV at: ${outputCsvPath}`);
console.log(`Total rows written: ${members.length}`);
