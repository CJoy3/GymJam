import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createPledge, listPledges, type Pledge } from '../../lib/api';
import { getOrCreateUserId } from '../../lib/userId';

const PRESET_AMOUNTS = [1, 5, 10, 25];

export default function App() {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreateUserId();
        if (cancelled) return;
        setUserId(id);
        const data = await listPledges(id);
        if (cancelled) return;
        setPledges(data);
      } catch (err) {
        if (cancelled) return;
        Alert.alert(
          'Could not load pledges',
          err instanceof Error ? err.message : 'Unknown error',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetModalState = () => {
    setSelectedPreset(null);
    setCustomAmount('');
  };

  const openModal = () => {
    resetModalState();
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const getAmount = (): number | null => {
    if (customAmount.trim().length > 0) {
      const parsed = parseFloat(customAmount.replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) return parsed;
      return null;
    }
    return selectedPreset;
  };

  const amount = getAmount();
  const canConfirm = amount !== null && amount > 0;

  const handleConfirm = async () => {
    if (!canConfirm || amount === null || !userId || submitting) return;
    setSubmitting(true);
    try {
      const saved = await createPledge(userId, amount);
      setPledges((prev) => [saved, ...prev]);
      closeModal();
    } catch (err) {
      Alert.alert(
        'Could not save pledge',
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>Hello, Jamie!!</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Pledges</Text>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator />
            </View>
          ) : pledges.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No pledges yet.</Text>
            </View>
          ) : (
            <View style={styles.pledgeList}>
              {pledges.map((p) => (
                <View key={p.id} style={styles.pledgeRow}>
                  <Text style={styles.pledgeLabel}>Pledge</Text>
                  <Text style={styles.pledgeAmount}>£{p.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openModal}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Make a Pledge</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
          pointerEvents="box-none"
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Make a Pledge</Text>
            <Text style={styles.sheetSubtitle}>Choose an amount</Text>

            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map((value) => {
                const isSelected =
                  selectedPreset === value && customAmount.trim().length === 0;
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setSelectedPreset(value);
                      setCustomAmount('');
                    }}
                    style={({ pressed }) => [
                      styles.presetButton,
                      isSelected && styles.presetButtonSelected,
                      pressed && styles.presetButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        isSelected && styles.presetButtonTextSelected,
                      ]}
                    >
                      £{value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.customLabel}>Or enter a custom amount</Text>
            <View style={styles.customInputWrapper}>
              <Text style={styles.customCurrency}>£</Text>
              <TextInput
                value={customAmount}
                onChangeText={(text) => {
                  setCustomAmount(text);
                  if (text.length > 0) setSelectedPreset(null);
                }}
                placeholder="0.00"
                placeholderTextColor="#9aa0a6"
                keyboardType="decimal-pad"
                style={styles.customInput}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!canConfirm || submitting) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {amount !== null && amount > 0
                    ? `Confirm Pledge · £${amount.toFixed(2)}`
                    : 'Confirm Pledge'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeModal}
              activeOpacity={0.6}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111',
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  emptyStateText: {
    color: '#888',
    fontSize: 15,
  },
  pledgeList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  pledgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  pledgeLabel: {
    fontSize: 16,
    color: '#111',
  },
  pledgeAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: '#f7f8fa',
  },
  primaryButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d6d8dc',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  presetButton: {
    width: '48%',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: '#f1f3f6',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetButtonSelected: {
    backgroundColor: '#e8f1ff',
    borderColor: '#0a84ff',
  },
  presetButtonPressed: {
    opacity: 0.7,
  },
  presetButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
  },
  presetButtonTextSelected: {
    color: '#0a84ff',
  },
  customLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  customInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f6',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  customCurrency: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginRight: 8,
  },
  customInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 16,
    color: '#111',
  },
  confirmButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#b8d4ff',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
