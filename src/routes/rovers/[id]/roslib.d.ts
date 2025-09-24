// Type declarations for roslib
declare module 'roslib' {
	export interface ROSOptions {
		url: string;
	}

	export interface TopicOptions {
		ros: Ros;
		name: string;
		messageType: string;
	}

	export class Ros {
		constructor(options: ROSOptions);
		on(event: 'connection' | 'error' | 'close', callback: (data?: any) => void): void;
		close(): void;
	}

	export class Topic {
		constructor(options: TopicOptions);
		subscribe(callback: (message: any) => void): void;
		unsubscribe(): void;
		publish(message: any): void;
	}

	export class Service {
		constructor(options: {
			ros: Ros;
			name: string;
			serviceType: string;
		});
		callService(request: any, callback: (response: any) => void): void;
	}
}