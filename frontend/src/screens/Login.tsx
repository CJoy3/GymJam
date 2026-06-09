import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { BlobBackground } from '../ui/Blob';
import { showToast } from '../ui/toast';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'landing' | 'sign-in' | 'sign-up';

export function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) return;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.replace('#', ''));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not sign in with Google', 'error');
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        showToast(err.message ?? 'Could not sign in with Apple', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async () => {
    if (!email.trim() || !password) {
      showToast('Please enter your email and password', 'info');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      showToast('Check your email to confirm your account', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not create account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <BlobBackground variant="celebrate" />
      <LinearGradient
        colors={['transparent', 'rgba(27,23,20,0.6)', C.bg]}
        locations={[0, 0.4, 0.85]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={s.hero}>
            <View style={s.logoMark}>
              <MaterialIcons name="fitness-center" size={32} color={C.primaryFg} />
            </View>
            <Text style={s.brand}>GymJam</Text>
            <Text style={s.tagline}>Train together. Stay accountable.</Text>
          </View>

          {/* Auth card */}
          <View style={s.card}>
            {mode === 'landing' && (
              <>
                <Text style={s.cardTitle}>Get started</Text>
                <Text style={s.cardSub}>Sign in or create a free account to join your gym community.</Text>

                <SocialBtn
                  label="Continue with Google"
                  icon={<GoogleIcon />}
                  onPress={signInWithGoogle}
                  loading={loading}
                />
                {Platform.OS === 'ios' && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={RADIUS.md}
                    style={s.appleBtn}
                    onPress={signInWithApple}
                  />
                )}

                <View style={s.dividerRow}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>or</Text>
                  <View style={s.dividerLine} />
                </View>

                <View style={s.emailRow}>
                  <Pressable style={[s.emailBtn, { flex: 1 }]} onPress={() => setMode('sign-in')}>
                    <Text style={s.emailBtnText}>Sign in with email</Text>
                  </Pressable>
                  <Pressable style={[s.emailBtn, s.emailBtnPrimary, { flex: 1 }]} onPress={() => setMode('sign-up')}>
                    <Text style={[s.emailBtnText, { color: C.primaryFg }]}>Create account</Text>
                  </Pressable>
                </View>
              </>
            )}

            {(mode === 'sign-in' || mode === 'sign-up') && (
              <>
                <Pressable onPress={() => setMode('landing')} style={s.backBtn}>
                  <MaterialIcons name="arrow-back" size={18} color={C.mutedFg} />
                  <Text style={s.backText}>Back</Text>
                </Pressable>
                <Text style={s.cardTitle}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>

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
                <View style={[s.fieldWrap, { marginTop: 12 }]}>
                  <Text style={s.fieldLabel}>Password</Text>
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
                    placeholderTextColor={C.mutedFg}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>

                <Pressable
                  style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                  onPress={mode === 'sign-in' ? signInWithEmail : signUpWithEmail}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={C.primaryFg} size="small" />
                    : <Text style={s.primaryBtnText}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
                  }
                </Pressable>

                {mode === 'sign-in' && (
                  <Pressable onPress={() => setMode('sign-up')} style={s.switchRow}>
                    <Text style={s.switchText}>No account? <Text style={s.switchLink}>Create one</Text></Text>
                  </Pressable>
                )}
                {mode === 'sign-up' && (
                  <Pressable onPress={() => setMode('sign-in')} style={s.switchRow}>
                    <Text style={s.switchText}>Already have an account? <Text style={s.switchLink}>Sign in</Text></Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <Text style={s.legal}>By continuing, you agree to GymJam's Terms of Service and Privacy Policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SocialBtn({ label, icon, onPress, loading }: { label: string; icon: React.ReactNode; onPress: () => void; loading: boolean }) {
  return (
    <Pressable style={[s.socialBtn, loading && { opacity: 0.5 }]} onPress={onPress} disabled={loading}>
      <View style={s.socialIcon}>{icon}</View>
      <Text style={s.socialText}>{label}</Text>
      {loading && <ActivityIndicator size="small" color={C.mutedFg} style={{ marginLeft: 'auto' }} />}
    </Pressable>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '700' }}>G</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: SPACE.xl, paddingBottom: 40, justifyContent: 'flex-end' },

  hero: { alignItems: 'center', marginBottom: 44 },
  logoMark: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
  },
  brand: { fontFamily: FONT.extra, fontSize: 42, color: C.ink, letterSpacing: -1.2, lineHeight: 48 },
  tagline: { fontFamily: FONT.medium, fontSize: 16, color: C.mutedFg, marginTop: 6, letterSpacing: 0.1 },

  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    borderWidth: 1,
    borderColor: C.borderHi,
  },
  cardTitle: { fontFamily: FONT.bold, fontSize: 22, color: C.ink, letterSpacing: -0.4, marginBottom: 6 },
  cardSub: { fontFamily: FONT.regular, fontSize: 14, color: C.mutedFg, marginBottom: 20, lineHeight: 20 },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    height: 52, paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
    marginBottom: 10,
  },
  socialIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  socialText: { fontFamily: FONT.semibold, fontSize: 15, color: C.ink },

  appleBtn: { height: 52, marginBottom: 10 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontFamily: FONT.medium, fontSize: 13, color: C.mutedFg },

  emailRow: { flexDirection: 'row', gap: 10 },
  emailBtn: {
    height: 48, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.borderHi,
    backgroundColor: C.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emailBtnPrimary: { backgroundColor: C.primary, borderColor: C.primary },
  emailBtnText: { fontFamily: FONT.semibold, fontSize: 14, color: C.ink },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontFamily: FONT.medium, fontSize: 14, color: C.mutedFg },

  fieldWrap: {},
  fieldLabel: { fontFamily: FONT.semibold, fontSize: 12, color: C.mutedFg, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    height: 52, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
    color: C.ink, fontFamily: FONT.medium, fontSize: 15,
  },

  primaryBtn: {
    height: 52, borderRadius: RADIUS.md,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 18,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { fontFamily: FONT.bold, fontSize: 15, color: C.primaryFg, letterSpacing: 0.2 },

  switchRow: { alignItems: 'center', marginTop: 14 },
  switchText: { fontFamily: FONT.medium, fontSize: 14, color: C.mutedFg },
  switchLink: { color: C.ink, fontFamily: FONT.semibold },

  legal: {
    fontFamily: FONT.regular, fontSize: 11, color: C.mutedFg,
    textAlign: 'center', marginTop: 20, lineHeight: 16,
  },
});
