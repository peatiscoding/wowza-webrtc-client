import { WebRTCConfiguration } from '../interface';
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
    constructor(config: WebRTCConfiguration, hostElement: HTMLVideoElement, onStateChanged: (isMuted: boolean | undefined, isPlaying: boolean, error?: Error) => void);
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
