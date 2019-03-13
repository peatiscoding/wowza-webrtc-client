import { WebRTCConfiguration } from '../interface';
export interface WebRTCPlayerStatus {
    isMuted?: boolean;
    isPlaying: boolean;
    error?: Error;
}
export declare class WebRTCPlayer {
    private config;
    private hostElement;
    private onStateChanged;
    private userData;
    private peerConnection?;
    private lastError?;
    private connecting?;
    isMuted: boolean | undefined;
    readonly isPlaying: boolean;
    constructor(config: WebRTCConfiguration, hostElement: HTMLVideoElement, onStateChanged: (status: WebRTCPlayerStatus) => void);
    /**
     * Connect to WebRTC source, acquire media, and attach to target videoElement.
     *
     * @param streamName
     */
    connect(streamName: string): Promise<void>;
    stop(): void;
    private _reportError;
    private _reportStatus;
}
