// This file is kept for backward compatibility but no longer used
// Database operations now use MongoDB directly
// See lib/mongodb.ts and individual db/*.ts files

export default {
    zones: {
        read: () => [],
        write: () => {}
    },
    sensors: {
        read: () => [],
        write: () => {}
    },
    predictions: {
        read: () => [],
        write: () => {}
    }
};
