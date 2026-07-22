import React from 'react';
import LoginForm from './components/LoginForm';

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 safe-top safe-bottom"
      style={{ background: 'var(--background)' }}
    >
      <LoginForm />
    </div>
  );
}