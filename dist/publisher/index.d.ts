import { WebRTCConfiguration } from '../interface';
export declare class WebRTCPublisher {
    private config;
    enhanceMode: 'auto' | boolean;
    codecMode: 'VPX' | 'H264';
    private statusListener?;
    private userAgent;
    private localStream?;
    private currentContraints;
    private peerConnection?;
    private wsConnection?;
    private userData;
    private videoElement?;
    private statusCameraMuted;
    private _lastError?;
    /**
     * Holding = disable microphone only.
     */
    get isHolding(): boolean;
    set isHolding(value: boolean);
    set isCameraMuted(muted: boolean);
    get isCameraMuted(): boolean;
    get isPublishing(): boolean;
    get isPreviewEnabled(): boolean;
    get streamSourceConstraints(): MediaStreamConstraints;
    get lastError(): Error | undefined;
    get rtcPeerConnectionState(): RTCPeerConnectionState | undefined;
    get rtcSignalingState(): RTCSignalingState | undefined;
    get rtcIceConnectionState(): RTCIceConnectionState | undefined;
    constructor(config: WebRTCConfiguration, mediaStreamConstraints: MediaStreamConstraints, enhanceMode: 'auto' | boolean, codecMode: 'VPX' | 'H264', statusListener?: (() => void) | undefined);
    switchStream(constraints: MediaStreamConstraints, force?: boolean): Promise<void>;
    /**
     * Attach user media to configured VideoElement
     */
    attachUserMedia(videoElement: HTMLVideoElement): Promise<void>;
    private _claimMedia;
    detachUserMedia(): Promise<void>;
    /**
     * Begin connect to server, and publish the media.
     *
     * @throws Error upon failure to create connection.
     */
    connect(streamName: string): Promise<void>;
    /**
     * Try to connect to Wowza Server. Will fullfill when stream has been completely established.
     *
     * @param streamName
     */
    private _connect;
    /**
     * Set up peerConnection object with abundant event listeners.
     *
     * @return RTCPeerConnection
     */
    private _createPeerConnection;
    private _reportError;
    disconnect(): Promise<void>;
    private _stopStream;
}
