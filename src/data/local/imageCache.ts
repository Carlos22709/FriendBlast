import { Directory, File, Paths } from 'expo-file-system';

const MEMORY_LIMIT = 24;
const DISK_LIMIT_BYTES = 100 * 1024 * 1024;
const cacheDirectory = new Directory(Paths.cache, 'friendblast-images');
const indexFile = new File(cacheDirectory, 'index.json');

type DiskCacheEntry = {
  fileName: string;
  size: number;
  lastAccess: number;
};

type DiskCacheIndex = Record<string, DiskCacheEntry>;

const memoryCache = new Map<string, string>();
let diskIndex: DiskCacheIndex | null = null;
let diskIndexPromise: Promise<DiskCacheIndex> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function ensureCacheDirectory() {
  if (!cacheDirectory.exists) {
    cacheDirectory.create({ idempotent: true, intermediates: true });
  }
}

async function loadDiskIndex() {
  if (diskIndex) {
    return diskIndex;
  }

  if (diskIndexPromise) {
    return diskIndexPromise;
  }

  diskIndexPromise = (async () => {
    ensureCacheDirectory();

    if (!indexFile.exists) {
      diskIndex = {};
      return diskIndex;
    }

    try {
      diskIndex = JSON.parse(await indexFile.text()) as DiskCacheIndex;
    } catch {
      diskIndex = {};
    }

    return diskIndex;
  })();

  return diskIndexPromise;
}

function schedulePersistDiskIndex(index: DiskCacheIndex) {
  if (persistTimer) {
    return;
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      if (!indexFile.exists) {
        indexFile.create({ intermediates: true, overwrite: true });
      }
      indexFile.write(JSON.stringify(index));
    } catch (error: unknown) {
      console.warn(
        'No se pudo persistir el índice de caché:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 750);
}

function rememberInMemory(cacheKey: string, uri: string) {
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, uri);

  while (memoryCache.size > MEMORY_LIMIT) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    memoryCache.delete(oldestKey);
  }
}

function pruneDiskCache(index: DiskCacheIndex) {
  let totalSize = Object.values(index).reduce((total, entry) => total + entry.size, 0);
  const oldestFirst = Object.entries(index).sort(
    ([, first], [, second]) => first.lastAccess - second.lastAccess,
  );

  for (const [cacheKey, entry] of oldestFirst) {
    if (totalSize <= DISK_LIMIT_BYTES) {
      break;
    }

    const file = new File(cacheDirectory, entry.fileName);
    if (file.exists) {
      file.delete();
    }
    totalSize -= entry.size;
    delete index[cacheKey];
    memoryCache.delete(cacheKey);
  }

  schedulePersistDiskIndex(index);
}

function fileNameFor(cacheKey: string) {
  return `${cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.img`;
}

export async function getCachedImage(
  cacheKey: string,
  remoteUrl: string,
  signal: AbortSignal,
) {
  const memoryUri = memoryCache.get(cacheKey);
  if (memoryUri) {
    rememberInMemory(cacheKey, memoryUri);
    return memoryUri;
  }

  const index = await loadDiskIndex();
  const existingEntry = index[cacheKey];

  if (existingEntry) {
    const existingFile = new File(cacheDirectory, existingEntry.fileName);
    if (existingFile.exists) {
      existingEntry.lastAccess = Date.now();
      schedulePersistDiskIndex(index);
      rememberInMemory(cacheKey, existingFile.uri);
      return existingFile.uri;
    }
    delete index[cacheKey];
    schedulePersistDiskIndex(index);
  }

  const destination = new File(cacheDirectory, fileNameFor(cacheKey));
  if (destination.exists) {
    destination.delete();
  }
  const task = File.createDownloadTask(remoteUrl, destination, {
    signal,
  });
  const downloadedFile = await task.downloadAsync();

  if (!downloadedFile) {
    throw new Error('La descarga de la imagen fue cancelada.');
  }

  index[cacheKey] = {
    fileName: downloadedFile.name,
    size: downloadedFile.size,
    lastAccess: Date.now(),
  };
  rememberInMemory(cacheKey, downloadedFile.uri);
  pruneDiskCache(index);

  return downloadedFile.uri;
}
