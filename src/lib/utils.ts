export function minutesFromNow(timestamp: number | string | Date): number {
	const inputDate = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - inputDate.getTime();
	return Math.floor(Math.abs(diffMs) / 60000);
}

export function getRoverStatus(rover: any) {
	const mins = minutesFromNow(rover.lastHeartbeat);
	return mins <= 1 ? 'active' : 'inactive';
}
