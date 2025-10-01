export interface NominatimAddress {
	// Core street fields
	house_number?: string;
	road?: string;
	street?: string;
	pedestrian?: string;
	highway?: string;
	cycleway?: string;
	footway?: string;

	// Building / place descriptors
	building?: string;
	amenity?: string;
	attraction?: string;
	tourism?: string;
	university?: string;
	school?: string;
	college?: string;
	hospital?: string;
	hotel?: string;
	public_building?: string;
	shop?: string;
	office?: string;
	leisure?: string;
	place?: string;
	man_made?: string;
	landuse?: string;
	residential?: string;

	// Locality information
	city?: string;
	town?: string;
	village?: string;
	suburb?: string;
	neighbourhood?: string;
	municipality?: string;
	county?: string;
	state?: string;
	province?: string;
	country?: string;
	postcode?: string;

	[key: string]: string | undefined;
}

export interface NominatimResult {
	place_id: number;
	lat: string;
	lon: string;
	display_name: string;
	address?: NominatimAddress;
	[key: string]: unknown;
}

type LabelKind = 'building' | 'address' | 'display';

export interface LooseLabel {
	label: string;
	kind: LabelKind;
}

const BUILDING_FIELDS = [
	'building',
	'amenity',
	'university',
	'school',
	'college',
	'hospital',
	'hotel',
	'public_building',
	'shop',
	'office',
	'leisure',
	'attraction',
	'tourism',
	'place',
	'man_made',
	'landuse',
	'residential'
];

const STREET_FIELDS = ['road', 'street', 'pedestrian', 'highway', 'cycleway', 'footway'];

const LOCALITY_FIELDS = ['city', 'town', 'village', 'suburb', 'neighbourhood', 'municipality', 'county'];

const DEFAULT_LIMIT = 5;

function normalizePart(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}

function findFirst(address: NominatimAddress | undefined, fields: string[]): string | undefined {
	if (!address) return undefined;
	for (const field of fields) {
		const value = normalizePart(address[field]);
		if (value) return value;
	}
	return undefined;
}

export function deriveLooseLabel(result: NominatimResult): LooseLabel | null {
	const address = result.address;
	const buildingName = findFirst(address, BUILDING_FIELDS);
	if (buildingName) {
		return { label: buildingName, kind: 'building' };
	}

	const streetName = findFirst(address, STREET_FIELDS);
	const houseNumber = normalizePart(address?.house_number);
	if (streetName) {
		const label = houseNumber ? `${houseNumber} ${streetName}` : streetName;
		return { label, kind: 'address' };
	}

	const fallback = normalizePart(result.display_name?.split(',')[0]);
	if (fallback) {
		return { label: fallback, kind: 'display' };
	}

	return null;
}

function toFixed(value: string, digits: number): string {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed.toFixed(digits) : '0';
}

function createDedupKey(result: NominatimResult, label: string): string {
	const latKey = toFixed(result.lat, 4);
	const lonKey = toFixed(result.lon, 4);
	return `${label.toLowerCase()}|${latKey}|${lonKey}`;
}

function normalizeNumber(value?: string | null): string | undefined {
	return value ? value.replace(/[^0-9a-z]/gi, '').toLowerCase() : undefined;
}

interface FilterOptions {
	houseNumber?: string | null;
	limit?: number;
}

export function filterSuggestions(results: NominatimResult[], options: FilterOptions = {}): NominatimResult[] {
	const { houseNumber, limit = DEFAULT_LIMIT } = options;
	const normalizedTarget = normalizeNumber(houseNumber ?? undefined);
	const seen = new Set<string>();

	const scoredResults = results.reduce<{ result: NominatimResult; score: number; label: LooseLabel }[]>((acc, result) => {
		const label = deriveLooseLabel(result);
		if (!label) return acc;

		const key = createDedupKey(result, label.label);
		if (seen.has(key)) return acc;
		seen.add(key);

		let score = 0;
		if (label.kind === 'building') score += 4;
		if (label.kind === 'address') score += 2;

		const resultHouseNumber = normalizeNumber(result.address?.house_number);
		if (normalizedTarget && resultHouseNumber && normalizedTarget === resultHouseNumber) {
			score += 3;
		}

		acc.push({ result, score, label });
		return acc;
	}, []);

	scoredResults.sort((a, b) => b.score - a.score);

	return scoredResults.slice(0, limit).map((entry) => entry.result);
}

export function formatSuggestionLabel(result: NominatimResult): string {
	const label = deriveLooseLabel(result)?.label ?? result.display_name;
	const address = result.address;

	const locality = findFirst(address, LOCALITY_FIELDS);
	const region = normalizePart(address?.state) ?? normalizePart(address?.province);

	const parts = [label];
	if (locality) parts.push(locality);
	if (region && region.toLowerCase() !== locality?.toLowerCase()) parts.push(region);

	const uniqueParts = Array.from(new Set(parts.filter(Boolean)));
	return uniqueParts.join(', ');
}
