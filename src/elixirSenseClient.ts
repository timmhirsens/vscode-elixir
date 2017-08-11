import * as net from 'net';
import * as Jem from './jem';

type Request = 'signature' | 'docs' | 'definition' | 'suggestions' | 'expand_full' | 'set_context' | 'version';
interface IVersion { elixir; otp; }
export class ElixirSenseClient {

    projectPath: string;
    // tslint:disable-next-line:variable-name
    auth_token: string;
    port: string;
    host: string;

    requests: {};
    lastRequestId: number;
    client: net.Socket;
    env: any;

    packetSize: number;
    packetPos: number;
    packetBuffer: any;
    packetBufferView: any;

    version: IVersion;

    constructor(host, port, authToken, env, projectPath) {
        this.host = host;
        this.port = port.trim();
        this.auth_token = authToken ? authToken.trim() : undefined;
        this.projectPath = projectPath;
        this.env = env;

        this.client = new net.Socket();
        this.lastRequestId = 0;
        this.requests = {};

        this.packetSize = 0;
        this.packetPos = 0;
        this.packetBuffer = undefined;
        this.packetBufferView = undefined;

        this.initClient();
    }

    initClient() {
        this.client.connect(this.port, this.handleConnect.bind(this));
        this.client.on('data', this.handleData.bind(this));
        this.client.on('close', this.handleClose.bind(this));
        this.client.on('error', this.handleError.bind(this));
    }

    handleConnect() {
        this.resetBuffer(0, 4);
        console.log(`[vscode-elixir] ElixirSense client connected on ${this.host}:${this.port}`);
        this.send('version', {})
        .then((version: IVersion) => {
            this.version = version;
            console.log(`[vscode-elixir] ElixirSense client reporting versions:\n\
            Elixir version: ${version.elixir}\n\
            Erlang/OTP version: ${version.otp}`);
        }).catch((err) => { 'swallow'; });
    }

    handleClose() {
        console.log('[vscode-elixir] ElixirSense client connection closed');
    }

    handleError(error) {
        console.log('[vscode-elixir] ' + error);
    }

    handleData(data) {
        try {
            this.readPacket(data);
        } catch (e) {
            console.error(e);
            this.requests = {};
        }
    }

    readPacket(data) {
        let dataPos = 0;

        if (this.packetPos === 0) {
            dataPos = this.readSize(data, dataPos);
            const size = this.packetBufferView.getUint32(0);
            this.resetBuffer(0, size);
        }

        dataPos = this.readBody(data, dataPos);

        if (this.packetPos === this.packetSize) {
            // DEBUG
            let result;
            try {
                result = Jem.decode(this.packetBuffer);
            } catch (error) {
                console.error(`[vscode-elixir] Cannot decode Erlang term: ${toErlString(this.packetBuffer)}\nReason:`, error);
                this.resetBuffer(0, 4);
                return;
            }

            try {
                const onResultCB = this.requests[result.request_id];
                delete this.requests[result.request_id];
                if (onResultCB) {
                    if (result.error) {
                        onResultCB(new Error(result.error), undefined);
                    } else {
                        onResultCB(undefined, result.payload);
                    }
                } else {
                    console.error('[vscode-elixir] Server response contains invalid request id');
                    this.requests = {};
                }
            } catch (error) {
                console.error('[vscode-elixir]', error);
            }
            this.resetBuffer(0, 4);
        }
    }

    readSize(data, dataPos) {
        while (dataPos < 4) {
            this.packetBufferView.setUint8(dataPos, data[dataPos]);
            dataPos++;
        }
        return dataPos;
    }

    readBody(data, dataPos) {
        while (dataPos < data.length) {
            this.packetBufferView.setUint8(this.packetPos, data[dataPos]);
            this.packetPos++;
            dataPos++;
        }
        return dataPos;
    }

    resetBuffer(pos, size) {
        this.packetPos = pos;
        this.packetSize = size;
        this.packetBuffer = new ArrayBuffer(this.packetSize);
        this.packetBufferView = new DataView(this.packetBuffer);
    }

    write(data) {
        const encoded = Jem.encode(data);
        const header = createHeader(encoded);
        const body = new Buffer(encoded);
        const packet = new Uint8Array(header.length + encoded.byteLength);
        packet.set(header, 0);
        packet.set(body, header.length);
        this.client.write(new Buffer(packet));
    }

    send(request: Request, payload): Promise<object> {
        const self = this;
        return new Promise((resolve, reject) => {
            self.lastRequestId = self.lastRequestId + 1;
            self.requests[self.lastRequestId] = (err, result) => {
                (err) ? reject(err) : resolve(result);
            };
            self.write({
                request_id: self.lastRequestId,
                auth_token: self.auth_token,
                request,
                payload
            });
        });
    }

    setContext(env, cwd) {
        this.send('set_context', { env, cwd })
        .then((result) => {
            if (result[0] !== this.env) {
                this.env = result[0];
            }
            console.log(`[vscode-elixir] Environment changed to \"${this.env}\"`);
            if (result[1] !== this.projectPath) {
                console.log(`[vscode-elixir] Working directory changed to \"${this.projectPath}\"`);
            }
            this.projectPath = result[1];
        });
    }

    getVersion() {
        return this.version;
    }
}

function createHeader(encoded): Buffer {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, encoded.byteLength);
    return new Buffer(dv.buffer);
}

function toErlString(buffer): string {
    const dv = new DataView(buffer);
    const a = [];
    for (let i = 0; i < dv.byteLength; i++) {
        a[i] = dv.getUint8(i);
    }
    return '<<' + a.join(',') + '>>';
}
