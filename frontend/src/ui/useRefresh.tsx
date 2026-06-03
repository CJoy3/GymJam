import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useAppState } from '../state/AppState';
import { C } from '../theme/tokens';

/**
 * Pull-to-refresh control with theme-correct contrast colors so it never blends
 * into the dark background. iOS uses `tintColor`; Android uses `colors` plus
 * `progressBackgroundColor`.
 */
export function useRefreshControl() {
  const { refreshAll } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshAll(); } finally { setRefreshing(false); }
  }, [refreshAll]);
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={C.ink}
      colors={[C.accent, C.primary]}
      progressBackgroundColor={C.card}
    />
  );
}
