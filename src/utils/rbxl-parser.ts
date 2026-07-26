import { XMLParser } from 'fast-xml-parser';

export interface ParsedScript {
  name: string;
  scriptType: 'Script' | 'LocalScript' | 'ModuleScript';
  source: string;
}

export interface ParseResult {
  scripts: ParsedScript[];
  modelCount: number;
  partCount: number;
  assetCount: number;
  totalInstances: number;
}

const SCRIPT_CLASSES = new Set(['Script', 'LocalScript', 'ModuleScript']);
const PART_CLASSES = new Set([
  'Part',
  'MeshPart',
  'UnionOperation',
  'WedgePart',
  'TrussPart',
  'CornerWedgePart',
  'Seat',
  'VehicleSeat',
  'SpawnLocation',
  'BasePart',
]);
const ASSET_CLASSES = new Set([
  'Decal',
  'Texture',
  'Sound',
  'SurfaceAppearance',
  'ImageLabel',
  'ImageButton',
]);

/** Extract a named property value from an Item node. */
function getProp(item: Record<string, unknown>, propName: string): string {
  const props = item['Properties'] as Record<string, unknown> | undefined;
  if (!props) return '';

  const typeKeys = [
    'string',
    'ProtectedString',
    'int',
    'float',
    'double',
    'bool',
    'token',
    'int64',
  ];

  for (const typeKey of typeKeys) {
    if (!props[typeKey]) continue;
    const entries = Array.isArray(props[typeKey])
      ? (props[typeKey] as unknown[])
      : [props[typeKey]];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (e['@_name'] === propName) {
        return String(e['#text'] ?? e['__cdata'] ?? '');
      }
    }
  }
  return '';
}

function traverse(
  items: unknown[],
  scripts: ParsedScript[],
  counts: { model: number; part: number; asset: number; total: number },
): void {
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const cls = item['@_class'];
    if (typeof cls !== 'string') continue;

    counts.total++;

    if (SCRIPT_CLASSES.has(cls)) {
      const name = getProp(item, 'Name') || cls;
      const source = getProp(item, 'Source');
      scripts.push({ name, scriptType: cls as ParsedScript['scriptType'], source });
    }

    if (cls === 'Model') counts.model++;
    if (PART_CLASSES.has(cls)) counts.part++;
    if (ASSET_CLASSES.has(cls)) counts.asset++;

    const children = item['Item'];
    if (children) {
      traverse(
        Array.isArray(children) ? children : [children],
        scripts,
        counts,
      );
    }
  }
}

export function parseRbxl(xmlContent: string): ParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '__cdata',
    allowBooleanAttributes: true,
    isArray: (tagName) => tagName === 'Item',
  });

  const parsed = parser.parse(xmlContent) as Record<string, unknown>;
  const scripts: ParsedScript[] = [];
  const counts = { model: 0, part: 0, asset: 0, total: 0 };

  const roblox = parsed['roblox'] as Record<string, unknown> | undefined;
  if (roblox?.['Item']) {
    const topLevel = Array.isArray(roblox['Item'])
      ? (roblox['Item'] as unknown[])
      : [roblox['Item']];

    for (const raw of topLevel) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      if (item['@_class'] === 'DataModel' && item['Item']) {
        traverse(
          Array.isArray(item['Item']) ? item['Item'] : [item['Item']],
          scripts,
          counts,
        );
      }
    }
  }

  return {
    scripts,
    modelCount: counts.model,
    partCount: counts.part,
    assetCount: counts.asset,
    totalInstances: counts.total,
  };
}
