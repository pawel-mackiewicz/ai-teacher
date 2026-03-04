export interface SRSData {
    interval: number;
    repetition: number;
    easinessFactor: number;
}

export const calculateNextSRSDelay = (
    rating: 0 | 1 | 2 | 3 | 4 | 5, // 0:Blackout, 1:Wrong(remembered), 2:Wrong(easy), 3:Hard, 4:Good, 5:Easy
    current: SRSData
): SRSData & { nextReviewDate: number } => {
    let { interval, repetition, easinessFactor } = current;

    // Use the SM-2 Quality scale directly
    const q = rating;

    // SM-2 Interval & Repetition updates
    if (q < 3) {
        repetition = 0;
        interval = 1;
    } else {
        if (repetition === 0) {
            interval = 1;
        } else if (repetition === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easinessFactor);
        }
        repetition += 1;
    }

    // SM-2 Easiness Factor update
    easinessFactor = easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easinessFactor < 1.3) easinessFactor = 1.3;

    const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);

    return { interval, repetition, easinessFactor, nextReviewDate };
};

export function formatNextReviewInterval(intervalInDays: number): string {
    if (intervalInDays < 1) return '< 1 day';
    if (intervalInDays === 1) return '1 day';
    if (intervalInDays < 30) return `${intervalInDays} days`;
    if (intervalInDays < 365) {
        const months = Math.floor(intervalInDays / 30);
        return `${months} month${months === 1 ? '' : 's'}`;
    }
    const years = +(intervalInDays / 365).toFixed(1);
    return `${years} year${years === 1 ? '' : 's'}`;
}

export function getNextReviewIntervalFormatted(rating: 0 | 1 | 2 | 3 | 4 | 5, current: SRSData): string {
    const next = calculateNextSRSDelay(rating, current);
    return formatNextReviewInterval(next.interval);
}
