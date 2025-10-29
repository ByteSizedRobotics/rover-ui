export const ROVER_MAX_POWER_WATTS = 33;
export const ROVER_BATTERY_VOLTAGE_V = 12;

export function calculateTravelTimeSeconds(
	distanceMeters: number,
	speedMetersPerSecond: number
): number {
	if (distanceMeters <= 0 || speedMetersPerSecond <= 0) {
		return 0;
	}

	return distanceMeters / speedMetersPerSecond;
}

export function calculateEnergyConsumptionWh(powerWatts: number, travelSeconds: number): number {
	if (powerWatts <= 0 || travelSeconds <= 0) {
		return 0;
	}

	return (powerWatts * travelSeconds) / 3600;
}

export function formatDuration(totalSeconds: number): {
	hours: number;
	minutes: number;
	seconds: number;
} {
	if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
		return { hours: 0, minutes: 0, seconds: 0 };
	}

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	return { hours, minutes, seconds };
}
