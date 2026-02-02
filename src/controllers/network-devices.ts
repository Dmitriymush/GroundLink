import { exec } from 'node:child_process'

export type Adapter = {
    name: string,
    settings: {
        IPv4Address: string | null
    }
}

export const getIpAddress = (): Promise<Adapter[]> => {
    return new Promise((resolve, reject) => {
        exec('ipconfig', (err, stdout) => {
            if (err) {
                return reject(err);
            }
    
            const blocks = stdout.split('\r\n')
                .filter(i => i !== '');
    
            blocks.shift();
    
            const adapters: Adapter[] = [];
    
            for (const block of blocks) {
                if (block[0] !== " ") {
                    adapters.push({
                        name: block,
                        settings: {
                            IPv4Address: null
                        },
                    });
                }
    
                if (block[0] === " ") {
                    const [key, value] = block
                        .replaceAll(/\s/gim, '')
                        .split(':');
        
                    adapters[adapters.length - 1].settings = {
                        ...adapters[adapters.length - 1].settings,
                        [key.replaceAll('.', '')]: value,
                    }
                }
            }
    
            const out = adapters
                .filter(adapter => (
                    adapter.settings.IPv4Address != null
                ))
                .sort(adapter => {
                    const isLocal = adapter.settings.IPv4Address?.includes('10.0');

                    if (isLocal) {
                        return -1;
                    }

                    return 0;
                })
                .sort(adapter => {
                    const isVg = adapter.settings.IPv4Address?.includes('10.7');
    
                    if (isVg) {
                        return -1;
                    }

                    return 0;
                })
    
    
            return resolve(out);
        });
    })
};