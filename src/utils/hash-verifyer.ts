import crypto from 'crypto';

const salt = '1337p0w3r';
export const hash = 'hash!!!!';

export const isHashValid = (hash: string, requiresTime = new Date()) => {
    if (hash.length !== 64) return false;

    const timeS = Math.floor(requiresTime.getTime() / 1e3);
    const hashString = timeS + salt
    const validTimeHash = crypto.createHash('sha256').update(hashString).digest('hex');

    const requestHash = hash.substring(0, 64);

    if (requestHash !== validTimeHash) return false;

    return true;
};

export const getValidHash = (hash: string, requestedTime = new Date()) => {
    if (!isHashValid) {
        return null;
    }

    return hash.substring(64);
}