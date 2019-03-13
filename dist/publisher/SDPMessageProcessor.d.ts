export declare class SDPMessageProcessor {
    private videoMode;
    private audioMode;
    private sdpOutput;
    private audioIndex;
    private videoIndex;
    constructor(videoMode: string, audioMode: string);
    enhance(_sdpStr?: string, enhanceData?: any): string;
    private deliverCheckLine;
    private checkLine;
    private getrtpMapID;
    private addVideo;
    private addAudio;
}
