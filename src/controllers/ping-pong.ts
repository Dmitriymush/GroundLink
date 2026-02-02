import {exec} from 'child_process';
import {socket} from "./socket";


class PingPong {
    private host: string
    private port: number

    constructor() {
        this.host = '';
        this.port = 0;
    }

    get address(): string {
        return `${this.host}`
    }

    setAddress(host: string, port: number): void {
        this.host = host;
        this.port = port;
    }

    async isAlive(): Promise<boolean> {
        if (!this.host) {
            return false;
        }

        return new Promise(resolve => {
            exec(`ping  ${this.address}`,  (err, stdout, stderr) => {
                const timeout = stdout.includes('timed out');
                const unavalible = stdout.includes('unreachable')

                resolve(!timeout && !unavalible)
            });
        });
    }
}

export const pingPong = new PingPong();