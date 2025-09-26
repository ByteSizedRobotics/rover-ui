import { ROS2_CONFIG, getROSWebSocketURL } from '$lib/ros2Config';

export interface LidarScan {
	angle_min: number;
	angle_max: number;
	angle_increment: number;
	time_increment: number;
	scan_time: number;
	range_min: number;
	range_max: number;
	ranges: number[];
	intensities?: number[];
}

interface LidarMiniControllerOptions {
	rosIp?: string;
	rosPort?: number;
	topic?: string;
	canvasId?: string;
	onScan?: (scan: LidarScan) => void;
	pointStride?: number; // skip factor for rendering
	maxVisualRange?: number; // cap visualization distance (m)
}

export class LidarMiniController {
	private _socket: WebSocket | null = null;
	private _scan: LidarScan | null = null;
	private _canvas: HTMLCanvasElement | null = null;
	private _ctx: CanvasRenderingContext2D | null = null;
	private _onScan?: (scan: LidarScan) => void;
	private _topic: string;
	private _rosIp: string;
	private _rosPort: number;
	private _pointStride: number;
	private _maxVisualRange: number;
	private _canvasId?: string;

	constructor(options: LidarMiniControllerOptions = {}) {
		this._rosIp = options.rosIp || ROS2_CONFIG.RASPBERRY_PI_IP;
		this._rosPort = options.rosPort || ROS2_CONFIG.ROS_BRIDGE_PORT;
		this._topic = options.topic || ROS2_CONFIG.TOPICS.LIDAR;
		this._onScan = options.onScan;
		this._pointStride = options.pointStride ?? 3;
		this._maxVisualRange = options.maxVisualRange ?? 1.0; // Zoomed in more (was 2.0)
		this._canvasId = options.canvasId;
		if (this._canvasId) this.setupCanvas(this._canvasId);
	}

	get isConnected(): boolean {
		return !!this._socket && this._socket.readyState === WebSocket.OPEN;
	}
	get lastScan(): LidarScan | null {
		return this._scan;
	}

	connect(): Promise<void> {
		if (this.isConnected) return Promise.resolve();
		return new Promise((resolve, reject) => {
			try {
				const url = getROSWebSocketURL(this._rosIp, this._rosPort);
				this._socket = new WebSocket(url);
				this._socket.onopen = () => {
					this.subscribe();
					resolve();
				};
				this._socket.onmessage = (evt) => this.handleMessage(evt.data);
				this._socket.onerror = (e) => reject(e);
				this._socket.onclose = () => {
					/* no-op */
				};
			} catch (e) {
				reject(e);
			}
		});
	}

	disconnect() {
		if (!this._socket) return;
		try {
			if (this._socket.readyState === WebSocket.OPEN) {
				this._socket.send(JSON.stringify({ op: 'unsubscribe', topic: this._topic }));
			}
			this._socket.close();
		} catch {}
		this._socket = null;
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

	private subscribe() {
		if (!this._socket) return;
		const msg = {
			op: 'subscribe',
			topic: this._topic,
			type: 'sensor_msgs/LaserScan'
		};
		this._socket.send(JSON.stringify(msg));
	}

	private handleMessage(raw: string) {
		try {
			const data = JSON.parse(raw);
			if (data.topic === this._topic && data.msg) {
				this._scan = data.msg as LidarScan;
				if (this._onScan) this._onScan(this._scan);
				this.draw();
			}
		} catch (e) {
			// swallow parse errors silently for now
		}
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
			const x = cx + Math.cos(adj) * rr;
			const y = cy + Math.sin(adj) * rr;
			const intensity = 1 - Math.min(range / maxRange, 1);
			ctx.fillStyle = `rgba(${Math.floor(255 * intensity)}, ${Math.floor(255 * (1 - intensity))}, 80, 0.9)`;
			ctx.beginPath();
			ctx.arc(x, y, 1.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

// Helper to create, optionally bind canvas, and auto-connect.
export function createAndConnectMiniLidar(
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
	controller.connect().catch(() => {});
	return controller;
}
