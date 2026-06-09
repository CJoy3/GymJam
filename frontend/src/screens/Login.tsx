import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ensureSupabase } from '../../lib/supabase';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { BlobBackground } from '../ui/Blob';
import { showToast } from '../ui/toast';

type AuthMode = 'sign-in' | 'sign-up';

export function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const signInWithEmail = async () => {
    if (!email.trim() || !password) {
      showToast('Please enter your email and password', 'info');
      return;
    }
    setLoading(true);
    try {
      const sb = await ensureSupabase();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not sign in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async () => {
    if (!email.trim() || !password) {
      showToast('Please enter your email and password', 'info');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'info');
      return;
    }
    setLoading(true);
    try {
      const sb = await ensureSupabase();
      const { error } = await sb.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      showToast('Check your email to confirm your account', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not create account', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === 'sign-in';

  return (
    <View style={s.root}>
      <BlobBackground variant="celebrate" />
      <LinearGradient
        colors={['transparent', 'rgba(27,23,20,0.55)', C.bg]}
        locations={[0, 0.35, 0.8]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={s.hero}>
            <View style={s.logoMark}>
              <Text style={s.logoText}>GJ</Text>
            </View>
            <Text style={s.brand}>GymJam</Text>
            <Text style={s.tagline}>Train together. Stay accountable.</Text>
          </View>

          {/* Tab switcher */}
          <View style={s.tabs}>
            <Pressable
              style={[s.tab, isSignIn && s.tabActive]}
              onPress={() => setMode('sign-in')}
              disabled={loading}
            >
              <Text style={[s.tabText, isSignIn && s.tabTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable
              style={[s.tab, !isSignIn && s.tabActive]}
              onPress={() => setMode('sign-up')}
              disabled={loading}
            >
              <Text style={[s.tabText, !isSignIn && s.tabTextActive]}>Create account</Text>
            </Pressable>
          </View>

          {/* Form card */}
          <View style={s.card}>
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.mutedFg}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
            </View>

            <View style={[s.fieldWrap, { marginTop: 14 }]}>
              <Text style={s.fieldLabel}>Password</Text>
              <View style={[s.passwordWrap, loading && { opacity: 0.6 }]}>
                <TextInput
                  style={s.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isSignIn ? 'Your password' : 'At least 6 characters'}
                  placeholderTextColor={C.mutedFg}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPassword(p => !p)} style={s.eyeBtn} hitSlop={10}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={C.mutedFg}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={isSignIn ? signInWithEmail : signUpWithEmail}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.primaryFg} size="small" />
                : <Text style={s.primaryBtnText}>{isSignIn ? 'Sign in' : 'Create account'}</Text>
              }
            </Pressable>
          </View>

          <Text style={s.legal}>
            By continuing you agree to GymJam's Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACE.xl,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  hero: { alignItems: 'center', marginBottom: 40 },
  logoMark: {
    width: 76, height: 76, borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 28, shadowOffset: { width: 0, height: 10 },
  },
  logoText: {
    fontFamily: FONT.extra, fontSize: 28, color: C.primaryFg, letterSpacing: -1,
  },
  brand: { fontFamily: FONT.extra, fontSize: 44, color: C.ink, letterSpacing: -1.5, lineHeight: 50 },
  tagline: { fontFamily: FONT.medium, fontSize: 15, color: C.mutedFg, marginTop: 6, letterSpacing: 0.1 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flex: 1, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  tabActive: {
    backgroundColor: C.card,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  tabText: { fontFamily: FONT.semibold, fontSize: 14, color: C.mutedFg },
  tabTextActive: { color: C.ink },

  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    borderWidth: 1,
    borderColor: C.borderHi,
  },

  fieldWrap: {},
  fieldLabel: {
    fontFamily: FONT.semibold, fontSize: 11, color: C.mutedFg,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 7,
  },
  input: {
    height: 52, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
    color: C.ink, fontFamily: FONT.medium, fontSize: 15,
  },

  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
  },
  passwordInput: {
    flex: 1,
    color: C.ink, fontFamily: FONT.medium, fontSize: 15,
  },
  eyeBtn: { paddingLeft: 8 },

  primaryBtn: {
    height: 52, borderRadius: RADIUS.md,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { fontFamily: FONT.bold, fontSize: 15, color: C.primaryFg, letterSpacing: 0.3 },

  legal: {
    fontFamily: FONT.regular, fontSize: 11, color: C.mutedFg,
    textAlign: 'center', marginTop: 20, lineHeight: 16,
  },
});
