import { join as joinPath, dirname } from 'path';
import { exec, spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'fs'
import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';


class Video extends EventEmitter {
    private gstreamer: ChildProcessWithoutNullStreams | null = null;

    private getPath(): string {
        const appRootDir = process.cwd();

        const devPath =  joinPath(appRootDir, 'gstreamer', 'bin');
        const prodPath = joinPath(appRootDir, 'resources', 'app', 'gstreamer', 'bin');

        if (existsSync(devPath)) {
            return devPath
        }

        return prodPath;
    }
    
    public start() {
        if (this.gstreamer) {
            this.gstreamer.kill();
        }


        const execPath = this.getPath();
        const cmd = `gst-launch-1.0 udpsrc port=5400 caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264' ! rtpjitterbuffer ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false`

        // udpsrc port=5400 caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264' ! rtpjitterbuffer ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert
 // ! autovideosink sync=false

        const args = [
            'udpsrc',
            'port=5400',
            "caps=application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264",
            '!', 'rtpjitterbuffer',
            '!', 'rtph264depay',
            '!', 'h264parse',
            '!', 'avdec_h264',
            '!', 'videoconvert',
            '!', 'autovideosink', 'sync=false'
        ]
        // const cmd = `${joinPath(execPath, 'my-executable')}`;
        this.emit('data', new Buffer(''))

        this.gstreamer = spawn(joinPath(execPath, 'gst-launch-1.0'), args);
        
        this.gstreamer.stdout.on('data', (data) => {
            this.emit('data', data);
            console.log(data.toString());
        })

        this.gstreamer.stderr.on('data', (data) => {
            this.emit('data', data);
            console.log(data.toString());
        })

        this.gstreamer.on('close', (code) => {
            this.emit('close');
            console.log(`child process exited with code ${code}`);
        });

        console.log('Full path', joinPath(execPath, cmd));
    }

    stop() {
        if (this.gstreamer) {
            this.gstreamer.kill();
        }
    }
}

export const video = new Video();