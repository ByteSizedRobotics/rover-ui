import type { LidarData } from '$lib/ros2CommandCentre';

interface LidarMiniControllerOptions {
	canvasId?: string;
	onScan?: (scan: LidarData) => void;
	pointStride?: number; // skip factor for rendering
	maxVisualRange?: number; // cap visualization distance (m)
}

export class LidarMiniController {
	private _scan: LidarData | null = null;
	private _canvas: HTMLCanvasElement | null = null;
	private _ctx: CanvasRenderingContext2D | null = null;
	private _onScan?: (scan: LidarData) => void;
	private _pointStride: number;
	private _maxVisualRange: number;
	private _canvasId?: string;

	constructor(options: LidarMiniControllerOptions = {}) {
		this._onScan = options.onScan;
		this._pointStride = options.pointStride ?? 3;
		this._maxVisualRange = options.maxVisualRange ?? 1.0;
		this._canvasId = options.canvasId;
		if (this._canvasId) this.setupCanvas(this._canvasId);
	}

	get lastScan(): LidarData | null {
		return this._scan;
	}

	/**
	 * Update lidar data from external source (e.g., ROS2CommandCentreClient)
	 * @param data LidarData from ROS2 subscription
	 */
	updateData(data: LidarData): void {
		this._scan = data;
		if (this._onScan) this._onScan(data);
		this.draw();
	}

	setCanvas(canvas: HTMLCanvasElement) {
		this._canvas = canvas;
		this._ctx = canvas.getContext('2d');
		this.draw();
	}

	setCanvasById(id: string) {
		this.setupCanvas(id);
	}

	private setupCanvas(id: string) {
		const el = document.getElementById(id) as HTMLCanvasElement | null;
		if (el) this.setCanvas(el);
	}

	private draw() {
		if (!this._canvas || !this._ctx || !this._scan) return;
		const ctx = this._ctx;
		const { width: w, height: h } = this._canvas;
		ctx.clearRect(0, 0, w, h);
		// background
		ctx.fillStyle = '#f3f4f6';
		ctx.fillRect(0, 0, w, h);
		const cx = w / 2,
			cy = h / 2;
		// rover
		ctx.fillStyle = '#3b82f6';
		ctx.beginPath();
		ctx.arc(cx, cy, 4, 0, Math.PI * 2);
		ctx.fill();

		const { angle_min, angle_increment, ranges, range_min, range_max } = this._scan;
		const maxRange = Math.min(range_max, this._maxVisualRange);
		const scale = (Math.min(w, h) / 2 - 6) / maxRange;

		// range rings every 0.5m
		ctx.strokeStyle = '#e5e7eb';
		ctx.lineWidth = 1;
		for (let r = 0.5; r <= maxRange; r += 0.5) {
			ctx.beginPath();
			ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
			ctx.stroke();
		}

		for (let i = 0; i < ranges.length; i += this._pointStride) {
			const range = ranges[i];
			if (isNaN(range) || range < range_min || range > range_max) continue;
			const angle = angle_min + i * angle_increment; // ROS frame
			const adj = angle - Math.PI / 2 + Math.PI; // rotate 180 degrees more (added + Math.PI)
			const rr = Math.min(range, maxRange) * scale;
			const x = cx - Math.cos(adj) * rr; // negate x to fix left-right mirroring
			const y = cy + Math.sin(adj) * rr;
			const intensity = 1 - Math.min(range / maxRange, 1);
			ctx.fillStyle = `rgba(${Math.floor(255 * intensity)}, ${Math.floor(255 * (1 - intensity))}, 80, 0.9)`;
			ctx.beginPath();
			ctx.arc(x, y, 1.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

/**
 * Helper to create a LidarMiniController and optionally bind it to a canvas.
 * Data should be provided via updateData() method from an external source.
 */
export function createMiniLidar(
	options: { canvas: HTMLCanvasElement | string } & Omit<LidarMiniControllerOptions, 'canvasId'>
): LidarMiniController {
	const { canvas, ...rest } = options;
	const controller = new LidarMiniController({
		...rest,
		canvasId: typeof canvas === 'string' ? canvas : undefined
	});
	if (canvas instanceof HTMLCanvasElement) {
		controller.setCanvas(canvas);
	}
	return controller;
}
