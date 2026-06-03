import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useAppState } from '../state/AppState';
import { C } from '../theme/tokens';

/**
 * Drop-in pull-to-refresh control for any ScrollView. Re-runs the full bootstrap
 * (user, gyms, groups, plans, members, badges, room) so the screen sees fresh state.
 */
export function useRefreshControl() {
  const { refreshAll } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshAll(); } finally { setRefreshing(false); }
  }, [refreshAll]);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />;
}
