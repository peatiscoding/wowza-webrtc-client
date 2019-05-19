export declare class Logger {
    private domain;
    private messages;
    static wrap<T>(domain: string, callback: (logger: Logger) => Promise<T>): Promise<T>;
    constructor(domain: string);
    info(...args: any[]): void;
    error(...args: any[]): void;
    log(...args: any[]): void;
    flush(): void;
    private _l;
}
