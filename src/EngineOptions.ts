'use strict';

export class EngineOptions {

    /**
     * Which engine to use for the search ie. ag , rg etc ...
     */
    private engine: string;

    /**
     * String of shell params passed into the engine
     */
    private options: string;

    /**
     * @param engine Engine to be used
     * @param options Options passed trough
     */
    constructor(engine: string, options: string)
    {
        this.engine = engine;
        this.options = options;
    }

    public getEngine(): string
    {
        return this.engine;
    }

    public getOptions(): string
    {
        return this.options;
    }
}