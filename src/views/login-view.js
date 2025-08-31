import { LitElement, html, css } from 'lit';
import { supabase } from '../lib/supabaseClient.js';

export class LoginView extends LitElement {
  static properties = {
    email: { state: true },
    password: { state: true },
    message: { state: true },
    loading: { state: true },
    passkeysSupported: { state: true }
  };

  static styles = css`
    :host { display: block; max-width: 420px; margin: 3rem auto; }
    form { display: grid; gap: .75rem; }
    input, select { padding: .5rem; border-radius: .375rem; border: 1px solid #444; background: transparent; color: inherit; }
    button { background:#2563eb; border:none; color:white; padding:.5rem .75rem; border-radius:.375rem; cursor:pointer; }
    .row { display:flex; gap:.5rem; }
    small { opacity:.8; }
  `;

  constructor() {
    super();
    this.email = '';
    this.password = '';
    this.message = '';
    this.loading = false;
    this.passkeysSupported = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // Feature-detect Supabase WebAuthn API; hide passkeys UI if not available
    this.passkeysSupported = Boolean(supabase?.auth?.webauthn);
  }

  async emailLogin(e) {
    e.preventDefault();
    this.loading = true;
    this.message = '';
    try {
      // Email + Password if provided, otherwise OTP magic link
      if (this.password) {
        const { error } = await supabase.auth.signInWithPassword({ email: this.email, password: this.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: this.email, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        this.message = 'Check your email for the login link.';
      }
    } catch (err) {
      this.message = err.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  async registerPasskey() {
    try {
      if (!this.passkeysSupported) return;
      // Guarded call; only works if WebAuthn is enabled on your Supabase project
      const res = await supabase.auth.webauthn.register({
        name: this.email || 'Passkey',
      });
      if (res?.error) throw res.error;
      this.message = 'Passkey registered. You can now sign in with your passkey.';
    } catch (err) {
      this.message = err.message || String(err);
    }
  }

  async signInWithPasskey() {
    try {
      if (!this.passkeysSupported) return;
      const res = await supabase.auth.webauthn.authenticate();
      if (res?.error) throw res.error;
    } catch (err) {
      this.message = err.message || String(err);
    }
  }

  render() {
    return html`
      <h2>Welcome</h2>
      <p>Sign in with email, optionally set a password, or use a passkey if enabled.</p>
      <form @submit=${this.emailLogin}>
        <input required type="email" placeholder="Email" .value=${this.email} @input=${e => this.email = e.target.value} />
        <input type="password" placeholder="Password (optional)" .value=${this.password} @input=${e => this.password = e.target.value} />
        <div class="row">
          <button type="submit" ?disabled=${this.loading}>${this.loading ? '...' : 'Sign in / Sign up'}</button>
          ${this.passkeysSupported ? html`
            <button type="button" @click=${this.registerPasskey}>Register Passkey</button>
            <button type="button" @click=${this.signInWithPasskey}>Use Passkey</button>
          `: ''}
        </div>
      </form>
      ${this.message ? html`<p><small>${this.message}</small></p>`: ''}
    `;
  }
}
customElements.define('login-view', LoginView);