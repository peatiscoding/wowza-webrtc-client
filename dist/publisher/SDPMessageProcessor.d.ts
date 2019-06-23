export declare class SDPMessageProcessor {
    private videoMode;
    private audioMode;
    private sdpOutput;
    private audioIndex;
    private videoIndex;
    constructor(videoMode: '42e01f' | 'VPX', audioMode: string);
    enhance(_sdpStr?: string, enhanceData?: any): string;
    /**
     * Fix Huawei OS failed to handle H264 configuration correctly..
     *
     * @param sdp
     */
    private forceH264;
    /**
     * Detect corrupted SDP message.
     * @param sdpMessage
     */
    static isCorrupted(sdpMessage: string): boolean;
    /**
     * Select the matched SDP.
     *
     * @param profile
     * @param type
     */
    private deliverCheckLine;
    private checkLine;
    private getrtpMapID;
    private addVideo;
    private addAudio;
}
