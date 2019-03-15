import { WebRTCConfiguration } from '../interface';
export declare class WebRTCPublisher {
    private config;
    private statusListener?;
    private userAgent;
    private localStream?;
    private streamSourceConstraints;
    private peerConnection?;
    private wsConnection?;
    private userData;
    private videoElement?;
    private statusCameraMuted;
    private _lastError?;
    /**
     * Holding = disable microphone only.
     */
    isHolding: boolean;
    isCameraMuted: boolean;
    readonly isPublishing: boolean;
    readonly isPreviewEnabled: boolean;
    readonly lastError: Error | undefined;
    constructor(config: WebRTCConfiguration, statusListener?: (() => void) | undefined);
    /**
     * Attach user media to configured VideoElement
     */
    attachUserMedia(videoElement: HTMLVideoElement): Promise<void>;
    detachUserMedia(): Promise<void>;
    /**
     * Begin connect to server, and publish the media.
     */
    connect(streamName: string): Promise<void>;
    private _reportError;
    disconnect(): Promise<void>;
    private _stopStream;
}
