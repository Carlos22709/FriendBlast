import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

export type DatabaseHealth = {
  error?: string;
  status: 'checking' | 'ready' | 'error';
  version?: string;
};

type SQLiteVersionRow = {
  version: string;
};

export function useDatabaseHealth(): DatabaseHealth {
  const database = useSQLiteContext();
  const [health, setHealth] = useState<DatabaseHealth>({ status: 'checking' });

  useEffect(() => {
    let isMounted = true;

    database
      .getFirstAsync<SQLiteVersionRow>('SELECT sqlite_version() AS version')
      .then((result) => {
        if (isMounted) {
          setHealth({ status: 'ready', version: result?.version });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setHealth({
            status: 'error',
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [database]);

  return health;
}
