import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  signUp,
  signIn,
  signOut,
  sendPasswordReset,
  updatePassword,
  updateProfile,
  isUsernameAvailable,
  onAuthStateChange,
} from '../auth';
import { supabase } from '../supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
const createMock = () => jest.fn<(...args: any[]) => any>();
// Runtime mock
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Tell TypeScript this imported supabase will be a mocked client in tests
const mockedSupabase = supabase as unknown as jest.Mocked<SupabaseClient> & {
  from: jest.Mock;
  auth: Record<string, jest.Mock>;
};

// Test fixtures — cast to any to avoid having to provide every field from library types
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { username: 'testuser' },
} as any;

const mockSession = {
  access_token: 'token-123',
  refresh_token: 'refresh-123',
  user: mockUser,
} as any;

describe('Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── signUp Tests ───────────────────────────────────────────────────────

  describe('signUp', () => {
    it('should successfully register a new user', async () => {
      mockedSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      } as any);

      const { data, error } = await signUp(
        'TEST@EXAMPLE.COM',
        'password123',
        'TestUser'
      );

      expect(error).toBeNull();
      expect(data?.user.id).toBe('user-123');
      expect(data?.session).toBeDefined();
      expect(mockedSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            username: 'testuser',
            full_name: 'TestUser',
          },
        },
      });
    });

    it('should return error when signUp fails', async () => {
      mockedSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already exists' },
      } as any);

      const { data, error } = await signUp('taken@example.com', 'pass123', 'user');

      expect(error).toBe('Email already exists');
      expect(data).toBeNull();
    });

    it('should handle missing user in response', async () => {
      mockedSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      } as any);

      const { data, error } = await signUp('new@example.com', 'pass123', 'user');

      expect(error).toBe('Nu s-a putut crea contul');
      expect(data).toBeNull();
    });

    it('should trim and lowercase email and username', async () => {
      mockedSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      } as any);

      await signUp('  TEST@EXAMPLE.COM  ', 'pass123', '  TestUser  ');

      expect(mockedSupabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          options: expect.objectContaining({
            data: expect.objectContaining({
              username: 'testuser',
            }),
          }),
        })
      );
    });
  });

  // ─── signIn Tests ───────────────────────────────────────────────────────

  describe('signIn', () => {
    it('should successfully sign in user', async () => {
      mockedSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      } as any);

      const { data, error } = await signIn('test@example.com', 'password123');

      expect(error).toBeNull();
      expect(data?.user.id).toBe('user-123');
    });

    it('should return friendly error for invalid credentials', async () => {
      mockedSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      } as any);

      const { data, error } = await signIn('wrong@example.com', 'wrongpass');

      expect(error).toBe('Email sau parolă incorectă');
      expect(data).toBeNull();
    });

    it('should preserve other error messages', async () => {
      mockedSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User account is disabled' },
      } as any);

      const { data, error } = await signIn('test@example.com', 'pass');

      expect(error).toBe('User account is disabled');
    });

    it('should trim and lowercase email', async () => {
      mockedSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      } as any);

      await signIn('  TEST@EXAMPLE.COM  ', 'password123');

      expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  // ─── signOut Tests ──────────────────────────────────────────────────────

  describe('signOut', () => {
    it('should successfully sign out user', async () => {
      mockedSupabase.auth.signOut.mockResolvedValue({ error: null } as any);

      const { data, error } = await signOut();

      expect(error).toBeNull();
      expect(data).toBeNull();
      expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should return error if signOut fails', async () => {
      mockedSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Session not found' },
      } as any);

      const { data, error } = await signOut();

      expect(error).toBe('Session not found');
    });
  });

  // ─── Password Reset Tests ───────────────────────────────────────────────

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      const { error } = await sendPasswordReset('test@example.com');

      expect(error).toBeNull();
      expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'matchit://auth/reset-password' }
      );
    });

    it('should return error if email sending fails', async () => {
      mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'Email not found' },
      } as any);

      const { error } = await sendPasswordReset('nonexistent@example.com');

      expect(error).toBe('Email not found');
    });

    it('should trim and lowercase email', async () => {
      mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await sendPasswordReset('  TEST@EXAMPLE.COM  ');

      expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object)
      );
    });
  });

  // ─── updatePassword Tests ──────────────────────────────────────────────

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      mockedSupabase.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const { error } = await updatePassword('newpassword123');

      expect(error).toBeNull();
      expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });

    it('should return error if password update fails', async () => {
      mockedSupabase.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Password too weak' },
      } as any);

      const { error } = await updatePassword('weak');

      expect(error).toBe('Password too weak');
    });
  });

  // ─── updateProfile Tests ───────────────────────────────────────────────

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      mockedSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      } as any);

      // create mocks for chain: from(...).update().eq()
      const eqMock = createMock().mockResolvedValue({ data: null, error: null });
      const updateMock = jest.fn().mockReturnValue({ eq: eqMock } as any);
      mockedSupabase.from.mockReturnValue({ update: updateMock } as any);

      const { error } = await updateProfile({
        display_name: 'John Doe',
        bio: 'Hello!',
      });

      expect(error).toBeNull();
      expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
      expect(updateMock).toHaveBeenCalledWith({
        display_name: 'John Doe',
        bio: 'Hello!',
      });
      expect(eqMock).toHaveBeenCalledWith('id', mockSession.user.id);
    });

    it('should return error if not authenticated', async () => {
      mockedSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      } as any);

      const { error } = await updateProfile({ display_name: 'John' });

      expect(error).toBe('Nu ești autentificat');
    });

    it('should handle database errors', async () => {
      mockedSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      } as any);

      const eqMock = createMock().mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation' },
      } as any);
      const updateMock = jest.fn().mockReturnValue({ eq: eqMock } as any);
      mockedSupabase.from.mockReturnValue({ update: updateMock } as any);

      const { error } = await updateProfile({ username: 'taken' });

      expect(error).toBe('Unique constraint violation');
    });
  });

  // ─── isUsernameAvailable Tests ──────────────────────────────────────────

  describe('isUsernameAvailable', () => {
    it('should return true if username is available', async () => {
      const maybeSingleMock = createMock().mockResolvedValue({ data: null } as any);
      const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock } as any);
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock } as any);
      mockedSupabase.from.mockReturnValue({ select: selectMock } as any);

      const available = await isUsernameAvailable('newuser');

      expect(available).toBe(true);
      expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
      expect(selectMock).toHaveBeenCalledWith('id');
      expect(eqMock).toHaveBeenCalledWith('username', 'newuser');
    });

    it('should return false if username exists', async () => {
      const maybeSingleMock = createMock().mockResolvedValue({ data: { id: 'user-1' } } as any);
      const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock } as any);
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock } as any);
      mockedSupabase.from.mockReturnValue({ select: selectMock } as any);

      const available = await isUsernameAvailable('existing');

      expect(available).toBe(false);
    });

    it('should trim and lowercase username', async () => {
      const maybeSingleMock = createMock().mockResolvedValue({ data: null } as any);
      const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock } as any);
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock } as any);
      mockedSupabase.from.mockReturnValue({ select: selectMock } as any);

      await isUsernameAvailable('  TestUser  ');

      expect(selectMock).toHaveBeenCalledWith('id');
      expect(eqMock).toHaveBeenCalledWith('username', 'testuser');
    });
  });

  // ─── onAuthStateChange Tests ───────────────────────────────────────────

  describe('onAuthStateChange', () => {
    it('should subscribe to auth state changes', () => {
      const mockUnsubscribe = jest.fn();
      const mockSubscription = { unsubscribe: mockUnsubscribe } as any;

      mockedSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      const callback = jest.fn();
      const unsubscribe = onAuthStateChange(callback);

      expect(mockedSupabase.auth.onAuthStateChange).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should call callback when auth state changes', () => {
      let authCallback: any;
      mockedSupabase.auth.onAuthStateChange.mockImplementation((cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } } as any;
      });

      const mockCallback = jest.fn();
      onAuthStateChange(mockCallback);

      authCallback('SIGNED_IN', mockSession);
      expect(mockCallback).toHaveBeenCalledWith(mockSession);

      authCallback('SIGNED_OUT', null);
      expect(mockCallback).toHaveBeenCalledWith(null);
    });
  });
});